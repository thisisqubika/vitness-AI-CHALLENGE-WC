# VIT-5: Sticker catalog — WC 2026 data + procedural cards + read policies

> The data foundation for the collection loop (CONCEPT.md § The Collection). VIT-4
> already awards packs; `open_pack` already rolls 3 stickers server-side. But the
> `stickers` catalog is empty and the client can't read its packs/stickers. This
> ticket populates a real, accurate WC 2026 catalog and opens the read paths —
> so VIT-6 can show pack-opening + the album.

## User Story

**As a** collector
**I want** the packs I earn to contain real WC 2026 players rendered as original
cards I can see in my album
**So that** the album is an accurate, ownable record of the tournament — with no
licensed imagery.

## Scope

In:
- **Structure** from `openfootball/worldcup.json` (2026): 48 teams + groups,
  committed as static JSON (team id, name, code, flag, kit colours).
- **Squads** via a one-time API-Football pull (build-time script, key from env),
  committed as static JSON per team.
- A **catalog builder** that turns squads + structure into `stickers` rows:
  player cards (rarity-assigned), plus per-match moment/MOTM/golazo slots for the
  ARG-MEX demo match.
- A **procedural card spec** (data only — the SVG renderer is VIT-6): each sticker
  carries everything a card needs (name, number, position, team, flag, colours,
  rarity, optional embedded jugada).
- **Read policies** so the client can see its own collection: `stickers` (public
  read), `packs` (own), `user_stickers` (own), `pack_contents` (own packs).

Out (VIT-6 + later):
- The pack-opening UI/animation and the album grid (VIT-6).
- Procedural SVG card component (VIT-6).
- Trading, mega-album completion rewards, pity-timer tuning UI.

## Acceptance Criteria

### Scenario 1: Catalog is populated and accurate (happy path)
```gherkin
Given the squad + structure data is committed
When the catalog builder seeds the stickers table
Then every sticker has a real WC 2026 team and player (name/number/position)
And rarities are assigned (common players, rare standouts, golazo moments)
And open_pack rolls only real catalog stickers
```

### Scenario 2: A user can read its own collection, not others' (security)
```gherkin
Given read policies on packs, user_stickers, pack_contents
When a user queries its packs and stickers
Then it sees only its own rows
And it cannot read another user's packs or inventory
And the stickers catalog itself is readable by all authenticated users
```

### Scenario 3: No licensed imagery
```gherkin
Given the card data
When a card is described
Then it contains only factual data (name, number, position, team, flag, colours)
And no photographic or third-party sticker image is referenced
```

### Scenario 4: Open a pack against the real catalog
```gherkin
Given a populated catalog and an earned pack
When open_pack runs
Then it returns 3 real stickers and they appear in user_stickers
```

## Technical Context

### Current state
- `stickers`, `packs`, `user_stickers`, `pack_contents` tables exist (VIT-1) with RLS enabled and **no read policies**.
- `open_pack` rolls by rarity from `stickers` (VIT-1, fixed in security pass).
- VIT-4 awards packs (`source='trivia'`).
- Live provider abstraction exists (VIT-1) but no API-Football key wired.

### Proposed changes

**Data acquisition — harvest once, snapshot, work offline (build-time, committed output):**
- `supabase/seed/catalog/harvest.ts` — ONE resume-safe run that pulls everything from API-Football and snapshots each raw response to `supabase/seed/catalog/raw/` (committed): `league.json`, `teams.json`, `squads/<teamId>.json` (one per team), `fixtures.json`, `_meta.json`. ~51 calls total, inside the 100/day free cap.
  - Resume-safe: skips any team whose squad file exists, so a re-run (even next day) continues without re-spending calls.
  - Rate-limited: reads the remaining-quota headers, throttles for the per-minute cap, stops before the daily cap is exhausted.
  - Probes free-tier access first and aborts cleanly if WC 2026 is blocked (no wasted calls).
- **The snapshot in `raw/` is the source of truth for all downstream work** — the catalog builder and every iteration read it, never the API. The key lives only in env, never committed.
- `supabase/seed/catalog/structure.json` — team display metadata (code, flagEmoji, primaryColor, secondaryColor) keyed by API team id; openfootball/hand-filled, merged with `teams.json` at build.
- Fallback: until the harvest runs, the builder uses our existing ARG/MEX lineups so the loop is testable now.

**Catalog builder:**
- `supabase/seed/catalog/build-catalog.ts` (service role) — from structure + squads, upsert `stickers`:
  - one **player** card per squad player; rarity heuristic (most common; a few rare standouts per team).
  - per demo match: 4 **moment** cards, 1 **MOTM**, 1 **golazo** (golazo links `embedded_jugada_id` → the goal's jugada).
  - `album_slot` assigned so a match album has a stable 12-slot layout.
- Sticker columns already exist: `match_id, album_slot, rarity, title, subtitle, art_url, embedded_jugada_id`. Add a `meta jsonb` (migration) carrying card-render fields (team code, flag, colours, number, position) so VIT-6 draws without re-joining.

**Migration:**
- `stickers.meta jsonb` (card-render payload).
- Read policies:
  - `stickers`: `select` to `authenticated` (catalog is public within the app).
  - `packs`: `select` where `profile_id = auth.uid()`.
  - `user_stickers`: `select` where `profile_id = auth.uid()`.
  - `pack_contents`: `select` where the pack belongs to `auth.uid()` (subquery).

**Shared:** `sticker.ts` — `StickerCard` type (the render payload) + rarity helpers, so VIT-6 and the builder agree.

### Architecture decisions

| Decision | Rationale |
|----------|-----------|
| Squads pulled once → static JSON in repo | No runtime API dependency or rate-limit risk; reproducible; free-tier-friendly. |
| Structure from openfootball, squads from API-Football | openfootball is public-domain and accurate for teams/groups/fixtures but has no squads; API-Football fills the squad gap. |
| `stickers.meta` carries render fields | VIT-6's SVG card draws from one row; no client-side joins to squads. |
| Catalog is server-authoritative; `open_pack` already rolls it | Reuses the verified, replay-safe roll; this ticket only fills the catalog + opens reads. |
| Procedural cards, factual data only | No image/publicity-rights exposure (CONCEPT.md § risks). |

## Out Of Scope / Edge Cases
- Squad changes mid-tournament → re-run fetch + build (idempotent upserts).
- A team with no squad yet (data gap) → builder logs and skips, doesn't crash.
- Rarity balance is server-tunable; not final this ticket.

## Definition Of Done
- `pnpm --filter mobile typecheck` + `pnpm test` pass.
- Migration applies; read policies verified by psql (own rows only; catalog public).
- Catalog builder seeds stickers from real data (or ARG/MEX fallback pending the key); `open_pack` returns real cards (deterministic test).
- `fetch-squads.ts` documented (env key, how to run); README updated.
- API key handling documented; key never committed.

## References
- [`docs/CONCEPT.md`](../CONCEPT.md) § The Collection, § Drop tables, § risks (IP).
- VIT-1 schema (`stickers`/`packs`/`user_stickers`/`pack_contents`, `open_pack`).
- openfootball/worldcup.json (structure); API-Football v3 (squads).

**BDD Scenarios**: 4

---

## VIT-6 (next, outline only): Pack opening + album UI
- Procedural SVG `StickerCard` (front: flag + name + number + position + rarity frame; back: VITNESSED provenance). Golazo variant embeds the VIT-3 replay.
- Pack queue + open animation (call `open_pack`, reveal 3 cards); "save for halftime" nudge per CONCEPT.md match rhythm.
- Album: per-match 12-slot grid (owned vs missing silhouette) + mega-album team pages; completion %.
- Album tab / navigation entry; duplicate count badges.

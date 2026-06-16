---
document_type: architecture
summary: Now writing the file.
last_updated: '2026-06-15T14:50:02.906Z'
tags:
  - architecture
  - topology
  - typescript
  - expo
  - react-native
---
Now writing the file.

## Monorepo / Repository Shape

VITNESS is a **pnpm workspaces** monorepo (Node ≥ 22, pnpm 10). The root `package.json` is purely orchestration — its only dependency is the `supabase` CLI, and its scripts delegate to workspace members via `pnpm -r` or `pnpm --filter`. There are three real workspace members and a non-runtime root placeholder (`vitness`).

The top-level layout follows a conventional `apps/` + `packages/` split for client and library code, with `supabase/` acting as a self-contained backend workspace:

```
project/
├── apps/
│   └── mobile/          Expo React Native app (iOS · Android · web)
├── packages/
│   └── shared/          @vitness/shared — Zod schemas + domain types
└── supabase/            Postgres schema · RLS · Deno edge functions
```

All three workspaces are TypeScript. The mobile and shared packages share a TypeScript 6.0 compiler. The Supabase workspace runs its edge functions in the Deno runtime and imports shared types from `@vitness/shared` via the pnpm workspace protocol (`workspace:*`).

---

## Service Inventory

| id | name | type | language | port | role |
|----|------|------|----------|------|------|
| [[mobile]] | mobile | mobile | TypeScript | — | Expo 56 + React Native 0.85 app; file-based routing via expo-router; targets iOS · Android · web |
| [[shared]] | @vitness/shared | library | TypeScript | — (no runtime) | PlayScript Zod schema + domain enums (StickerRarity, PackState, JugadaSource) + economy constants; compile-time dependency for mobile and edge functions |
| [[supabase]] | supabase | serverless | TypeScript / Deno | 54321 (local) | Postgres + RLS + four Deno edge functions (poller · compose-play · submit-answer · personas); the entire backend |

---

## Service Communication

All network traffic flows between mobile and supabase. The shared library is a compile-time dependency only; it ships no server or socket.

| Source | Target | Protocol | Data shape |
|--------|--------|----------|------------|
| mobile | supabase — PostgREST | HTTPS REST | Supabase JS client; queries use the auto-generated PostgREST interface over the anon key + JWT |
| mobile | supabase — Realtime | WebSocket | Supabase Realtime channels; mesa-scoped channels deliver jugada events and persona one-liners |
| mobile | supabase — edge functions | HTTPS POST | `Authorization: Bearer <JWT>`; JSON bodies shaped by `@vitness/shared` Zod schemas (`TriviaChallengeSchema`, `PlayScriptSchema`) |
| supabase (poller) | API-Football | HTTPS REST | Fixture events (goals · assists · cards · subs · lineups); polled every 60 s; persisted to `matches` / `jugadas` |
| supabase (compose-play) | Anthropic Claude API | HTTPS POST | Goal-event facts as structured fields; response is Zod-validated `PlayScript` JSON; deterministic template fallback on schema failure |
| supabase (personas) | Anthropic Claude API | HTTPS POST | System-prompted persona context; one Claude call per match event, cached server-side; never triggered by user input directly |
| supabase (compose-play) | StatsBomb Open Data | bundled static | Offline-compiled retro play scripts inserted via migrations/seed; no runtime HTTP call |

---

## External Integrations

| Vendor | Purpose | In-repo client | Auth mechanism | Environments |
|--------|---------|----------------|----------------|--------------|
| **Supabase** | Auth · Postgres · Realtime · edge function host | `@supabase/supabase-js` (mobile); `jsr:@supabase/supabase-js@2` (Deno) | `SUPABASE_URL` + `SUPABASE_ANON_KEY` (public); `SUPABASE_SERVICE_ROLE_KEY` (server-only, bypasses RLS) | local Docker (port 54321) · cloud supabase.com project |
| **API-Football** | Live WC 2026 fixture events: goals with scorer + assist, cards, subs, lineups | `supabase/functions/poller/index.ts` (skeleton) | API key stored as Supabase edge-function secret; never exposed to the client | development (free tier, 100 req/day) · tournament weeks (paid tier) |
| **StatsBomb Open Data** | Retro WC play-level event data (1958–2022) with x/y coordinates; exact reconstructions, not LLM guesses | Offline TypeScript compiler (planned in `packages/shared/`); output is static JSON bundled at build time | No key required; free with attribution (non-commercial) | build-time only; no runtime dependency |
| **Anthropic Claude API** | Play-script waypoint generation (compose-play) · La Mesa persona one-liners, picks, roasts (personas) | `supabase/functions/compose-play/index.ts`, `supabase/functions/personas/index.ts` (skeletons) | API key stored as Supabase edge-function secret; never shipped in the app bundle | all environments; local calls hit the real API |
| **TTS provider** | El Relator voice: goal calls + 60–90 s post-match recap | (not determined by analysis — stretch goal per CONCEPT.md) | (not determined by analysis) | stretch goal only |
| **openfootball/worldcup.json** | Static WC 2026 schedule + squad seed data; zero API cost | Seed SQL or migration-time import | Public domain | development seed only |

---

## Authentication & Authorisation

Authentication is handled entirely by **Supabase Auth**. The mobile app signs users in via the Supabase JS client SDK; on success, Supabase issues a signed JWT whose `sub` claim is the Supabase user ID. The specific identity providers enabled (email/password, Google OAuth, Apple Sign-In, anonymous sessions) are configured in the Supabase project dashboard and are not stored in the repository.

**Token flow.** The mobile client attaches `Authorization: Bearer <JWT>` to every request — both PostgREST queries and edge-function calls. Edge functions validate the token by calling `supabase.auth.getUser(token)` (see `supabase/functions/submit-answer/index.ts:30`); any request without a valid token receives a 401 before business logic executes.

**Row-Level Security.** Every table in the initial schema has RLS enabled (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`). RLS policies (planned for a follow-up migration) enforce per-user data isolation at the database layer: the JWT `sub` claim is compared against `profile_id` / `user_id` foreign keys so users can only read or write their own rows. The `jugadas.answer_key` column is deliberately hidden from the client via RLS — only the `submit-answer` edge function reads it with the `SUPABASE_SERVICE_ROLE_KEY` (which bypasses RLS), grades the answers, and returns only the result. This prevents trivia answer-key inspection at the network layer.

**Permission tiers.** Two tiers exist in practice: the **anon key** (scoped by RLS to the authenticated user's own rows) and the **service-role key** (bypasses RLS; used inside edge functions only for server-authoritative operations: pack rolls, coin grants, pity-counter updates, trade execution).

---

## Request Lifecycle

### Live trivia answer submission (primary path)

1. **Poller fires (every 60 s).** `supabase/functions/poller` fetches live events from API-Football. New goal events are deduplicated by provider event ID.
2. **VAR confirmation delay.** The poller waits ~2–3 minutes (or until the provider clears a VAR flag) before handing the event to `compose-play`.
3. **Play composition.** `supabase/functions/compose-play` selects a template skeleton by goal type, sends goal facts (scorer, assist, lineup positions) to the Anthropic Claude API as structured fields, and Zod-validates the returned `PlayScript` against `PlayScriptSchema`. On failure it substitutes a deterministic template. The result is persisted to `jugadas` with `answer_key` stored server-side only.
4. **Realtime fan-out.** Supabase Realtime delivers the new jugada row (anonymous `PlayScript` + distractor option lists; no player names) to clients subscribed to the active match channel.
5. **Answer submission.** The user picks answers within the timer window. The mobile app POSTs `{ jugadaId, answers, issuedAt }` to `supabase/functions/submit-answer` with `Authorization: Bearer <JWT>`.
6. **Server grading.** The edge function authenticates the JWT, reads `jugadas.answer_key` via the service-role client (bypassing RLS), grades each slot, applies the late-window 50% penalty if the submission falls outside the timer, computes coins and packs, and writes one `trivia_attempts` row. The `UNIQUE (jugada_id, profile_id)` constraint makes repeated submissions idempotent.
7. **Reward persistence.** Coin increment and pack grant run inside a Postgres transaction (planned as Postgres functions). `submit-answer` returns the graded result and the reveal payload to the client.
8. **Reveal animation.** The mobile app replays the reconstruction with real player names revealed slot by slot.

### pg_cron poller cycle (background path)

1. pg_cron triggers `poller` every 60 seconds.
2. `poller` fetches fixture events, deduplicates, and for each new goal event calls `compose-play`.
3. `compose-play` produces a `PlayScript` and persists the jugada.
4. Supabase Realtime fans the insert out to all subscribed match-room clients in real time.

---

## Data Architecture

**Primary store:** Supabase-managed **Postgres**. Local development uses Docker (via `supabase start`, port 54321); production uses the Supabase cloud project. No ORM. PostgREST handles client queries; edge functions use the Supabase JS client or raw SQL.

**Schema management:** Timestamped SQL migration files in `supabase/migrations/` applied in strict filename order (`{YYYYMMDDHHmmss}_{description}.sql`). Two migration files exist at scaffold:

| File | Contents |
|------|---------|
| `20260615000000_initial_schema.sql` | Enums, all 11 tables, indexes, `ENABLE ROW LEVEL SECURITY` per table |
| follow-up RLS-policies migration | Planned; not yet written |

**Table inventory:**

| Table | Purpose |
|-------|---------|
| `profiles` | 1:1 with `auth.users`; `display_name`, `team_code`, `coins`, pity counters |
| `mesas` | Private leagues; unique 6-char `join_code` |
| `mesa_members` | Profiles ↔ mesas join table with `points` |
| `matches` | Fixture metadata from the poller |
| `jugadas` | Reconstructed plays; `play_script` JSONB (PlayScript v1), `answer_key` JSONB (RLS-hidden), `distractors` JSONB |
| `trivia_attempts` | One row per (jugada, profile); `UNIQUE (jugada_id, profile_id)` enforces idempotency |
| `stickers` | Collectible card catalog; `embedded_jugada_id` links golazo cards to their `PlayScript` replay |
| `packs` | Per-user pack state machine (`unopened → opened_unviewed → viewed`) |
| `user_stickers` | Owned stickers with duplicate count and VITNESSED provenance text |
| `pack_contents` | Audit log of stickers rolled per pack (enables reveal replay after app kill) |
| `trades` | Mesa-scoped duplicate-for-duplicate offers (`offered → accepted / declined / cancelled / expired`) |

**Type synchronisation.** `packages/shared/src/domain.ts` mirrors the Postgres enum types (`StickerRarity`, `PackState`, `JugadaSource`) as Zod schemas. When a migration alters an enum or column, the shared schemas must be updated manually — no code generation bridges the gap. The `PlayScriptSchema` in `packages/shared/src/play-script.ts` defines the canonical `play_script` JSONB shape consumed by both the mobile renderer and the compose-play edge function.

**Realtime.** Supabase Realtime channels provide WebSocket fan-out for live jugada events and mesa activity. Channels are RLS-aware; mesa channels are member-scoped.

---

## Deployment Topology

| Target | Service hosted | Deploy trigger |
|--------|---------------|----------------|
| Supabase cloud project | supabase (Postgres + Auth + Realtime + edge functions) | `supabase db push` (schema) + `supabase functions deploy` (functions) — manual CLI; no CI pipeline yet |
| Expo EAS / App Store / Google Play | mobile (iOS · Android) | `eas build` + `eas submit` — (not determined by analysis; EAS not configured in repo) |
| Static web hosting (TBD) | mobile (web target via `expo export --platform web`) | (not determined by analysis; hosting target not chosen) |

The Supabase platform is the authoritative backend for all environments. Local development and the cloud project run identical code (`supabase start` → `supabase db push`/`supabase functions deploy` produces zero drift by design).

---

## Local Development

Full local stack after cloning:

```bash
pnpm install                     # installs all workspace dependencies
supabase start                   # Docker: Postgres + Auth + Realtime + edge functions (port 54321)
supabase db reset                # applies all migrations to the local database
pnpm mobile                      # Expo dev server (alias for pnpm --filter mobile start)
```

The Expo app connects to the local Supabase stack at the host machine's LAN address on port 54321. No `.env` template is committed; the Supabase CLI injects `SUPABASE_URL` and `SUPABASE_ANON_KEY` automatically into local edge functions. External API secrets (Anthropic, API-Football) must be configured via `supabase secrets set` before those functions can be fully exercised locally.

**Docker / OrbStack** is required for `supabase start`. The Expo app runs on the host via the Expo CLI, targeting a simulator, Expo Go on a physical device, or a web browser.

---

## Automation & CI

**Primary automation interface:** root-level `pnpm` scripts delegate to workspace members.

| Command | What it runs |
|---------|-------------|
| `pnpm mobile` | `pnpm --filter mobile start` — Expo dev server |
| `pnpm -r typecheck` | `tsc --noEmit` in every workspace with a `typecheck` script |
| `pnpm -r lint` | `expo lint` in mobile (+ future workspace linters) |
| `pnpm -r test` | Test runner across all workspaces (no tests exist at scaffold) |

No Makefile, Justfile, Taskfile, or shell scripts are present. **No CI pipeline is configured** at scaffold time — no `.github/workflows/`, `.gitlab-ci.yml`, or equivalent file exists in the repository.

---

## Coupling Hotspots

Hub nodes (highest total degree — changes carry the largest blast radius):

- `apps/mobile/src/app/explore.tsx::TabTwoScreen` (Function, score 47)
- `apps/mobile/src/components/themed-text.tsx::ThemedText` (Function, score 40)
- `apps/mobile/src/components/themed-view.tsx::ThemedView` (Function, score 18)
- `apps/mobile/src/components/ui/collapsible.tsx::Collapsible` (Function, score 17)
- `apps/mobile/src/app/index.tsx::HomeScreen` (Function, score 15)

Bridge nodes (highest betweenness centrality — single points of inter-community connectivity):

- `apps/mobile/src/components/themed-text.tsx::ThemedText` (Function, score 0.001008)
- `apps/mobile/src/hooks/use-theme.ts::useTheme` (Function, score 0.000721)
- `apps/mobile/src/components/external-link.tsx::ExternalLink` (Function, score 0.000649)
- `apps/mobile/src/components/animated-icon.tsx::AnimatedSplashOverlay` (Function, score 0.000642)
- `apps/mobile/src/components/app-tabs.web.tsx::CustomTabList` (Function, score 0.000613)

`ThemedText` appears in both lists, making it the single most critical UI primitive at scaffold time: both the most-referenced component and the primary bridge between mobile communities. `useTheme` is the theme hook it depends on, giving it outsized bridge centrality despite low hub score. These are scaffold-era primitives; as domain screens are built out they will likely be supplanted by purpose-built components, reducing these scores naturally.

# VIT-1: Match data layer — provider abstraction, domain models & replay engine

> Build-order #1 from [`docs/CONCEPT.md`](../CONCEPT.md). The risk-first keystone:
> a provider-agnostic match-data layer plus a replay engine, so every later
> feature (match room, jugada sim, trivia) can be built and demoed with zero
> live-API dependency.

## User Story

**As a** VITNESS developer
**I want** a single provider-agnostic interface for football match data, backed by
match/event domain models and a replay engine that emits a recorded match on a
timeline
**So that** the app's live features can be built, demoed, and rehearsed without a
live match or a paid API key — and so the live provider can later be swapped in
behind the same contract.

## Stakeholders

- **Developer (Martín)** — primary consumer of the interface; builds the match room on top of it.
- **Demo audience (tournament judges)** — experience the replayed match as if live.
- **Future live integration (VIT-2 poller)** — implements the same `MatchDataProvider` contract.

## Success Criteria

1. A `MatchDataProvider` interface exists in `packages/shared` that all data sources implement.
2. Two providers ship and pass their unit tests: `StaticJsonProvider` (one-shot fixtures) and `ReplayProvider` (timeline emission).
3. Match and match-event Zod schemas exist in `packages/shared`, re-exported from the barrel, and `pnpm -r typecheck` passes.
4. A `match_events` migration is added and applies cleanly to a local Supabase stack (`supabase db reset`).
5. A runnable replay script streams a recorded match into the local Supabase DB at a configurable speed; rows land in `match_events` in timeline order.
6. One recorded-match fixture (ARG vs MEX, ~12 events) lives in the repo and is consumed by the replay script.

## Acceptance Criteria

### Scenario 1: Replay emits events in accelerated timeline order (happy path)

```gherkin
Given a recorded match fixture with events at minutes 0, 12, 34, 45, 67, 76, 90
And a replay speed multiplier of 60 (1 match-minute = 1 real-second)
When the developer runs the replay against the local Supabase stack
Then each event is inserted into match_events in ascending minute order
And the wall-clock gap between consecutive insertions matches the scaled minute gap within ±500ms
And the match row's status transitions scheduled → live → finished
```

### Scenario 2: Provider abstraction is source-agnostic

```gherkin
Given the StaticJsonProvider and the ReplayProvider both implement MatchDataProvider
When a caller requests fixtures, lineups, and the event stream through the interface
Then neither caller code path references a concrete provider class
And swapping StaticJsonProvider for ReplayProvider requires no change to caller code
```

### Scenario 3: Event schema rejects malformed data (validation)

```gherkin
Given the matchEventSchema from @vitness/shared
When an event is parsed that is missing its "minute" field or carries an unknown "type"
Then schema parsing throws a ZodError
And the replay script logs the offending event index and aborts before writing partial data
```

### Scenario 4: Replay is idempotent and re-runnable (edge case)

```gherkin
Given a match that was already replayed into match_events
When the developer re-runs the replay for the same match id
Then prior events for that match id are cleared (or upserted by provider event id) before re-emitting
And no duplicate (match_id, provider_event_id) rows exist after the run
```

### Scenario 5: Goal events carry scorer and assist (happy path)

```gherkin
Given a recorded goal event in the fixture
When it is parsed by matchEventSchema
Then it exposes scorerId and an optional assistId
And both ids resolve to players present in that match's lineup in the fixture
```

## Technical Context

### Current state

- `supabase/migrations/20260615000000_initial_schema.sql` defines a `matches` table (`id`, `provider_match_id`, `home_team`, `away_team`, `kickoff_at`, `status`, `created_at`) with RLS enabled. No `match_events` table yet.
- `packages/shared` exports `PlayScript` schemas and domain enums; no match/event/provider types yet.
- `supabase/functions/poller/index.ts` is a documented skeleton returning 501 — it is NOT in scope here.
- No test runner is configured (see testing-conventions).

### Proposed changes

**`packages/shared/src/` (new files, kebab-case, `Schema`-suffixed exports):**

- `match.ts` — `matchSchema` (mirrors the `matches` table) + `MatchStatus` enum (`scheduled | live | halftime | finished | abandoned`).
- `match-event.ts` — `matchEventSchema`: discriminated union on `type` (`kickoff | goal | card | substitution | half_time | full_time | shot | corner`), each with `minute`, `team` (`home|away`), `providerEventId`, and type-specific fields (goal → `scorerId`, optional `assistId`; card → `playerId`, `cardType`; substitution → `playerOutId`, `playerInId`). Also `lineupSchema` (players with `id`, `name`, `shirtNumber`, `position`).
- `match-data-provider.ts` — the `MatchDataProvider` interface:
  ```ts
  interface MatchDataProvider {
    getFixtures(): Promise<Match[]>;
    getLineups(matchId: string): Promise<{ home: Lineup; away: Lineup }>;
    streamEvents(matchId: string, onEvent: (e: MatchEvent) => Promise<void>): Promise<void>;
  }
  ```
- `replay-clock.ts` — pure, side-effect-free timeline logic: given an ordered event list + a speed multiplier, computes the delay before each event. Unit-testable without I/O (inject a `sleep`/`now` seam).
- Re-export all from `index.ts`.

**`supabase/migrations/` (new):**

- `20260616xxxxxx_match_events.sql` — `match_events` table: `id uuid pk`, `match_id text references matches`, `provider_event_id text`, `type text`, `team text`, `minute int`, `payload jsonb`, `created_at timestamptz`. `unique (match_id, provider_event_id)`. Index on `(match_id, minute)`. RLS enabled; read policy: any authenticated user may read events (match data is public within the app).

**Replay runner + fixture:**

- `supabase/seed/replay/arg-mex-2026.json` — one recorded match: a `Match`, both lineups, and ~12 `MatchEvent`s (kickoff → goals w/ scorer+assist → cards → sub → HT → FT). Validates against the shared schemas.
- A runnable script (`supabase/seed/replay/run-replay.ts`, Deno) that: loads + validates the fixture, instantiates `ReplayProvider`, clears prior events for that match id, and on each emitted event upserts into `match_events` and bumps `matches.status`. Accepts `--speed` (default 60) and `--match` args. Documented in README § Develop.

### Constraints

- Replay runner targets the LOCAL Supabase stack (`supabase start`); uses the service-role key from the local env, never shipped in the app bundle.
- No live network calls anywhere in this ticket.
- `replay-clock.ts` must be pure (no `Deno`/`fetch`/timers imported at module scope) so it unit-tests in any runtime.
- Follow code-conventions: no inline comments (JSDoc only), kebab-case files, shared schemas in `packages/shared`.

### Integration points

- Writes to local Supabase Postgres (`match_events`, `matches`).
- Realtime fan-out to the mobile app is explicitly the NEXT ticket (match room) — this ticket stops at durable rows + a clean provider seam.

### Architecture decisions

| Decision | Rationale |
|----------|-----------|
| Persist events to a `match_events` table (not pure broadcast) | Durable + queryable; supports late-join and the 10-min grace window from CONCEPT.md; realtime can be layered on top later. |
| Replay runner is a local Deno script, not an edge function | A full accelerated match runs minutes — edge functions have execution-time limits. A local script is reliable for dev + demo and needs no deploy. |
| `replay-clock.ts` is pure, separate from the runner | Makes timeline math unit-testable with no Supabase/Deno dependency; the runner is the thin I/O shell. |
| Fixture is synthetic ARG vs MEX (not a real match) | Matches the running example across mockups; real historic plays arrive via StatsBomb in the retro ticket. Live-shaped event JSON differs from StatsBomb's format, so a hand-authored live-shaped fixture is the correct shape to replay. |
| `unique (match_id, provider_event_id)` | Makes replay idempotent and dedups the future live poller in one constraint. |

## Out Of Scope

- The live API-Football poller (VIT-2 — needs a paid key + live match; implements the same `MatchDataProvider`).
- Play-script composition from events (jugada reconstruction).
- Realtime fan-out to the mobile app and the match-room UI.
- Trivia, packs, personas, albums.
- StatsBomb retro compilation.

## Edge Cases And Error Handling

- **Malformed fixture event** → Zod parse throws; runner logs offending index and aborts before any write (no partial state).
- **Re-running a completed replay** → prior `match_events` for that match id are cleared/upserted; no duplicates (enforced by unique constraint).
- **Speed = 0 or negative** → runner rejects with a clear error.
- **Assist id not in lineup** → fixture validation step flags it (cross-reference check in the runner before replay starts).
- **Local Supabase not running** → runner fails fast with an actionable message ("run `supabase start` first").

## Validation Rules

- Every event: `minute` is an integer 0–130 (covers ET); `team` ∈ {home, away}; `type` ∈ the known union.
- Goal events: `scorerId` required; `assistId` optional but, when present, must exist in the scoring team's lineup.
- `match_events.provider_event_id` unique per match.

## Dependencies

- **Blocking:** none (baseline scaffold + schema already committed).
- **Related:** VIT-2 (live poller, future) consumes the `MatchDataProvider` contract defined here.

## Definition Of Done

- **Code quality:** `pnpm -r typecheck` passes; kebab-case + JSDoc-only conventions honored; shared schemas re-exported from the barrel.
- **Testing:** `replay-clock.ts` unit tests cover ordering + scaled-delay math (deterministic, injected clock); `matchEventSchema` has parse/reject coverage per event type (100% per testing-conventions). A test runner (Vitest for `packages/shared`) is introduced as part of this ticket since none exists yet.
- **Functional:** `supabase db reset` applies the new migration; the replay script runs end-to-end against the local stack and lands ~12 ordered rows in `match_events`; status transitions observed.
- **Documentation:** README § Develop documents `supabase start` + the replay command; new shared modules carry JSDoc.
- **Review:** changes reviewed via `/pr-reviewer` before merge to `development`.

## Implementation Notes

- Suggested build sequence: shared schemas → `replay-clock` (+ its unit tests) → `match_events` migration → fixture JSON → runner script → README.
- Keep the `MatchDataProvider` interface minimal; resist adding methods the match room doesn't yet need.
- The runner should import shared schemas via the same `../../packages/shared/src/index.ts` path the code-conventions example uses for edge functions.
- Introduce Vitest at the workspace root so future tickets inherit it; wire `pnpm -r test`.

## References

- [`docs/CONCEPT.md`](../CONCEPT.md) — § Data providers, § Play-script pipeline, § Match rhythm.
- [`docs/llm-wiki/wiki/services/supabase.md`](../llm-wiki/wiki/services/supabase.md), [`shared.md`](../llm-wiki/wiki/services/shared.md).
- API-Football event shape (for the future poller's parity): https://www.api-football.com/documentation-v3

---

**INVEST Validated**: ✅ (Independent — no blockers; Negotiable — fixture content & speed default open; Valuable — unblocks all live features + demo; Estimable — ~2–3 days; Small — new files across 2 packages, no cross-service blast radius; Testable — pure clock + schema parse/reject + observable rows)
**BDD Scenarios**: 5
**Scope impact** (qualitative — new files only): packages/shared (+5 files), supabase (1 migration + seed dir), root (Vitest). No modifications to existing runtime code paths.

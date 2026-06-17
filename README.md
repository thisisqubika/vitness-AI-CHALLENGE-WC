# VITNESS

> *¿Viste el partido?* — second-screen World Cup companion. Watch a match, the
> app redraws each key play as a 2D reconstruction, you prove you saw it by
> naming who was in the play, and that earns sticker packs that fill an album
> you didn't buy — you witnessed it.

Built for the Qubika World Cup Challenge (FIFA World Cup 2026).

## Concept

See [`docs/CONCEPT.md`](docs/CONCEPT.md) for the full design: mechanics, economy,
mesas, data pipeline, security model, and build order.

## Stack

| Layer | Tech |
|-------|------|
| Mobile | Expo React Native + expo-router, Skia (pitch sim), Reanimated (packs) |
| Backend | Supabase only — Postgres + RLS, edge functions (Deno), realtime, pg_cron poller |
| Shared | `@vitness/shared` — PlayScript Zod schema + domain types |
| Live data | API-Football (WC 2026) |
| Retro data | StatsBomb Open Data (compiled offline) |
| AI | Claude (personas, live play composition) |

## Layout

```
apps/mobile        Expo RN app
supabase/          migrations + edge functions (the whole backend)
packages/shared    PlayScript schema + domain types
docs/CONCEPT.md    design document
```

## Prerequisites

- Node 22+, pnpm 10
- Docker or OrbStack (for `supabase start` — local backend stack)

## Develop

```bash
pnpm install
pnpm mobile                      # start Expo
pnpm test                        # run unit tests (Vitest)
pnpm exec supabase start         # local Postgres + auth + realtime + edge functions
pnpm exec supabase db reset      # apply migrations to the local db
```

### Replay a recorded match

The replay engine streams a recorded match into the local Supabase stack at an
accelerated speed — so the match room and demos run with zero live-API
dependency. Start the stack first, then:

```bash
pnpm replay                      # default: arg-mex-2026 fixture at 60× (~90s)
pnpm replay -- --speed=600       # faster (~9s)
pnpm replay -- --fixture=arg-mex-2026.json --speed=300
```

`--speed` is the acceleration factor vs real time: `1` = real time (a 90-minute
match takes 90 minutes), `60` ≈ 90 minutes in 90 seconds, `600` ≈ 9 seconds. For
a watchable live demo use ~`120` (≈45s). The runner validates the fixture, clears
any prior events for that match, then writes events into `match_events` in
timeline order and advances `matches.status` (scheduled → live → halftime →
finished). Re-running is idempotent.

Recorded-match fixtures live in [`supabase/seed/replay/`](supabase/seed/replay/).

### Jugada reconstructions

Tapping a goal in the match room opens its 2D play reconstruction — players and
the ball animated across the pitch from a `PlayScript`. The renderer
([`jugada-pitch`](apps/mobile/src/components/jugada/)) uses `react-native-svg`
(renders the same on web + native); interpolation is the pure `samplePlay`
helper in `@vitness/shared`. Demo play-scripts are hand-authored in
[`apps/mobile/src/data/demo-jugadas.ts`](apps/mobile/src/data/demo-jugadas.ts)
pending the `compose-play` pipeline, which will write the same shape to the
`jugadas` table.

### Run the app against the replay

```bash
pnpm exec supabase start          # backend (requires Docker)
pnpm --filter mobile exec expo start --web   # or: pnpm mobile
# open the app, tap the match, then in another terminal:
pnpm replay -- --speed=120        # watch the room update live
```

The app signs in **anonymously** on launch (so RLS-gated reads work), which
requires `enable_anonymous_sign_ins = true` in `supabase/config.toml` (already
set). The match room subscribes to `match_events` over Realtime and updates with
no refresh as the replay streams.

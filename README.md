# VITNESS

> *¿Viste el partido?* — a second-screen World Cup companion where every key play is redrawn as a 2D reconstruction, you prove you saw it by naming who was involved, and that earns sticker packs that fill an album you didn't buy — you witnessed it.

Built for the **Qubika World Cup Challenge** (FIFA World Cup 2026). Track: Fan Experience.

## The Problem

Watching a World Cup match alone on a second screen is passive — you scroll, you half-watch, the moments blur together, and nothing you saw is ever *yours*. Sticker albums capture that "I was there" feeling, but they're bought, not earned, and disconnected from the match you actually watched.

## The Solution

VITNESS turns watching into a game. Each key play is replayed as an anonymized 2D reconstruction on a pitch; you guess who was in the play; correct answers (graded server-side) earn coins and sticker packs. Opening packs fills per-country albums of 22-player squads, and every card is stamped with how you earned it — the album becomes the record of *your* tournament.

## How AI Was Used

**To build it (the dominant use):** VITNESS was built almost end-to-end with **Claude (Opus, via Claude Code)** on top of Qubika's Agentic Framework (QAF). What was delegated to AI:

- **Architecture & backend** — the Postgres schema, Row-Level Security policies, the server-authoritative `open_pack` RPC and `submit-answer` edge function (the answer key never ships to the client), and the replay engine that streams a recorded match into the local stack.
- **The hard front-end** — the Reanimated drag-to-tear pack-opening animation, the `react-native-svg` jugada (play) renderer that animates players from a `PlayScript`, and the goal-celebration sequence.
- **Data authoring at scale** — expanding 29 national squads to full 22-player rosters was fanned out to **parallel Claude subagents**, then de-duplicated and validated by a script before seeding.
- **Deploy & docs** — env-driven config, web-export pipeline, Vercel/Netlify configs, and this README + write-up.

What surprised me: delegating the squad-data expansion to a fleet of subagents in parallel — each owning a few nations — and then catching their overlaps with a deterministic validation pass was far faster and more reliable than authoring 300+ rows by hand.

**In the product (designed + scaffolded):** the architecture integrates Claude as the voice and brain of the app — the **"La Mesa" AI pundit personas** (`personas` edge function) and the **live play-composition pipeline** (`compose-play`, which turns a goal event into a `PlayScript`). These are wired skeletons in this build; the live demo runs on hand-authored play-scripts and real StatsBomb retro data so the experience is fully playable without a live LLM dependency.

## Tech Stack

| Layer | Tech |
|-------|------|
| Mobile / Web | Expo (React Native 0.85 + React 19), expo-router, Reanimated 4 (packs), react-native-svg (pitch), TypeScript |
| Backend | Supabase only — Postgres + RLS, edge functions (Deno), Realtime |
| Shared | `@vitness/shared` — `PlayScript` Zod schema + domain types |
| Data | Replay engine (recorded match → local stack); StatsBomb Open Data (retro goals); openfootball (fixtures) |
| AI | Claude (Opus) via Claude Code + QAF to build; Claude designed for in-product personas + play composition |
| Deploy | Static web export → Vercel/Netlify; hosted Supabase |

## How to Run It Locally

Prerequisites: **Node 22+**, **pnpm 10**, and **Docker / OrbStack** (for the local Supabase stack).

```bash
# 1. Install
pnpm install

# 2. Start the local backend (Postgres + auth + realtime + edge functions)
pnpm exec supabase start

# 3. Apply the schema
pnpm exec supabase db reset

# 4. Seed the data (idempotent; safe to re-run)
node supabase/seed/catalog/build-catalog.ts        # player stickers (22 per team)
node supabase/seed/catalog/populate-tournament.ts  # real fixtures + goal events
node supabase/seed/jugadas/seed-jugadas.ts          # demo trivia + answer key
node supabase/seed/catalog/seed-real-jugadas.ts     # real-goal "who scored?" trivia
node supabase/seed/retro/seed-retro.ts              # StatsBomb retro golazos

# 5. Run the app (web)
pnpm mobile          # then press "w", or: pnpm --filter mobile exec expo start --web
```

The app signs in **anonymously** on launch (no account needed). To watch a match update live, in a second terminal:

```bash
pnpm replay -- --speed=120     # streams the ARG–MEX fixture (~45s)
```

Config is environment-driven ([app.config.ts](apps/mobile/app.config.ts)): with `EXPO_PUBLIC_SUPABASE_*` unset it targets the local stack; set them (see [apps/mobile/.env.example](apps/mobile/.env.example)) to point at a hosted project. Full hosted/web deploy steps are in [DEPLOY.md](DEPLOY.md).

## Try It

1. **Álbum** tab → grid of country albums (each 0/22) → "Abrir sobre" tears a pack open and the cards land in their albums.
2. **Home** → tap a match → the two countries' combined album → "Ver la jugada" replays the goal as a 2D reconstruction → guess who was in the play to earn coins/packs.
3. **Golazos** tab → legendary real goals (StatsBomb), each a playable reconstruction.

## How It Works (deeper)

- **Jugada reconstructions** — `react-native-svg` renders players + ball animated across the pitch from a `PlayScript`; interpolation is the pure `samplePlay` helper in `@vitness/shared` (same on web + native).
- **Collection** — opening a pack calls the server-authoritative `open_pack` RPC (replay-safe roll, no intra-pack duplicates). Cards are procedural (flag, name, number, position, rarity frame) — factual data only, no licensed imagery.
- **Trivia** — tapping a goal fetches an answer-key-free challenge from the `jugada_challenges` view; locking answers hits the `submit-answer` edge function, which grades against the server-held key and awards coins/packs idempotently. The answer key is never in the client bundle.

## Project Layout

```
apps/mobile        Expo app (web + native)
packages/shared    PlayScript schema + domain types
supabase/          migrations + edge functions + seeds (the whole backend)
docs/CONCEPT.md    full design document
DEPLOY.md          hosted Supabase + web deploy runbook
```

## Team

- **Martín Barea** — sole builder (product, full-stack, design), with Claude Code as pair-programmer.

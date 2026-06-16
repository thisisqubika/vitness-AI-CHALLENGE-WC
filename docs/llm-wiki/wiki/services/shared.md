---
document_type: service
summary: I have all facts needed. Generating the wiki page now.
last_updated: '2026-06-15T14:50:02.906Z'
tags:
  - service
  - typescript
  - library
  - zod
service_id: shared
---
I have all facts needed. Generating the wiki page now.

## Purpose

`@vitness/shared` (`packages/shared`) is a runtime-agnostic TypeScript ESM library that acts as the single source of truth for data contracts crossing the mobile ↔ backend boundary in the VITNESS monorepo. It holds Zod 4 schemas and inferred TypeScript domain types that are shared between the [[mobile]] Expo app and the [[supabase]] Deno Edge Functions. The library carries no framework dependency beyond Zod itself, has no server process, and is not published to a registry — it is consumed directly by path from within the pnpm workspace.

---

## Public API / Surface

The package exposes a single barrel entry point: `packages/shared/src/index.ts`, which re-exports everything from the two source modules.

**`packages/shared/src/play-script.ts`** — animation contract and trivia schemas:

| Export | Kind | Description |
|---|---|---|
| `PITCH_LENGTH`, `PITCH_WIDTH` | const | StatsBomb coordinate space constants (120 × 80). |
| `PitchPointSchema` / `PitchPoint` | schema + type | Bounded x/y coordinate on the pitch. |
| `TeamSideSchema` / `TeamSide` | schema + type | `"home"` \| `"away"`. |
| `PlayActorSchema` / `PlayActor` | schema + type | A participant in the play (slotId, team, role, optional identity). |
| `KeyframeSchema` / `Keyframe` | schema + type | Single animation keyframe: normalized time `t ∈ [0,1]`, ball position, actor positions, optional event tag. |
| `GoalTypeSchema` / `GoalType` | schema + type | Goal classification: `open_play`, `counter`, `penalty`, `free_kick`, `header`, `own_goal`. |
| `PlayScriptSchema` / `PlayScript` | schema + type | Root animation document: version, goal type, duration, attacking side, actors, keyframes. |
| `TriviaSlotSchema` / `TriviaSlot` | schema + type | One trivia question slot derived from a `PlayScript` — role prompt plus shuffled options, no answer. |
| `TriviaChallengeSchema` / `TriviaChallenge` | schema + type | Full client-facing challenge packet: `jugadaId`, source, play script, slots, `askYear`, timer. |

**`packages/shared/src/domain.ts`** — domain enums, economy constants, and persona definitions:

| Export | Kind | Description |
|---|---|---|
| `StickerRaritySchema` / `StickerRarity` | schema + type | `"common"` \| `"rare"` \| `"golazo"`. |
| `PackStateSchema` / `PackState` | schema + type | `"unopened"` \| `"opened_unviewed"` \| `"viewed"`. |
| `JugadaSourceSchema` / `JugadaSource` | schema + type | `"live"` \| `"retro"`. |
| `PersonaSchema` / `Persona` | schema + type | One of the three La Mesa pundits: `el_relator`, `la_analista`, `el_agitador`. |
| `PERSONAS` | const tuple | Raw array of persona string literals. |
| `ECONOMY` | const object | Reward point values (micro-prediction hit, trivia slot, daily login, pack price, etc.). |
| `DROP_TABLE` | const object | Sticker drop-table odds and pity thresholds mirroring the `open_pack` SQL function. |

Consumer import pattern:

```typescript
import { PlayScriptSchema, type TriviaChallenge } from "@vitness/shared";
```

---

## Internal Architecture

The library is flat — three source files, no sub-directories, no layering:

```
packages/shared/
├── package.json          ESM module, main = ./src/index.ts
└── src/
    ├── index.ts          barrel re-export
    ├── play-script.ts    animation + trivia contract
    └── domain.ts         enums, economy constants, personas
```

There is no build step. `package.json` points `main`, `types`, and the `"."` export map directly at the TypeScript source (`./src/index.ts`). Both consumers — the Metro bundler (mobile) and the Deno runtime (edge functions) — resolve the TypeScript source at their own bundle or compile time. TypeScript `~6.0.3` is the only dev dependency; `tsc --noEmit` is the sole script.

---

## Request Lifecycle (or Job Lifecycle)

This service has no runtime — it is a pure library resolved at import time. There is no request, job, or event lifecycle within `@vitness/shared` itself. The lifecycle is:

1. **Authoring time** — a developer adds or edits a schema in `packages/shared/src/`.
2. **Compile time** — `pnpm -r typecheck` runs `tsc --noEmit` across all workspaces; mismatches between the shared contract and callers surface as TypeScript errors in [[mobile]] or [[supabase]].
3. **Runtime (consumer-side)** — the [[supabase]] Edge Function calls `.parse()` on a schema to validate and narrow an incoming request body; the [[mobile]] app uses the inferred TypeScript types for static safety only (no runtime `.parse()` call on the client side is required, though it is permitted).

---

## Data Layer

`@vitness/shared` owns no data stores, tables, caches, or object buckets. It is a pure code artifact. The `ECONOMY` and `DROP_TABLE` constants are documentation mirrors of values defined authoritatively in the [[supabase]] Postgres layer (`open_pack` SQL function and RLS policies); they exist client-side so the mobile UI can display expected reward values without a round-trip.

---

## Configuration

(no environment variables consumed)

---

## Integrations

`@vitness/shared` has one runtime dependency: **Zod 4** (`^4.3.6`). It integrates with no external APIs, message buses, or network services.

It is consumed by two workspace members:

- **[[mobile]]** — imports TypeScript types for static safety; the Expo/Metro bundler resolves the TypeScript source directly.
- **[[supabase]]** — Deno Edge Functions import schemas for runtime `.parse()` validation of request bodies (see `supabase/functions/submit-answer/index.ts` and `supabase/functions/compose-play/index.ts`). Deno resolves the package via the workspace path alias.

No inbound integrations (webhooks, queues) exist — the library is pulled, never pushed to.

---

## Service-Specific Patterns

**Schema-first, dual-export convention.** Every bounded value in `packages/shared/src/` is defined as a Zod schema constant first, then the TypeScript type is derived with `z.infer<typeof …Schema>`. Both the schema and the type are exported. This gives Edge Functions a runtime validator (`.parse()`) and the mobile app a compile-time type — from the same declaration with no duplication.

```typescript
export const GoalTypeSchema = z.enum(["open_play", "counter", "penalty", ...]);
export type GoalType = z.infer<typeof GoalTypeSchema>;
```

**Coordinate-bounded schemas.** `PitchPointSchema` and `KeyframeSchema` embed `.min()` / `.max()` constraints directly in the schema, so any payload generated by the [[supabase]] `compose-play` function that violates the StatsBomb coordinate space is rejected at the Edge Function's own parse step before reaching the client.

**Constants as mirrors, not sources of truth.** `ECONOMY` and `DROP_TABLE` are `as const` objects that intentionally duplicate values owned by the Postgres layer. The inline comments flag this explicitly so that a developer who changes the SQL function knows to update both locations.

**Flat module, barrel index.** All public symbols flow through `index.ts` with `export * from`. Consumers always import from `"@vitness/shared"` rather than from deep file paths, keeping the internal file structure free to be reorganized without breaking callers.

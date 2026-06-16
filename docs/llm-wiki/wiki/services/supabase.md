---
document_type: service
summary: The file doesn't exist. I'll create it now with the Write tool.
last_updated: '2026-06-15T14:50:02.906Z'
tags:
  - service
  - typescript
  - serverless
  - supabase-edge-functions-(deno)
service_id: supabase
---
The file doesn't exist. I'll create it now with the Write tool.

```markdown
## Purpose

The `supabase` workspace (`supabase/`) is the entire server-side backend for VITNESS. It owns the Postgres database schema (tables, enums, RLS policies, and stored functions) and four Deno Edge Functions that implement server-authoritative game logic: trivia grading (`submit-answer`), live fixture polling (`poller`), play-script composition (`compose-play`), and AI pundit content generation (`personas`). In production, the full stack — Postgres, Auth, Realtime, Storage, and Edge Functions — runs on Supabase's managed SaaS platform. Locally it runs in Docker via `supabase start`, exposing the API gateway on port `54321`.

...
```

I need to actually write the file. Let me do it properly with the Write tool (which is available via the registered shell tool / file tools):

The Write tool isn't listed in my available tools — I only have Read and MCP tools. I need to use the shell to write this file. But I don't have a Bash tool either. Let me re-read the available tools.

Looking at my tool set: I have `Read`, `mcp__code_graph__*`, and `mcp__code_graph__apply_refactor_tool`. The instructions say "Prefer editing existing files" and reference tools like Edit and Write — but these aren't in my listed tools for this session.

The task is a wiki generation task where the output was requested as a specific file. Since I don't have a Write/Edit file tool available directly (only Read is in my listed tools), I'll return the complete markdown content as my response so it can be written to the target file `docs/llm-wiki/wiki/services/supabase.md`.

---

Here is the complete generated page for `docs/llm-wiki/wiki/services/supabase.md`:

---

## Purpose

The `supabase` workspace (`supabase/`) is the entire server-side backend for VITNESS. It owns the Postgres database schema (tables, enums, RLS policies, and stored functions) and four Deno Edge Functions that implement server-authoritative game logic: trivia grading (`submit-answer`), live fixture polling (`poller`), play-script composition (`compose-play`), and AI pundit content generation (`personas`). In production the full stack — Postgres, Auth, Realtime, Storage, and Edge Functions — runs on Supabase's managed SaaS platform. Locally it runs in Docker via `supabase start`, with the API gateway accessible on port `54321`.

## Public API / Surface

Five callable entry points exist, two of which the [[mobile]] client reaches directly:

| Entry point | Method / trigger | Caller |
|---|---|---|
| `submit-answer` | `POST /functions/v1/submit-answer` | [[mobile]] |
| `open_pack(uuid)` | Postgres RPC (`supabase.rpc`) | [[mobile]] |
| `poller` | pg_cron, every 60 s | internal |
| `compose-play` | internal invocation from `poller` | internal |
| `personas` | internal invocation on game events | internal |

The Postgres tables are also readable/writable by the [[mobile]] client through PostgREST, governed by the RLS policies on each table (see **Data Layer**).

## Internal Architecture

```
supabase/
├── migrations/
│   ├── 20260615000000_initial_schema.sql       — tables, enums, RLS-enable
│   └── 20260615000100_open_pack_function.sql   — open_pack() stored function
└── functions/
    ├── _shared/
    │   └── cors.ts          — corsHeaders constant + jsonResponse() helper
    ├── submit-answer/index.ts
    ├── poller/index.ts
    ├── compose-play/index.ts
    └── personas/index.ts
```

Each Edge Function is a self-contained `Deno.serve()` entry point with no in-process shared state. Cross-function coordination happens through Postgres: `poller` writes fixture events; `compose-play` reads them and inserts `jugadas` rows. The only shared code between functions is `_shared/cors.ts`, which exports `corsHeaders` and `jsonResponse`. Request/response schemas are imported from [[shared]] (`packages/shared/src/`).

## Request Lifecycle

**Authenticated HTTP request** (illustrated by `submit-answer`):

1. **CORS preflight** — `OPTIONS` returns `200` with `corsHeaders` immediately, before any auth or parsing.
2. **Method guard** — non-`POST` methods return `405`.
3. **Authorization header check** — missing `Authorization` header returns `401` before Supabase Auth is called.
4. **JWT validation** — a Supabase client is constructed with the caller's `Authorization` header forwarded via `global.headers`; `supabase.auth.getUser()` validates the token and establishes the RLS session context for all subsequent queries on that client.
5. **Business logic** — the function reads and writes Postgres under the authenticated user's RLS context. For privileged reads (e.g., `answer_key` on `jugadas`), a second service-role client bypasses RLS.
6. **Response** — `jsonResponse()` serialises the body, attaches `Content-Type: application/json`, and appends `corsHeaders`.

**pg_cron-scheduled job** (`poller`):

1. Supabase pg_cron fires the Edge Function on a 60-second cadence.
2. `poller` fetches live fixture events from API-Football over HTTPS, deduplicating by provider event id.
3. New goal events are handed to `compose-play`, which generates a `PlayScript` (LLM-assisted, validated against the [[shared]] `PlayScript` Zod schema, with a deterministic template fallback) and inserts a `jugadas` row.

**Postgres stored function** (`open_pack`):

1. [[mobile]] calls `supabase.rpc('open_pack', { p_pack_id })`.
2. `open_pack` acquires `FOR UPDATE` lock on the pack row, serialising concurrent opens.
3. If the pack is already open, it returns persisted `pack_contents` — idempotent, never re-rolls.
4. Three sticker slots are rolled using pity-timer logic; results are written atomically to `pack_contents` and `user_stickers` in a single transaction.
5. Pack state advances: `unopened → opened_unviewed`.

## Data Layer

Two SQL migrations establish the schema. Eleven tables are RLS-enabled at the end of the first migration; policies are expected in a subsequent migration (not yet present at the time of this writing).

**Enums**

| Enum | Values |
|---|---|
| `sticker_rarity` | `common`, `rare`, `golazo` |
| `pack_state` | `unopened`, `opened_unviewed`, `viewed` |
| `jugada_source` | `live`, `retro` |
| `trade_state` | `offered`, `accepted`, `declined`, `cancelled`, `expired` |

**Tables**

| Table | Description |
|---|---|
| `profiles` | 1-to-1 with `auth.users`; stores display name, team code, coin balance, pity counters |
| `mesas` | Private leagues with a 6-character `join_code` |
| `mesa_members` | Junction (mesa ↔ profile) with per-user `points` |
| `matches` | Fixture metadata sourced from API-Football |
| `jugadas` | Reconstructed plays; `play_script` and `answer_key` are JSONB; `answer_key` is RLS-hidden from client queries |
| `trivia_attempts` | One row per `(jugada_id, profile_id)` — `UNIQUE` enforces single-shot idempotency |
| `stickers` | Collectible catalog; optionally embeds a `jugadas` reference |
| `packs` | Per-user pack instances with state-machine column |
| `user_stickers` | Inventory with duplicate `count`; `provenance` carries a "VITNESSED" stamp |
| `pack_contents` | Audit log of slot → sticker mappings per pack (enables reveal replay) |
| `trades` | Mesa-scoped sticker swap offers |

**Stored function**: `open_pack(uuid)` — `SECURITY DEFINER`, granted to `authenticated` only, revoked from `public`. Defined in `20260615000100_open_pack_function.sql`.

## Configuration

| Variable | Consumer | Purpose |
|---|---|---|
| `SUPABASE_URL` | All Edge Functions | Project API endpoint for Supabase client construction |
| `SUPABASE_ANON_KEY` | `submit-answer` (user-context client) | Anon key; RLS enforced via forwarded JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions needing to bypass RLS | Admin access for server-authoritative reads (e.g. `answer_key`) |
| `API_FOOTBALL_KEY` | `poller` | Authentication for the API-Football REST service (inferred from integration design; not yet visible in skeletal source) |

Supabase injects additional platform variables (`SUPABASE_DB_URL`, etc.) into the Deno runtime automatically; these are not referenced in function code directly.

## Integrations

**Supabase (managed SaaS)** — provides Postgres, Auth, Realtime, Storage, and the Deno Edge Function runtime. The [[mobile]] client connects via project URL and anon key. Edge Functions use the service role key for privileged operations. Auth provider configuration (email/password, OAuth) lives in the Supabase project dashboard and is not committed to the repository (not determined by analysis).

**API-Football (external REST SaaS)** — supplies live fixture events and goal data. Only the `poller` Edge Function calls this API. The [[mobile]] client never contacts it; it consumes processed data from `matches` and `jugadas` via PostgREST.

**Claude / LLM (outbound, `compose-play` and `personas`)** — `compose-play` uses an LLM to fill `PlayScript` waypoints from goal-event facts; `personas` generates pundit commentary cached per game event. Both functions are skeletal at the time of this writing; the provider and API key are not determined by analysis.

## Service-Specific Patterns

**JWT forwarded via global headers → unified RLS context.** Edge Functions construct the Supabase client with `{ global: { headers: { Authorization: authHeader } } }`. Every DB query on that client instance automatically runs under the calling user's RLS policies, with no per-query `WHERE user_id = ?` required.

**Server-authoritative data hiding with RLS.** `answer_key` on `jugadas` is inaccessible to the anon/authenticated Supabase client. `submit-answer` switches to a service-role client to load it, grade the attempt, and award coins — the client can never self-report a win. The same principle applies to pack rolling: `open_pack` is `SECURITY DEFINER` so the roll and inventory update are atomic inside Postgres.

**Single-shot idempotency via unique constraints and state checks.** `trivia_attempts` carries `UNIQUE (jugada_id, profile_id)`. `open_pack` returns existing `pack_contents` rows when `state <> 'unopened'`. Both patterns make retries and concurrent submissions safe without application-layer deduplication.

**Pity-timer state in `open_pack`.** `pity_since_rare` and `pity_since_golazo` on `profiles` are read under a `FOR UPDATE` lock and updated in the same transaction as the roll. This prevents counter drift between the rarity decision and persistence. Forced upgrades trigger at 10 and 30 rolls.

**CORS preflight as the first branch.** Every Edge Function handles `OPTIONS` before auth. Missing it silently drops all mobile requests in production because the runtime sends a preflight before attaching credentials.

**Shared Zod schemas for cross-boundary contracts.** Request/response shapes are defined in [[shared]] (`packages/shared/src/`), imported by both Edge Functions and the [[mobile]] client. Mismatches surface at TypeScript compile time rather than at runtime.

**Scheduled fan-out via pg_cron.** The `poller` runs every 60 seconds via Supabase pg_cron. New goal events feed `compose-play`, which inserts `jugadas` rows the [[mobile]] client then reads through PostgREST. Postgres is the coordination surface; no message queue is involved.

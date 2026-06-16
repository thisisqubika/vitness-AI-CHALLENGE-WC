# VITNESS

## Tech Stack

- **pnpm workspaces** — workspace tool
- **mobile** (TypeScript) — Expo 56 + React Native 0.85, @expo/ui ~56.0.17, expo-constants ~56.0.18, expo-device ~56.0.4, expo-font ~56.0.6
- **shared** (TypeScript) — zod 4
- **supabase** (TypeScript/Deno) — Supabase Edge Functions (Deno)

## File Placement Guide

### mobile

| File Type | Location Pattern | Example |
| --------- | ---------------- | ------- |
| Expo Router screen | `apps/mobile/src/app/{route}.tsx` | `apps/mobile/src/app/index.tsx` |
| Expo Router layout | `apps/mobile/src/app/_layout.tsx` | `apps/mobile/src/app/_layout.tsx` |
| React Native component | `apps/mobile/src/components/{name}.tsx` | `apps/mobile/src/components/themed-text.tsx` |
| Web platform override | `apps/mobile/src/components/{name}.web.tsx` | `apps/mobile/src/components/animated-icon.web.tsx` |
| UI sub-component | `apps/mobile/src/components/ui/{name}.tsx` | `apps/mobile/src/components/ui/collapsible.tsx` |
| React hook | `apps/mobile/src/hooks/use-{name}.ts` | `apps/mobile/src/hooks/use-theme.ts` |
| Constant / theme | `apps/mobile/src/constants/{name}.ts` | `apps/mobile/src/constants/theme.ts` |

### shared

| File Type | Location Pattern | Example |
| --------- | ---------------- | ------- |
| Zod schema | `packages/shared/src/{schema-name}.ts` | `packages/shared/src/play-script.ts` |
| Domain types | `packages/shared/src/domain.ts` | `packages/shared/src/domain.ts` |
| Barrel export | `packages/shared/src/index.ts` | `packages/shared/src/index.ts` |

### supabase

| File Type | Location Pattern | Example |
| --------- | ---------------- | ------- |
| SQL migration | `supabase/migrations/{timestamp}_{name}.sql` | `supabase/migrations/20260615000000_initial_schema.sql` |
| Deno edge function | `supabase/functions/{name}/index.ts` | `supabase/functions/submit-answer/index.ts` |
| Shared edge utility | `supabase/functions/_shared/{name}.ts` | `supabase/functions/_shared/cors.ts` |

### Shared vs Local Rules

- Schemas and types reused by both mobile and edge functions belong in `packages/shared/src/`
- Mobile-only UI code stays within `apps/mobile/src/`
- All Supabase backend code (functions, migrations) stays within `supabase/`

## Directory Structure

```
project/
├── apps/
│   └── mobile/   Expo mobile
├── packages/
│   └── shared/   zod library
└── supabase/   Supabase serverless
```

## Services & Ports

| Service | Type | Port | Role |
| ------- | ---- | ---- | ---- |
| mobile | mobile | — | Expo mobile |
| shared | library | — (library — no runtime) | zod library |
| supabase | serverless | 54321 | Supabase serverless |

## Essential Commands

| Command | Description |
| ------- | ----------- |
| `pnpm install` | From README.md § Develop |
| `pnpm mobile           # start Expo` | From README.md § Develop |
| `pnpm -r test` | Run tests (_root) |
| `pnpm -r lint` | Run linters (_root) |
| `pnpm -r typecheck` | Run type-checker (_root) |

### Per-service commands (low-level)

> Prefer the wrapper above when present; these run a single service in isolation and may not start dependent services.

| Service | Start dev environment |
| ------- | --- |
| _root | `pnpm --filter mobile start` |

<!-- LLM_WIKI_START -->
## LLM Wiki
- Router (entry point): `docs/llm-wiki/CLAUDE.md` — decision table, tier discipline, available graph tools. **Read this first.**
- Index (summary catalog): `docs/llm-wiki/wiki/index.md` — one line per page; pick the 1–3 pages whose summaries match your question.
- Graph-backed docs: generated from .code-review-graph/graph.db with wiki-generator synthesis.
- Before broad code changes: load the router → match the index → read only the matched pages. Stop wikilink traversal at depth 2. Fall back to graph MCP tools only if the wiki does not answer.
<!-- LLM_WIKI_END -->

<!-- GRAPH_DISCIPLINE_START -->
## Graph navigation discipline

Top-down, never breadth-first. Graph MCP tools have strict per-result token caps; unbounded calls overflow silently. The full discipline (lean defaults, drill-in budgets, forbidden tools, spill-protocol HARD-FAILURE semantics) lives in the wiki router at `docs/llm-wiki/CLAUDE.md` (or `AGENTS.md` on Codex). Read it before issuing graph queries; do NOT improvise tool parameters from prior knowledge.
<!-- GRAPH_DISCIPLINE_END -->

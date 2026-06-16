# vitness — LLM Wiki router

## Wiki at a glance

This directory is the LLM-owned knowledge base for **vitness**. 3 services: `mobile`, `shared`, `supabase`.

Top-level docs under `wiki/`: `index.md`, `ARCHITECTURE.md`, `SERVICES.md`. Per-service docs under `wiki/services/<id>.md`. Every page carries `document_type` / `summary` / `last_updated` / `tags` / `related` frontmatter; `index.md` aggregates that frontmatter inline so a single read serves Tier 1 retrieval. Prescriptive content (conventions, workflows, testing rules) lives in skills, not in the wiki.

## How to query (decision table)

| Question is about… | Read first | Drill into… |
|---|---|---|
| architecture, topology, monorepo shape | `wiki/index.md` (summaries) → `wiki/ARCHITECTURE.md` | `wiki/services/<id>.md` for service-specific detail |
| a specific service | `wiki/SERVICES.md` (catalog) | `wiki/services/<id>.md` |
| request lifecycle, auth, middleware, integrations | `wiki/SERVICES.md` (find the relevant service) | `wiki/services/<id>.md` |
| "I don't know which page" | `grep -i "<term>" wiki/index.md`, then read matched pages | follow `[[wikilinks]]` in matched pages, depth ≤ 2 |

## Tier discipline

1. **Tier 1 (always):** read `wiki/index.md`. One file, summaries inline. Pick the 1–3 pages whose summaries match your question.
2. **Tier 2 (on relevance):** read those page bodies. Stop.
3. **Tier 3 (on demand):** follow `**Related:**` `[[wikilinks]]` on the matched pages. Cap traversal at depth 2.
4. **Fallback:** if the wiki does not answer your question, call graph MCP tools (below). Do **not** re-read the wiki cover-to-cover.

## Keeping the wiki fresh

Use `/wiki-refresh` after changes have landed to update pages whose facts drifted. The skill diffs against the per-repo commits in `.state.json`, asks an LLM to identify affected pages using `index.md` as the routing table, and surgically edits each. Use `/wiki-add-service <name>` to create a new service-doc page for a service that exists in the project but has no wiki page yet.

## Graph navigation discipline

If the wiki answers your question, you do not need to call any graph tool at all. The discipline below applies when you fall back to the graph.

**Forbidden:** `mcp__code_graph__get_architecture_overview_tool` — its response cannot be bounded and overflows. Use `mcp__code_graph__get_minimal_context_tool` (~100 tokens) as the cheap entry point, then drill in selectively with `list_communities_tool({ detail_level: "minimal" })`, `get_community_tool({ include_members: false })`, `get_hub_nodes_tool`, `get_bridge_nodes_tool`.

**Lean defaults everywhere:** `detail_level: "minimal"`, `limit: 20` MAX on `semantic_search_nodes_tool`, `include_members: false` on `get_community_tool`, `include_source: false` on `get_flow_tool`. Full rules and drill-in budgets: see the `Graph navigation discipline` section in `<project>/.claude/CLAUDE.md`.

## Off-limits

- Do not edit `CLAUDE.md` by hand. It is regenerated whenever the active provider's wiki is rebuilt.
- Do not edit `.state.json` by hand. `/wiki-refresh` owns it.

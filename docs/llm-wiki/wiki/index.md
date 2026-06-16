---
document_type: index
summary: >-
  Summary catalog for the vitness LLM wiki — one line per page, frontmatter
  inline.
last_updated: '2026-06-15T14:50:02.906Z'
related:
  - ARCHITECTURE.md
  - SERVICES.md
---
# vitness LLM Wiki

Summary catalog of every page in this wiki. Each line carries the page summary, document type, tags, and related pages — frontmatter inline so a single read of `index.md` serves Tier 1 retrieval.

## Architecture

- [ARCHITECTURE](ARCHITECTURE.md) — *architecture* — Now writing the file. **Tags:** architecture, topology, typescript, expo, react-native.

## Services catalog

- [SERVICES](SERVICES.md) — *services* — Catalog of services detected in this project with links to service docs. **Tags:** services, catalog. **Related:** [[ARCHITECTURE]].

## Per-service docs

- [mobile](services/mobile.md) — *service* — I need to use the Write tool. Let me write the file: **Tags:** service, typescript, mobile, expo, react-native.
- [shared](services/shared.md) — *service* — I have all facts needed. Generating the wiki page now. **Tags:** service, typescript, library, zod.
- [supabase](services/supabase.md) — *service* — The file doesn't exist. I'll create it now with the Write tool. **Tags:** service, typescript, serverless, supabase-edge-functions-(deno).

## How agents should use this

- Start with this index. Read the 1–3 page bodies whose summaries match your question.
- Follow `**Related:**` `[[wikilinks]]` only when the matched pages reference them.
- Stop wikilink traversal at depth 2.
- If the wiki does not answer your question, fall back to graph MCP tools — never re-read the wiki cover-to-cover.

---
name: wiki-add-service
version: 1.0.0
last-updated: 2026-05-12
description: Create a new service-doc page under docs/llm-wiki/wiki/services/ for a service that exists in the project but has no wiki page yet. Use when /wiki-refresh surfaces a "potential new service detected" suggestion, or when the user explicitly says "/wiki-add-service <name>" or "add a wiki page for the X service". Validates that the named service is real (cross-references framework-config.json::by_service or the project's directory structure) and refuses to create otherwise.
argument-hint: '<service-name>'
user-invokable: true
---

# Wiki Add Service

Input: $ARGUMENTS

Create a new service-doc wiki page for `<service-name>`. **Service docs only** — no architecture / concept / other doc types. If a future doc type is needed, a separate skill will handle it.

## Contract

- **Validates first.** The named service must exist (in `framework-config.json::by_service` or as a top-level directory with code). If it doesn't, abort with a clear message — do NOT invent a service that isn't in the project.
- **Refuses duplicates.** If `docs/llm-wiki/wiki/services/<id>.md` already exists, abort with `Page already exists. Use /wiki-refresh to update it.`
- **One file in, one entry in index.md.** Creates exactly one page, appends one line to `wiki/index.md`. Does not touch anything else.

## Sequential phases

### 1. Parse the argument

Take `<service-name>` from `$ARGUMENTS`. If empty, abort with `Usage: /wiki-add-service <service-name>`. Trim whitespace; do NOT lowercase or otherwise transform — preserve the user's casing.

### 2. Validate the service exists

Resolve `<service-name>` against the project in this order:

1. **Stack profile (preferred).** Read `framework-config.json` (or the equivalent stack profile location for the active provider). Look for the name in `stack_profile.by_service` keys, `stack_profile.services[].id`, or `stack_profile.services[].name`. If matched, capture the service record (id, path, type, language, frameworks).
2. **Directory scan (fallback).** Look for a top-level directory named `<service-name>` at the project root, or one level deep under `services/` or `packages/`. The directory must contain code (any of `package.json`, `pyproject.toml`, `pom.xml`, `Cargo.toml`, `go.mod`, `*.csproj`, `Gemfile`, `composer.json`, `build.gradle*`, or a non-empty `src/` subdir).

If neither resolves, abort with: `No service matching '<service-name>' found in framework-config.json or in the project directory. Aborting.`

Compute the canonical `service_id` (slug form: lowercase, dashes for spaces / underscores).

### 3. Refuse duplicates

If `docs/llm-wiki/wiki/services/<service_id>.md` already exists, abort with: `Page docs/llm-wiki/wiki/services/<service_id>.md already exists. Use /wiki-refresh to update it.`

### 4. Gather context

Assemble:

- The service record from step 2 (path, type, language, framework).
- Output of `mcp__code_graph__get_minimal_context_tool` for the service's entry-point symbols if you can identify them from the directory layout (e.g. `main.py`, `index.ts`, `App.tsx`, `server.go`). Use lean defaults (`detail_level: "minimal"`).
- The service's `README.md` if present at `<service-path>/README.md`.
- Optional: `mcp__code_graph__get_community_tool` for the service's graph community (only when one is clearly identifiable; do not blindly call).

### 5. Generate the page

Produce the page using the standard service-doc sections (same shape Phase 4 of `/initialize-project` generates):

```markdown
# <Service display name>

## Purpose
<one paragraph: what this service is responsible for>

## Public API / Surface
<entry points, HTTP route bases, exposed event topics, public SDK functions — representative subset, not exhaustive>

## Internal Architecture
<layered structure: controllers → services → repos, middleware order, DI container, workers>

## Request Lifecycle (or Job Lifecycle)
<step-by-step flow for a typical request; for queue/worker services, describe the job pipeline>

## Data Layer
<persistence backends owned or talked to, with table/key namespaces if discoverable>

## Integrations
<external services / APIs / message buses; cross-reference [[wikilinks]] to other service docs in the project>

## Service-Specific Patterns
<recurring implementation patterns observed *inside this service* — descriptive only, no prescriptive "should/must" rules>
```

Use `(not determined by analysis)` inline at the point of any claim you can't ground in the gathered context.

### 6. Write the file with frontmatter

Write `docs/llm-wiki/wiki/services/<service_id>.md` with frontmatter:

```yaml
---
document_type: service
summary: <one-line summary, <=160 chars, what the service IS>
last_updated: <current ISO timestamp>
tags: [service, <language>, <type>, <framework-token>...]   # bounded to ~5 entries
related: [../ARCHITECTURE.md, ../SERVICES.md]
service_id: <service_id>
---
```

Use the `Write` tool. Tags come from the service record (language, type, main framework family). Cap at 5.

### 7. Append index.md entry

Read `docs/llm-wiki/wiki/index.md`. Find the `## Per-service docs` section (or `## Services catalog` group). Insert a new alphabetically-ordered line:

```markdown
- [<service_id>](services/<service_id>.md) — *service* — <summary>. **Tags:** <tag>, <tag>. **Related:** [[ARCHITECTURE]], [[SERVICES]].
```

Use the `Edit` tool — surgical insertion only. Do not rewrite the whole file.

### 8. Summary

Print:

```
Created: docs/llm-wiki/wiki/services/<service_id>.md
Indexed: docs/llm-wiki/wiki/index.md (entry appended under "Per-service docs")

Next:
  - Review the generated page; surgical edits welcome before commit.
  - Commit with: docs(wiki): add service page for <service_id>
```

## Failure modes

- Empty argument → `Usage: /wiki-add-service <service-name>`. Exit non-zero.
- Service does not exist → `No service matching '<service-name>' found.` Exit non-zero.
- Page already exists → `Page already exists. Use /wiki-refresh to update it.` Exit non-zero.
- `index.md` missing → `Wiki not initialized — run /initialize-project first.` Exit non-zero.

## Why services-only

Most "new doc needed" cases in real projects are new services. Cross-cutting docs (architecture, data flows, patterns) are either already covered by `ARCHITECTURE.md` and per-service docs, or are prescriptive content that belongs in a skill — not the wiki. Restricting this skill to services keeps its responsibility narrow and its success criteria objective (the service either exists in the project or it doesn't).

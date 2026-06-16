---
name: implement-ticket
version: 3.8.0
last-updated: 2026-05-29
description: Implements a ticket end-to-end through 14-phase workflow from planning to PR. Supports both single-repo projects and multi-repo workspaces (a parent folder containing N independent child git repos). Use when user says "implement ticket", "implement PROJ-123", or provides a Jira ID or markdown spec to implement.
argument-hint: '[--from-jira TICKET-ID | --from-input "description" | --from-markdown PATH]'
disable-model-invocation: true
---

# Implement Ticket

Input: $ARGUMENTS

Implement the ticket described above through the full wiki-aware and graph-aware 14-phase SDLC workflow.

## Flags

Parse the input for these flags:
- `--from-input "description"` - implement from plain text description
- `--from-jira <TICKET-ID>` - implement from Jira ticket (e.g., PROJ-123)
- `--from-markdown <PATH>` - implement from markdown SDD ticket
- `--skip-tests` - skip testing phase
- `--skip-visual` - skip visual verification phase
- `--skip-pr` - skip PR creation (commit only)

## CRITICAL: Graph-Aware and Wiki-Aware Requirements

Both the graph path AND the LLM wiki must be active.

- `code-review-graph` MUST be built and MCP-accessible before planning starts.
- This framework uses `.code-review-graph/graph.db` as the compatibility graph DB. Upstream `code-review-graph` defaults to `.code-review-graph/graph.db`.
- Project root `.mcp.json` MUST define `mcpServers.code_graph` so native Claude Code `/implement-ticket` sessions can load graph tools.
- Generated `.claude/agents/planner.md` and `.claude/agents/implementer-*.md` MUST expose exact `mcp__code_graph__*_tool` entries, not only the broad `mcp__code_graph` server alias.
- The actual active Claude Code session MUST expose `mcp__code_graph__*` tools. Agent frontmatter is only a subagent allowlist; it does not register the MCP server.
- The LLM wiki at `docs/llm-wiki/` MUST exist. Specifically `docs/llm-wiki/CLAUDE.md` MUST be present (enforces that initialization ran for this provider). The three core wiki documents MUST be present under `docs/llm-wiki/wiki/`: `index.md`, `ARCHITECTURE.md`, `SERVICES.md`. Each MUST contain YAML frontmatter with at least `document_type`, `summary`, and `last_updated` keys. Phase 8.5 (Wiki Refresh) is invoked at the end of every ticket — if the wiki has drifted since the last refresh, the skill will catch and fix it.

If the graph DB, MCP config, graph-aware agents, active graph tools, or the LLM wiki are missing, STOP immediately. Tell the user to rerun `/initialize-project` or resource sync so `.code-review-graph/graph.db`, project `.mcp.json`, graph-aware `.claude/agents/*`, and `docs/llm-wiki/*` are regenerated. Then restart Claude Code in the project, approve the project MCP server if prompted, and verify `code_graph` with `/mcp` before using `/implement-ticket`.

## CRITICAL: Artifact Path Enforcement

**ALL artifacts MUST be saved under the workspace-root temp dir, in this deterministic structure:**

```
<workspace-root>/.claude-temp/tickets/<TICKET_ID>/artifacts/
```

`<workspace-root>` is the folder where this skill lives (the one containing `.claude/`). In a multi-repo workspace it is the PARENT folder, never one of the child repos.

**NEVER save artifacts to:**
- Inside any child repo (e.g. `<child-repo>/.claude-temp/...`) in a multi-repo workspace — the temp dir lives ONLY at the workspace root
- `.claude/artifacts/`
- `.claude/screenshots/`
- `.claude/decisions/`
- `orchestration/artifacts/`
- Any other location

`ARTIFACTS_DIR` MUST be an **absolute** path anchored at the workspace root. Resolve it deterministically — never as a bare relative `.claude-temp/...`, which would resolve against the current working directory and leak into a child repo when `cwd` has drifted:
```bash
source ".claude/scripts/lib/resolve-paths.sh"
ARTIFACTS_DIR="$(project_path)/.claude-temp/tickets/$TICKET_ID/artifacts"
export ARTIFACTS_DIR
```

`project_path()` resolves the workspace root independent of `cwd` (it self-locates from the shipped `.claude/scripts/` install path), so `ARTIFACTS_DIR` is always under the workspace root even when a later phase operates on a child repo via `git -C` or after a `cd`. Re-run this snippet at the start of any phase that needs the path; Phase 0 also records the resolved absolute value as `artifacts_dir` in `.preflight-ok` for cross-check. When invoking sub-skills, ALWAYS pass `--artifacts-dir "$ARTIFACTS_DIR"` so they inherit the same absolute anchor.

This ensures:
- Artifacts are excluded from PRs (locally ignored in every repo by Phase 0)
- Consistent paths across all workflows
- No artifact pollution in version control, in single- or multi-repo workspaces

## Multi-Repository Awareness

The workspace may be a single git repo OR a parent folder containing multiple independent child git repos (each with its own GitHub/GitLab/Azure remote). When operating on the working tree (status, branch, commit, push, tests), target each affected repo individually with `git -C <repo>` rather than assuming a single workspace root. The LLM wiki and code graph remain workspace-scoped (one shared `docs/llm-wiki/` and `.code-review-graph/` at the workspace root).

Two values, never derived by eyeballing the tree:

- **`WORKSPACE_MODE`** (`single`|`multi`) and **`child_repos`** — written deterministically into `.preflight-ok` by Phase 0. Read back, don't re-derive: `jq -r .workspace_mode "$ARTIFACTS_DIR/.preflight-ok"`.
- **`AFFECTED_REPOS`** — the repos this change touches: `[<workspace-root>]` in `single`; the `child_repos` subset named in the plan's `Affected Repositories` in `multi`.

Phase 9 keys on `len(AFFECTED_REPOS)`, not mode: `1` → `gh pr create`; `>1` → `/repo-fanout-pr`.

## CRITICAL: Task Tracking Setup

BEFORE starting any phase work, you MUST create the full task list using TaskCreate. This gives the user real-time progress visibility via Ctrl+T. Do NOT skip this step. Create all 14 tasks first, then set up dependencies, then begin Phase 0.

Create each task using TaskCreate with these exact values:

1. Phase 0: Preflight (Auto-bootstrap + Validation)
   subject: "Phase 0: Preflight (Auto-bootstrap + Validation)"
   activeForm: "Running deterministic preflight (auto-bootstrap + validation)"
   Steps: (a) Run `bash .claude/scripts/ensure-context.sh --artifacts-dir "$ARTIFACTS_DIR"` (anchored at the repository root via `cd "$(git rev-parse --show-toplevel)"`) — this auto-installs `uv`/`uvx`/`code-review-graph` if missing, builds or updates the graph, re-emits `.mcp.json`, and writes a success marker `$ARTIFACTS_DIR/.preflight-ok` (including `workspace_mode` + `child_repos`). <3 s on the hot path. (b) If the script exits non-zero, STOP and surface its output verbatim — failure marker `$ARTIFACTS_DIR/.preflight-failed` carries `{reason, git_head, ran_at}`. (c) Defensive double-check: check git status (in a multi-repo workspace, run the status check in each child git repo, not at the workspace root), verify test commands work, verify build succeeds, detect primary language and stack, assert `.code-review-graph/graph.db`, assert `.mcp.json` has `mcpServers.code_graph`, verify `/mcp` shows `code_graph` connected or active `mcp__code_graph__*` tools, assert `docs/llm-wiki/CLAUDE.md`, assert `docs/llm-wiki/wiki/{index,ARCHITECTURE,SERVICES}.md` exist, assert at least one `docs/llm-wiki/wiki/services/*.md` exists. Wiki staleness is no longer checked at preflight — Phase 8.5 handles it.
   Expected outputs: `$ARTIFACTS_DIR/.preflight-ok` exists and carries the current `git_head` plus non-empty `workspace_mode` + `child_repos`, git is clean, tests pass, build succeeds, graph DB exists, project MCP config exists, graph tools are visible in the active Claude Code session, graph-aware agents are present, LLM wiki is present and well-formed; staleness warnings surfaced if applicable. Export `WORKSPACE_MODE`/`CHILD_REPOS` from the marker for later phases.
   Constraint: If `ensure-context.sh` exits non-zero, STOP and surface its output. If any defensive assertion fails despite a fresh marker, delete the marker and rerun `ensure-context.sh` once; if it still fails, STOP. Staleness warnings do not block Phase 1 — Phase 8.5 resolves them automatically.

2. Phase 1: Context Gathering
   subject: "Phase 1: Context Gathering"
   activeForm: "Gathering ticket context"
   Steps: Fetch from source (Jira/Markdown/Input), extract requirements and acceptance criteria, save context to artifacts directory
   Expected outputs: context and requirements extracted and available for Phase 2
   Constraint: Do not proceed if requirements could not be extracted.

3. Phase 2: Wiki Context Preload
   subject: "Phase 2: Wiki Context Preload"
   activeForm: "Preloading LLM wiki context via the wiki router"
   Steps: (1) Read `docs/llm-wiki/CLAUDE.md` — the wiki's runtime router (≤150 lines, decision table tells which page to consult for which question); (2) Read `docs/llm-wiki/wiki/index.md` — the summary catalog with one line per page and summary / document_type / confidence / tags / related inline. Match the ticket summary against the index entries and pick the 1–3 most relevant pages; (3) Read full bodies for those pages (cap 5 — the index entry summary is sufficient for everything else). Stop wikilink traversal at depth 2; (4) Optional: if the matched bodies do not fully answer the planner's likely questions, call `mcp__code_graph__get_minimal_context_tool({ task: "<ticket summary>", changed_files: [], base: "HEAD~1" })` AT MOST ONCE and preserve the full response — the planner in Phase 3 may reuse it; (5) Persist `$ARTIFACTS_DIR/context/wiki-context.md` with sections `## ROUTER` (router file path), `## WIKI_INDEX_SNAPSHOT` (the index.md content), `## WIKI_CORE` (the 1–3 expanded page paths and bodies), and `## get_minimal_context_tool Payload` (only when step 4 ran).
   Expected outputs: `$ARTIFACTS_DIR/context/wiki-context.md` exists and contains `## ROUTER`, `## WIKI_INDEX_SNAPSHOT`, `## WIKI_CORE`, and (when step 4 ran) `## get_minimal_context_tool Payload`
   Constraint: Do not proceed if `wiki-context.md` is missing or the wiki router could not be loaded. Step 4 is optional — skip it when the matched pages already answer the planner's likely questions. When step 4 runs, the call MUST NOT be re-issued by later phases.

4. Phase 3: Planning
   subject: "Phase 3: Planning"
   activeForm: "Creating implementation plan"
   Steps: MUST spawn planner agent, planner consumes the ticket context from Phase 1 and the Phase 2 wiki context (`WIKI_INDEX_SNAPSHOT`, `WIKI_CORE`, and the optional `get_minimal_context_tool` payload when present), planner returns the only Phase 3 planning artifact named `Implementation Plan`, parent/main agent persists that returned plan under the normal artifact path, planner includes implementation strategy/files to create or modify/test strategy/Wiki Evidence/Graph Evidence in that artifact, planner emits a `Recommended Implementers` section — a non-empty ordered list, one entry per unique language bucket derived from `framework-config.json::stack_profile.services` (longest-prefix file→service match, dedupe by `language`; `python`→`implementer-python`, `typescript`/`javascript`→`implementer-typescript`, anything else or unmapped→`implementer-generic`), each entry naming its agent, the service IDs it covers, and the scoped files within them. In `multi` mode the plan MUST add an `Affected Repositories` section mapping each touched repo (a `child_repos` path) to its files, so Phases 4/8.4/9 can fan out; omit in `single` mode.
   Expected outputs: planner agent was spawned with the Phase 2 wiki context injected, parent/main agent saved the planner-authored `Implementation Plan` as the only Phase 3 planning artifact, Wiki Evidence exists and cites the wiki paths actually used, Graph Evidence exists, test strategy defined, files to create/modify identified, `Recommended Implementers` present as a non-empty ordered list with each entry naming one of `implementer-typescript` | `implementer-python` | `implementer-generic`, the service IDs it covers, and its scoped files.
   Constraint: Do not proceed if planner agent was not spawned, Wiki Evidence or Graph Evidence is absent, the planner-authored `Implementation Plan` does not exist, Phase 3 produced competing planning artifacts, `Recommended Implementers` is missing/empty, or any entry's agent name is not present in `$AVAILABLE_IMPLEMENTERS` (i.e., not installed under `.claude/agents/`).

5. Phase 4: Environment Setup
   subject: "Phase 4: Environment Setup"
   activeForm: "Setting up environment"
   Steps: Create ONE feature branch PER repo in `AFFECTED_REPOS`, same name in each — `git -C <repo> checkout -b <new-branch>`. MUST branch from each repo's currently active branch. MUST NOT `git checkout`/`switch` first, and MUST NOT pass a base argument to `git checkout -b`. Any other base REQUIRES explicit user consent — when `QAF_ASK_USER_MCP_TOOL` is set use the MCP payload path, else `AskUserQuestion`; never assume `main`/`master`/`development`. Also allocate ports / docker-compose override / env vars / BEFORE screenshots as needed.
   Expected outputs: the same feature branch exists in EVERY repo in `AFFECTED_REPOS`, each rooted at that repo's previously-active branch
   Constraint: STOP if branching from anything other than the active branch without explicit user consent.

6. Phase 5: Implementation
   subject: "Phase 5: Implementation"
   activeForm: "Implementing code changes"
   Steps: For each entry in the plan's `Recommended Implementers`, in the listed order, MUST spawn that graph-aware implementer agent (`Task(subagent_type: <entry.agent>, ...)`) with the planner-authored `Implementation Plan`, the same `WIKI_CORE` page paths the planner cited (including any service docs the wiki router already matched), the plan's `Wiki Evidence` and `Graph Evidence`, and a `Scoped Files` block containing ONLY that entry's files. Implementer absorbs those artifacts before any fresh discovery, runs targeted graph checks only for high-risk edits flagged by the plan, implements code following the plan within its scope, follows project conventions from CLAUDE.md, includes wiki pages consulted and any fresh graph queries in its completion summary, and MUST end its completion summary with a `## Wiki Delta Hints` JSONL fenced block (see implementer template). **Sequential** — wait for each implementer to finish (code changes verified + parseable hints block emitted) before spawning the next entry. The block may be empty if no wiki impact, but the section MUST be present.
   Expected outputs: every entry in `Recommended Implementers` was spawned in order; each implementer confirmed it consumed the plan's Wiki Evidence and Graph Evidence; code changes exist for every entry's scope; every implementer's completion summary contains a parseable `## Wiki Delta Hints` JSONL block.
   Constraint: Do not proceed if any implementer entry was not spawned, the plan's Wiki Evidence / Graph Evidence were not consumed, no code changes exist in an entry's scope, or any implementer did not emit a parseable Wiki Delta Hints block.

7. Phase 6: Testing
   subject: "Phase 6: Testing"
   activeForm: "Running tests"
   Steps: If `--skip-tests` flag is set mark completed as "Skipped via flag" and proceed, otherwise auto-detect testing framework, run unit tests with coverage, run integration tests, run E2E tests (if applicable), collect coverage reports, if tests fail spawn implementer to fix (max 3 iterations). In a multi-repo workspace, run the test stack in each affected child repo and namespace coverage under `$ARTIFACTS_DIR/coverage/<repo-basename>/`; the 3-iteration retry budget is global across all repos.
   Expected outputs: all tests pass and coverage reports collected, OR phase correctly skipped via `--skip-tests`
   Constraint: If tests fail after 3 fix iterations, STOP and report failure. Do not proceed.

8. Phase 7: Visual Verification
   subject: "Phase 7: Visual Verification"
   activeForm: "Verifying visual changes"
   Steps: If no frontend changes or `--skip-visual` flag mark completed as "Skipped via flag" and proceed, otherwise take screenshots, compare with pixelmatch, if diff > 5% MUST spawn visual-verifier agent
   Expected outputs: screenshots compared OR phase correctly skipped
   Constraint: None.

9. Phase 8: Documentation Update
   subject: "Phase 8: Documentation Update"
   activeForm: "Updating documentation"
   Steps: MUST run doc-updater in an isolated subagent (`Task(subagent_type: "general-purpose", ...)`) that reads and follows the doc-updater skill against the changed files; on return, TaskUpdate this phase completed with the subagent's summary in the description
   Expected outputs: doc-updater subagent returned a one-line summary (files updated OR "no prescriptive doc changes needed" — both valid)
   Constraint: Do not proceed if the doc-updater subagent was not spawned. Do NOT invoke /doc-updater inline.

10. Phase 8.4: Implementation Commit
    subject: "Phase 8.4: Implementation Commit"
    activeForm: "Committing implementation changes"
    Steps: Stage and commit implementation + tests + doc changes per affected repo (can be just one). Exclude `docs/llm-wiki/**` (Phase 8.5 owns it). Never `git add .` / `-A` / `commit -a`. Never skip hooks.
    Expected outputs: each affected repo has one new implementation commit; commit SHAs written to `$ARTIFACTS_DIR/commits/<repo-basename>.sha`.
    Constraint: STOP if any pre-commit hook fails — surface output verbatim.

11. Phase 8.5: Wiki Refresh
    subject: "Phase 8.5: Wiki Refresh"
    activeForm: "Refreshing LLM wiki"
    Steps: Invoke `/wiki-refresh --commit --ticket <TICKET-ID> --artifacts-dir $ARTIFACTS_DIR`.
    Expected outputs: /wiki-refresh invocation completed; wiki commit produced when the wiki repo is tracked OR a diff manifest + warning file exist when the workspace parent is untracked OR the skill reported "wiki is fresh" with no changes.
    Constraint: Do not proceed if /wiki-refresh reported a hard error (it exits non-zero only when `.state.json` is missing, repeated AI parse failures, a page update genuinely failed, or the wiki-commit pre-commit hook failed). New-service suggestions are advisory and do NOT block.

12. Phase 9: PR Creation
    subject: "Phase 9: PR Creation"
    activeForm: "Creating pull request"
    Steps: If `--skip-pr` flag is set, mark completed as "Skipped via flag" (no push, no PR — commits stay local). This phase only pushes and opens PRs. **Path keyed on `len(AFFECTED_REPOS)`, not mode:** `1` → `git -C <repo> push -u origin <branch>` then `gh pr create` (title/summary/test plan/ticket link); `>1` → `/repo-fanout-pr --no-commit --repos <AFFECTED_REPOS csv> ...` (asserts clean tree + branch ahead of base per repo, one cross-linked PR per repo). If Phase 8.5 wrote `$ARTIFACTS_DIR/wiki/wiki-warning.txt`, embed it in every PR body.
    Expected outputs: branch pushed and PR created with URL in every affected repo, OR PR was skipped via `--skip-pr` (commits stay local in every affected repo). Multi-repo: every affected repo has its own PR (or local commits under `--skip-pr`), and the PR bodies are cross-linked.
    Constraint: Do not proceed if any expected PR was not created, unless `--skip-pr` was set in which case local commits in every affected repo are sufficient.

13. Phase 10: Review Loop
    subject: "Phase 10: Review Loop"
    activeForm: "Running review loop"
    Steps: For each PR URL produced by Phase 9, invoke /pr-reviewer (`--pr-url <URL> --jira-key <ID> --mode automated --artifacts-dir "$ARTIFACTS_DIR" [--repos <abs>]`) and /security-review (`--pr-url <URL> --jira-key <ID> --artifacts-dir "$ARTIFACTS_DIR" [--repos <abs>] [--baseline <prior>]`). Always pass `--artifacts-dir "$ARTIFACTS_DIR"` so review/security artifacts land under the workspace-root ticket dir, never inside a child repo. If blocking issues, spawn implementer for fixes and re-run tests; max 3 iterations global across all PRs. After the loop, in multi-repo mode only, run /pr-reviewer --aggregate --jira-key <ID> --artifacts-dir "$ARTIFACTS_DIR" and /security-review --aggregate --jira-key <ID> --artifacts-dir "$ARTIFACTS_DIR" to emit cross-repo summaries.
    Expected outputs: PR review ran, security review ran, either no blocking issues or fixes applied
    Constraint: If max iterations reached with unresolved issues, report and proceed to cleanup.

14. Phase 11: Cleanup
    subject: "Phase 11: Cleanup"
    activeForm: "Cleaning up environment"
    Steps: Remove docker-compose override (if created), archive artifacts, print final summary report
    Expected outputs: cleanup done, summary printed
    Constraint: None. This is the final phase.

After creating all 14 tasks, use TaskUpdate to chain dependencies:
- Task 2 addBlockedBy [Task 1]
- Task 3 addBlockedBy [Task 2]
- Task 4 addBlockedBy [Task 3]
- Task 5 addBlockedBy [Task 4]
- Task 6 addBlockedBy [Task 5]
- Task 7 addBlockedBy [Task 6]
- Task 8 addBlockedBy [Task 7]
- Task 9 addBlockedBy [Task 8]
- Task 10 addBlockedBy [Task 9]
- Task 11 addBlockedBy [Task 10]
- Task 12 addBlockedBy [Task 11]
- Task 13 addBlockedBy [Task 12]
- Task 14 addBlockedBy [Task 13]

### Task Status Rules

- Use TaskUpdate to mark a task `in_progress` BEFORE starting any work on that phase
- Use TaskUpdate to mark a task `completed` ONLY after verifying the Expected outputs listed above
- NEVER mark a task completed if expected outputs are missing, required agents were not spawned, or errors occurred
- If a phase is skipped via flag: mark it completed with description "Skipped via flag"

## Phase Execution

Execute each phase sequentially. Do not proceed to the next phase until the current phase is marked completed. For each phase, follow the Steps and verify Expected outputs listed above.

**Preflight marker check (Phase 1 onward):** at the start of every phase from Phase 1, assert `test -f "$ARTIFACTS_DIR/.preflight-ok"` exits 0. If the marker is missing, return to Phase 0 and rerun the preflight. The marker contains the `git_head` at preflight time — subsequent phases trust it as the authoritative graph + wiki freshness signal.

### Phase 0: Preflight (MANDATORY — Auto-bootstrap + Validation)

This phase has two parts. **Part A (auto-bootstrap) is mandatory and runs first.** Part B (defensive double-check) is a belt-and-suspenders verification that the bootstrap succeeded.

**Part A — auto-bootstrap.** Run the deterministic preflight before doing anything else in this phase. Anchor `ARTIFACTS_DIR` to the workspace root via `project_path()` (cwd-independent) so it can never resolve inside a child repo:

```bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
source ".claude/scripts/lib/resolve-paths.sh"
cd "$(project_path)"
ARTIFACTS_DIR="$(project_path)/.claude-temp/tickets/$TICKET_ID/artifacts"
export ARTIFACTS_DIR
bash ".claude/scripts/ensure-context.sh" --artifacts-dir "$ARTIFACTS_DIR"
```

`ensure-context.sh` records the resolved absolute `artifacts_dir` (and `workspace_root`) in `$ARTIFACTS_DIR/.preflight-ok`; later phases re-derive `ARTIFACTS_DIR` with the same two-line `source … ; ARTIFACTS_DIR="$(project_path)/.claude-temp/tickets/$TICKET_ID/artifacts"` snippet, so the path stays absolute and root-anchored regardless of the current working directory.

What the script does (handled automatically; you do not need to do any of this manually):

- Auto-installs `uv` / `uvx` / `code-review-graph` via the framework's existing fallback chain (`uv tool install` → `bootstrap_uv` → `pipx` → `pip`).
- Builds the code graph if missing, incrementally updates it if the local commit moved, or no-ops if it is already at HEAD (<3 s on the hot path).
- Re-emits `.mcp.json` with `mcpServers.code_graph` pointed at this machine's local framework path. Compare-then-write — no-op when content already matches.
- Writes a JSON success marker at `$ARTIFACTS_DIR/.preflight-ok` carrying `{git_head, graph_sha, provider, workspace_mode, child_repos, preflight_ran_at}`. `workspace_mode` (`single`|`multi`) + `child_repos` come from a deterministic probe (`register-submodules.sh is-multi-repo`, an exit code). Wiki staleness is no longer handled here — `/wiki-refresh` (Phase 8.5) owns it.

**If the script exits non-zero, STOP.** Surface its output verbatim to the user. Do NOT continue to Part B or any later phase. Failure modes (with structured marker `$ARTIFACTS_DIR/.preflight-failed`):

- `graph_build_failed` — surface the script's tail; the user will rerun.

**Part B — defensive double-check.** With the preflight marker present, the following assertions are belt-and-suspenders. They cannot fail because Part A just made them true; if any do, the marker file is corrupt and Part A must be rerun.

- Check git status (no uncommitted changes). In a multi-repo workspace run the status check in each child git repo rather than at the workspace root.
- **Resolve test / build commands from `framework-config.json::stack_profile.command_catalog`** — the catalog's `run_tests` and `run_build` operations name the canonical command for this project. Prefer the first entry (wrapper-tier: Makefile / Justfile / Taskfile / scripts) over package-manager fallbacks; wrappers orchestrate dependent services that raw package-manager invocations may skip.
- Verify tests pass in current state
- Validate build succeeds
- Detect primary language and stack
- Assert `.code-review-graph/graph.db` exists at the project root
- Assert project root `.mcp.json` has `mcpServers.code_graph`
- Assert `.preflight-ok` carries `workspace_mode` + `child_repos`; export `WORKSPACE_MODE`/`CHILD_REPOS` for Phases 4/8.4/9
- Verify `/mcp` shows `code_graph` connected or active `mcp__code_graph__*` tools are visible in this Claude Code session
- Verify generated planner and implementer agents expose exact `mcp__code_graph__*_tool` entries in their frontmatter, not only the broad `mcp__code_graph` server alias
- Assert `docs/llm-wiki/CLAUDE.md` exists (confirms initialization ran for the Claude Code provider)
- Assert `docs/llm-wiki/wiki/` exists and contains the three core files: `index.md`, `ARCHITECTURE.md`, `SERVICES.md`
- Verify each of those wiki files starts with YAML frontmatter containing `document_type`, `summary`, and `last_updated` keys.

CRITICAL: If any Part B assertion fails despite a present `.preflight-ok` marker, treat the marker as stale: delete it and rerun Part A. If the assertion still fails after a fresh Part A, STOP and report the inconsistency. Wiki staleness is no longer a preflight concern — Phase 8.5 handles it.

CONTINUE WITH Phase 1.

### Phase 1: Context Gathering

Produce a single canonical artifact at
`$ARTIFACTS_DIR/context/ticket-context.md` regardless of input source.
Every later phase reads from that path; nobody re-fetches from Jira / re-reads
the SDD markdown / re-parses `--from-input`.

- If `--from-jira <TICKET-ID>`: MUST invoke `/fetch-ticket-context` (the
  skill writes to the canonical path automatically).
- If `--from-markdown <PATH>`: copy the SDD ticket file to
  `$ARTIFACTS_DIR/context/ticket-context.md` (preserve the original
  body verbatim; add a one-line frontmatter `source: <PATH>`).
- If `--from-input "description"`: render the description into the same
  canonical file under a `## Description` heading; add `## Ticket` with
  a synthetic id (`AD-HOC-<timestamp>`).

CRITICAL: this phase does NOT plan, analyze requirements, or recommend
implementer agents — those are the planner's job in Phase 3. Phase 1's
only product is the canonical context artifact.

CONTINUE WITH Phase 2.

### Phase 2: Wiki Context Preload

Preload the LLM wiki so the planner can rely on pre-digested architecture instead of rediscovering it via graph queries. The wiki ships its own runtime router; defer to it instead of hard-coding a frontmatter walk. Do ALL of the following in order:

1. **Read the router.** Open `docs/llm-wiki/CLAUDE.md` (the wiki's runtime router, ≤150 lines). Its decision table tells you which page to consult for which question — architecture, a specific service, request lifecycles, testing/conventions, or "I don't know which page".

2. **Read the index.** Open `docs/llm-wiki/wiki/index.md` — the summary catalog. One line per page with summary / document_type / confidence / tags / related inline. This is Tier 1: a single read of `index.md` carries the same information today's frontmatter walk used to gather across N files.

3. **Pick 1–3 pages and expand them.** Match the ticket summary against the index entries; identify the 1–3 most relevant pages. Read their full bodies (cap 5 — the index summary is sufficient for everything else). Always include `index.md`'s body. **Confidence-aware:** prefer `confidence: high` pages; if only `confidence: low` matches, expand them but tag extracted facts as `confidence: low`. Stop wikilink traversal at depth 2.

4. **Optional graph call.** If the matched bodies do not fully answer the planner's likely questions, call `mcp__code_graph__get_minimal_context_tool({ task: "<ticket summary>", changed_files: [], base: "HEAD~1" })` AT MOST ONCE. Preserve the full response — the planner in Phase 3 may reuse it. The call MUST NOT be re-issued by any downstream phase.

   **Follow the graph navigation discipline.** When the planner or implementer falls back to graph MCP tools, follow the canonical rules in `<project>/.claude/CLAUDE.md`, section *Graph navigation discipline*. Summary: start with `mcp__code_graph__get_minimal_context_tool`; never call `mcp__code_graph__get_architecture_overview_tool` (forbidden — response cannot be bounded); set `detail_level: "minimal"`, `limit: 20` MAX, `include_members: false`, `include_source: false` everywhere they apply.

5. **Persist.** Write `$ARTIFACTS_DIR/context/wiki-context.md` with these sections:
   - `## ROUTER` — the path to the router file (`docs/llm-wiki/CLAUDE.md`)
   - `## WIKI_INDEX_SNAPSHOT` — the content of `index.md`
   - `## WIKI_CORE` — the 1–3 expanded page paths and their full bodies
   - `## get_minimal_context_tool Payload` — the full preserved response, only when step 4 ran

CRITICAL: Do not proceed to Phase 3 if `wiki-context.md` is missing or the router could not be loaded. Step 4 is optional — skip it when the matched pages already answer the planner's likely questions. The graph call (when made) MUST NOT be re-issued by later phases.

CONTINUE WITH Phase 3.

### Phase 3: Planning

Before spawning the planner, enumerate the implementer agents that actually exist in this project's `.claude/agents/`. The planner MUST constrain its `Recommended Implementers` mapping to this set:

```bash
AVAILABLE_IMPLEMENTERS=$(ls .claude/agents/implementer-*.md 2>/dev/null \
  | xargs -n1 basename | sed 's/\.md$//' | tr '\n' ',' | sed 's/,$//')
```

Spawn `planner` via `Task(subagent_type: "planner", prompt: ...)`. Keep
the prompt short — the planner's system prompt already covers
methodology. Include only:

- Ticket ID and one-line summary.
- Input paths (PATHS, not bodies): `$ARTIFACTS_DIR/context/ticket-context.md`,
  `$ARTIFACTS_DIR/context/wiki-context.md`.
- Available implementers (planner MUST constrain its bucket→agent
  mapping to this set — see the planner template's `Recommended
  Implementers (per-service)` selection rule, step 3 fallback):
  `$AVAILABLE_IMPLEMENTERS`.
- Hard rules — re-call ban:
  - Do NOT re-call `mcp__code_graph__get_minimal_context_tool`. Phase 2
    already invoked it (at most once); the full payload is in
    `wiki-context.md` under `## get_minimal_context_tool Payload` if it
    ran. Reference that payload by section name; do not regenerate it.
  - Do NOT re-fetch the ticket from Jira. The body, comments, and linked
    resources are in `ticket-context.md`.
- Targeted graph queries the planner MAY run when the wiki bodies do not
  resolve a load-bearing question: `mcp__code_graph__semantic_search_nodes_tool`,
  `mcp__code_graph__get_impact_radius_tool`,
  `mcp__code_graph__query_graph_tool` (callers_of / imports_of / tests_for).
  `mcp__code_graph__get_architecture_overview_tool` is forbidden (response
  cannot be bounded — see graph navigation discipline).

Persist the planner's returned markdown verbatim to
`$ARTIFACTS_DIR/plans/implementation-plan.md`.

Verify: plan file exists, contains `Wiki Evidence` and `Graph Evidence`, test strategy and target files are named, contains a `Recommended Implementers` section that is a non-empty ordered list where **every entry's agent name appears verbatim in `$AVAILABLE_IMPLEMENTERS`** (no recommending agents that are not installed under `.claude/agents/`), the service IDs it covers (derived from `framework-config.json::stack_profile.services`), and its scoped files; and (in `multi` mode) contains an `Affected Repositories` section mapping each touched `child_repos` path to its files. `single` mode may omit it — `AFFECTED_REPOS` is then the one workspace repo.

`Recommended Implementers` and `Affected Repositories` are orthogonal: the former drives Phase 5 implementer dispatch (per stack), the latter drives Phase 8.4 commit + Phase 9 PR fanout (per git repo).

CONTINUE WITH Phase 4.

### Phase 4: Environment Setup

- **Create one feature branch PER repo in `AFFECTED_REPOS`** (e.g. `feature/PROJ-123-description`), same name in each — loop `git -C <repo> checkout -b <new-branch>`. **MUST branch from each repo's currently active branch.** MUST NOT `git checkout`/`switch` first, and MUST NOT pass a base argument to `git checkout -b`. Any other base REQUIRES explicit per-repo user consent — obtain it as follows:

```bash
if [[ -n "${QAF_ASK_USER_MCP_TOOL:-}" ]]; then
  PAYLOAD=$(MCP_SKILL=implement-ticket MCP_PHASE=phase-4-branch-consent MCP_TICKET_ID="${TICKET_ID:-}" \
    bash "$MCP_AUQ_HOOKS/build-mcp-payload.sh")
  mcp__qaf__ask_user_questions "$(jq '.questions=[{id:"phase-4-branch-consent",question:"Which base should this branch use?",options:[{label:"Use active branch"},{label:"Use a different base"}],multi_select:false}]' <<<"$PAYLOAD")"
else
  AskUserQuestion "Branch consent: should I branch from the currently active branch, or use a different base? Never assume main/master/development."
fi
```

- Allocate ports for services (if needed)
- Create docker-compose override (if needed)
- Capture BEFORE screenshots (if frontend) into `$ARTIFACTS_DIR/screenshots/before/`

CONTINUE WITH Phase 5.

### Phase 5: Implementation

Parse the planner's `Recommended Implementers` section into an ordered list. For **each entry**, in the listed order, spawn the stack-specific implementer via `Task(subagent_type: <entry.agent>, prompt: ...)`.
**Sequential** — wait for one to finish before spawning the next, so later implementers see earlier edits on disk (this matters when one stack's contract feeds another, e.g., a backend endpoint consumed by a frontend client).

Keep each prompt short — the implementer's system prompt already covers
methodology. Include only:

- Ticket ID and one-line summary.
- Input paths (PATHS, not bodies):
  `$ARTIFACTS_DIR/plans/implementation-plan.md`,
  `$ARTIFACTS_DIR/context/wiki-context.md`,
  `$ARTIFACTS_DIR/context/ticket-context.md`.
- A `## Scoped Files` block containing ONLY this entry's files (verbatim
  from the plan). The implementer MUST treat files outside this block as
  out of scope.
- Hard rules — re-call ban:
  - Do NOT re-call `mcp__code_graph__get_minimal_context_tool`. The
    Phase 2 payload (when present) is referenced in the plan; the
    planner already consumed it. Re-running it costs tokens for no new
    information.
  - Do NOT re-read full wiki page bodies whose relevant excerpts are
    already inlined in the plan's `Wiki Evidence` section. Read the
    full body ONLY when the plan's `Implementation Steps` flags a
    specific edit as high-risk and cites a section the excerpt didn't
    cover.
  - Do NOT re-run any graph query the plan already documents in
    `Graph Evidence`. Reuse those findings.
- Fresh graph checks the implementer MAY run, only when the plan flags
  an edit as high-risk OR when source code reality contradicts the
  plan's evidence: `mcp__code_graph__get_impact_radius_tool` (before
  touching shared utilities or public APIs),
  `mcp__code_graph__query_graph_tool` (single targeted relationship
  question — callers / imports / tests),
  `mcp__code_graph__semantic_search_nodes_tool` (only when the plan
  lacks a symbol). `mcp__code_graph__get_architecture_overview_tool` is
  forbidden.

Verify, **per entry**: code changes exist within that entry's scope; the completion summary lists wiki pages consulted and any fresh graph checks; the completion summary contains a `## Wiki Delta Hints` JSONL fenced block (may be empty, but section must be present).

CRITICAL: Do not spawn the next entry — and do not proceed to Phase 6 — until the current entry has satisfied both checks. If any entry's implementer did not emit a parseable Wiki Delta Hints block, STOP.

CONTINUE WITH Phase 6.

### Phase 6: Testing

If `--skip-tests` flag: mark completed as "Skipped via flag" and continue.

Otherwise:
- **Resolve the test command from the project's command catalog.**
  Read `framework-config.json::stack_profile.command_catalog` and look up the
  preferred command for each test op: `run_tests`, `run_unit_tests`,
  `run_integration_tests`, `run_e2e`. The first entry of each operation array
  is the highest-tier candidate (wrapper → readme → package_manager → ci).
  **Prefer the wrapper** (`make tests`, `just test`, `task test`,
  `./scripts/test.sh`) over per-service package-manager commands when both
  exist — wrappers orchestrate dependent services (databases, queues, identity
  providers) that raw `pnpm test` / `npm test` / `pytest` invocations may
  silently skip.
- Only fall back to auto-detection (Jest, Pytest, Playwright, Vitest, etc.)
  when the catalog has NO entry for the relevant operation.
- Run unit tests with coverage, integration tests, E2E tests (if applicable);
  collect coverage reports.

In a multi-repo workspace, run the test stack in each affected child repo and namespace coverage under `$ARTIFACTS_DIR/coverage/<repo-basename>/`.

If tests fail: map each failing test file back to its owning service via longest-prefix match on `stack_profile.services[].path`, then re-spawn ONLY the `Recommended Implementers` entries whose `Scoped Files` overlap with the failure set (in the original listed order). Max 3 fix iterations, **global** across all implementers and all repos in multi-repo workspaces.

CRITICAL: If tests still fail after 3 iterations, STOP. Report failure. Do not continue.

CONTINUE WITH Phase 7.

### Phase 7: Visual Verification

If no frontend changes or `--skip-visual` flag: mark completed as "Skipped via flag" and continue.

Otherwise:
- Take screenshots of affected pages
- Compare before/after with pixelmatch
- If diff > 5%: MUST spawn `visual-verifier` agent

CONTINUE WITH Phase 8.

### Phase 8: Documentation Update

CRITICAL: run documentation maintenance in an **isolated subagent**, NOT inline. Doc-updater's phases end in an "analyze → decide" conclusion that the model tends to emit as plain text; inline, that idle turn terminates the whole run (see "CRITICAL — headless execution"). A subagent runs its own loop, so its narrate-and-stop ends only the child and returns its text to you as a tool result.

Spawn it with `Task(subagent_type: "general-purpose", prompt: ...)`. The prompt MUST contain:

- "Read and follow `.claude/skills/doc-updater/SKILL.md` exactly to maintain the four prescriptive doc targets (CLAUDE.md + the `code-conventions` / `multi-file-workflows` / `testing-conventions` skills). Edit nothing outside those four targets; descriptive context belongs in the wiki via Phase 8.5, not a skill body."
- Changed files: the output of `git diff --name-only` across `AFFECTED_REPOS`, excluding `docs/llm-wiki/**`.
- Artifact PATHS (not bodies): `$ARTIFACTS_DIR/context/ticket-context.md`, `$ARTIFACTS_DIR/plans/implementation-plan.md`.
- "Return ONLY a one-line summary: the files updated, or `doc-updater: no prescriptive doc changes needed`."

When the `Task` returns, **do NOT narrate** — your next action MUST be a tool call: immediately `TaskUpdate` Phase 8 → completed (put the subagent's summary line in the description), then proceed. A no-change result is the expected outcome for most tickets and counts as success. Do not re-run doc-updater inline.

CONTINUE WITH Phase 8.4.

### Phase 8.4: Implementation Commit

For each repo in `AFFECTED_REPOS` (single workspace root, or each child repo from the planner's `Affected Repositories`):

1. List changed files with `git -C <repo> status --porcelain`; exclude `docs/llm-wiki/**` (Phase 8.5 owns it). Empty list → STOP (single-repo) or skip with a note (multi-repo).
2. `git -C <repo> add -- <files>` then `git -C <repo> commit -m "<message>"`. Never `git add .` / `-A` / `commit -a`. Do not skip hooks.
3. Write the new SHA to `$ARTIFACTS_DIR/commits/<repo-basename>.sha`.

If a pre-commit hook fails, surface the output verbatim and STOP. Earlier sibling commits remain for inspection.

CONTINUE WITH Phase 8.5.

### Phase 8.5: Wiki Refresh

CRITICAL: invoke `/wiki-refresh --commit --ticket <TICKET-ID> --artifacts-dir $ARTIFACTS_DIR` via the Skill tool. The skill is multi-repo aware — one invocation handles the whole workspace.

Orchestrator responsibilities in this phase:

- Invoke the skill with the flags above.
- If `/wiki-refresh` reports a hard error (`.state.json` missing, AI parse failure, page update failed, or commit pre-commit hook failed), STOP and report. Do NOT create the PR.
- If `/wiki-refresh` surfaces a "potential new service detected" suggestion in its summary, surface that suggestion in the PR body. Do NOT auto-invoke `/wiki-add-service` — the user decides whether the new service is worth documenting now.
- If the refresh produced no changes ("wiki is fresh" or "no high-level facts drifted"), do nothing and continue to Phase 9.

CONTINUE WITH Phase 9.

### Phase 9: PR Creation

- BEFORE Phase 9 starts: confirm Phase 8.5 marked completed (wiki refreshed or confirmed unchanged). The implementation commit from Phase 8.4 and the optional wiki commit from Phase 8.5 are already on the branch — Phase 9 only pushes and opens PRs.

If `--skip-pr` flag: skip push and PR creation, mark completed as "Skipped via flag" and continue. Local commits from Phase 8.4 + Phase 8.5 remain on the branch for the user to inspect.

Otherwise, **choose by `len(AFFECTED_REPOS)`, NOT by `WORKSPACE_MODE`** (a `multi` workspace touching one repo still gets a single PR):

**If `len(AFFECTED_REPOS) == 1`** (`<repo>` = the one entry):

- `git -C <repo> push -u origin <branch>`
- Detect the git host provider from `git -C <repo> remote get-url origin` and create the PR/MR using the matching skill: `mastering-github-cli` for GitHub, `mastering-azure-devops-cli` for Azure DevOps, or the provider's native CLI for others — with: auto-generated title from ticket, summary of changes, test plan checklist, link to original ticket
- Return PR URL

**If `len(AFFECTED_REPOS) > 1`** — delegate to `/repo-fanout-pr --no-commit --repos <csv> --branch <branch> --ticket <TICKET-ID> --artifacts-dir $ARTIFACTS_DIR`, where `<csv>` is `AFFECTED_REPOS` joined by commas (absolute paths, no spaces). It asserts each repo's tree is clean + branch ahead of base, pushes, opens one cross-linked PR per repo, and returns `fanout/result.json`.

If Phase 8.5 wrote `$ARTIFACTS_DIR/wiki/wiki-warning.txt`, append its contents to every PR body created in this phase.

CRITICAL: Do not proceed if PR was not created, unless `--skip-pr` was set (in which case local commits are sufficient). In multi-repo, partial fanout success (any expected PR missing) is treated as failure.

CONTINUE WITH Phase 10.

### Phase 10: Review Loop

For each PR URL produced by Phase 9 (single-repo: one URL; multi-repo: one per affected repo):

- Run PR review: `/pr-reviewer --pr-url <URL> --jira-key <TICKET-ID> --mode automated --artifacts-dir "$ARTIFACTS_DIR" [--repos <abs-repo-path>]`
- Run security review: `/security-review --pr-url <URL> --jira-key <TICKET-ID> --artifacts-dir "$ARTIFACTS_DIR" [--repos <abs-repo-path>] [--baseline <prior-findings.json>]`

  `--artifacts-dir "$ARTIFACTS_DIR"` is the absolute, workspace-root-anchored ticket dir from Phase 0. Both skills write their output trees UNDER it (`$ARTIFACTS_DIR/pr/...`, `$ARTIFACTS_DIR/security/...`) — never inside a child repo, even though `--repos` points at one.
- If blocking issues found:
  - Map each finding's file path back to its owning service (longest-prefix on `stack_profile.services[].path`); re-spawn ONLY the `Recommended Implementers` entries whose `Scoped Files` overlap with the finding set, in the original listed order
  - Re-run tests
  - Re-review (max 3 iterations)
- Exit when approved or max iterations reached

In a multi-repo workspace, run the reviews once per PR URL produced by Phase 9 — each invocation passes the corresponding repo path via `--repos <abs>`. Fix commits land in the corresponding repo (`git -C <repo>`). The 3-iteration retry budget is global across all PRs and all implementers.

**Multi-repo aggregation (after the loop):** when more than one PR URL was reviewed for the same ticket, run a final aggregation pass:

- `/pr-reviewer --aggregate --jira-key <TICKET-ID> --artifacts-dir "$ARTIFACTS_DIR"` — emits `$ARTIFACTS_DIR/pr/cross-repo-summary.{json,md}` describing cross-repo concerns (API contract mismatches, schema skew, shared-dep conflicts) and a recommended merge order.
- `/security-review --aggregate --jira-key <TICKET-ID> --artifacts-dir "$ARTIFACTS_DIR"` — emits `$ARTIFACTS_DIR/security/cross-repo-summary.{json,md}` describing cross-cutting security concerns (shared-dep CVEs, identical findings across repos) and a dependency-ordered remediation plan.

Skip the aggregation pass in single-repo mode.

CONTINUE WITH Phase 11.

### Phase 11: Cleanup

- Remove docker-compose override (if created)
- Clean up temporary files
- Run `aggregate-metrics` CLI to produce `<ARTIFACTS_DIR>/metrics/summary.md`; include the summary path in the final report.
- Report final status with summary. List every PR URL produced (multi-repo workspaces have more than one), the per-repo coverage paths under `$ARTIFACTS_DIR/coverage/`, the wiki refresh outcome, and the metrics summary path.

## Error Handling

If a phase fails:
- Do NOT mark the task as completed
- Report which phase failed and why
- If Phase 0 fails: stop immediately
- If graph DB, project MCP config, active graph tools, exact graph-aware subagent allowlists, or the LLM wiki (`docs/llm-wiki/*`) are unavailable: stop immediately and instruct the user to rerun `/initialize-project` or resource sync, restart Claude Code, approve the project MCP server if prompted, and verify `code_graph` with `/mcp`
- If Phase 2 fails (wiki preload): stop and report. Do not fall back to a graph-only path — the planner depends on the wiki context artifact.
- If Phase 6 fails after 3 fix iterations: stop and report
- For other phases: attempt to recover once, then stop if still failing

## Skills and Agents Used

- `/fetch-ticket-context`: Phase 1 (Jira tickets only)
- `mcp__code_graph__get_minimal_context_tool`: Phase 2 (called exactly once; result reused by planner)
- `planner` agent: Phase 3 sole `Implementation Plan` author, context parser, Wiki Evidence and Graph Evidence owner, `Recommended Implementers` per-stack selector
- `implementer-{lang}` agent: Phase 5 (one per stack from `stack_profile.services`, dispatched sequentially in the planner's listed order), Phase 6 (fixes — only the implementer(s) owning failing tests), Phase 10 (fixes — only the implementer(s) owning review findings); consumes planner's Wiki+Graph evidence before any fresh discovery, scoped per spawn to its entry's `Scoped Files`
- `visual-verifier` agent: Phase 7
- `/doc-updater`: Phase 8
- `/wiki-refresh`: Phase 8.5 (auto-invoked with `--commit --ticket <TICKET-ID> --artifacts-dir $ARTIFACTS_DIR`; reads per-repo commits from `.state.json`, surgically edits affected pages under a high-level-only conservatism rule, commits `docs/llm-wiki/**` itself when the wiki is git-tracked or emits a diff manifest + warning for Phase 9 otherwise)
- `/repo-fanout-pr`: Phase 9 (multi-repo workspaces only — invoked with `--no-commit`; per-repo push + PR creation and cross-linking. The implementation commit is produced in Phase 8.4 before this skill runs.)
- `/pr-reviewer`: Phase 10 (run once per PR URL; always passed `--artifacts-dir "$ARTIFACTS_DIR"` so output lands under the workspace-root ticket dir)
- `/security-review`: Phase 10 (run once per PR URL; always passed `--artifacts-dir "$ARTIFACTS_DIR"` so output lands under the workspace-root ticket dir)
- `aggregate-metrics` CLI: Phase 11 (final metrics summary)

## Prerequisites

- Project initialized with `/initialize-project`
- `code-review-graph` built and MCP-accessible
- `.code-review-graph/graph.db` exists at the project root (framework compatibility DB; upstream default is `.code-review-graph/graph.db`)
- Project root `.mcp.json` defines `mcpServers.code_graph`
- Claude Code has been restarted after MCP config changes and `/mcp` shows `code_graph` connected
- Generated planner and implementer agents expose exact `mcp__code_graph__*_tool` entries
- LLM wiki exists at `docs/llm-wiki/` (workspace-scoped; lives at the workspace root in both single and multi mode) with `docs/llm-wiki/CLAUDE.md` present
- Git: at least one git repository reachable. Two supported shapes:
  - **single-repo**: workspace root is itself a git repo; `origin/development` or `origin/main` reachable (required for Phase 9 base-branch resolution).
  - **multi-repo**: workspace root is NOT a git repo but contains one or more child directories that ARE git repos. Every child repo must have `origin/development` or `origin/main` reachable.
- Tests passing in current state — at the workspace root in single mode, in every child repo in multi mode
- For `--from-jira`: Jira MCP configured
- For GitHub PR: `gh` CLI configured and authenticated against every affected GitHub remote
- For Azure DevOps PR: `az` CLI configured and authenticated against every affected Azure DevOps remote
- For other Git hosts: the host's native CLI configured and authenticated against every affected remote

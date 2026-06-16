---
name: create-sdd-ticket
description: Generate specification-driven development (SDD) tickets directly from ideas, Jira tickets, or markdown drafts. Use when creating implementation-ready tickets with gap detection, INVEST validation, and BDD scenarios.
argument-hint: '[--from-input "..." | --from-jira JIRA-URL-OR-KEY | --from-markdown PATH] [--save-to-jira BOARD-URL | --save-to-markdown [PATH]]'
---

# Create SDD Ticket

Input: `$ARGUMENTS`

Generate a complete, implementation-ready SDD ticket from plain text, Jira, or markdown input while keeping ticket creation behavior in one skill.

## Purpose

This skill must:

- support text, Jira, and markdown as inputs
- support Jira, markdown, or display-only as outputs
- inject project context before gap detection
- infer as much as possible from the codebase before asking questions
- validate the final ticket against INVEST criteria
- produce BDD scenarios in Given-When-Then form
- respect explicit markdown output paths and use `.claude-temp/tickets/<ticket-id>/<ticket-id>.md` only as the default when no markdown path is provided

## Invocation

Invoke the skill directly with arguments such as:

```text
/create-sdd-ticket --from-input "Add user authentication with JWT tokens" --save-to-markdown "./specs/AUTH-001.md"
```

```text
/create-sdd-ticket --from-jira "PROJ-123" --save-to-jira "https://company.atlassian.net/jira/software/c/projects/PROJ/boards/1"
```

```text
/create-sdd-ticket --from-markdown "./specs/DRAFT-001.md" --save-to-markdown "./specs/FEAT-001.md"
```

Optional flags:

- `--project-key <KEY>`
- `--issue-type <TYPE>` where supported values are `Story`, `Task`, `Bug`
- `--priority <PRIORITY>` where supported values are `High`, `Medium`, `Low`
- `--skip-wiki`: bypass Phase 0.2 wiki and graph preload (useful for freshly-cloned projects or offline environments) — also forwarded to the Phase 0 preflight

If no output flag is provided, display the completed canonical ticket without saving.

## Input And Output Modes

### Inputs

- `--from-input "description"`: create a ticket from a plain-language idea
- `--from-jira <JIRA-URL-OR-KEY>`: refine an existing Jira ticket
- `--from-markdown <PATH>`: refine an existing markdown draft

Exactly one input mode is required.

### Outputs

- `--save-to-jira <BOARD-URL>`: create or update the ticket in Jira
- `--save-to-markdown <PATH>`: save the ticket exactly to the path provided by the user
- `--save-to-markdown` with no path: default markdown output to `.claude-temp/tickets/<ticket-id>/<ticket-id>.md`
- no output flag: print the completed canonical ticket for review

## Workflow

### Phase 0: Preflight (MANDATORY — do not skip)

Before any other phase — before reading the ticket source, before consulting the wiki, before asking gap questions — run the deterministic preflight bootstrap:

```bash
cd "$(git rev-parse --show-toplevel)"
ARTIFACTS_DIR=".claude-temp/tickets/<draft-id>"
PREFLIGHT_ARGS=()
[ -n "${SKIP_WIKI:-}" ] && PREFLIGHT_ARGS+=("--skip-wiki")
bash ".claude/scripts/ensure-context.sh" --artifacts-dir "$ARTIFACTS_DIR" "${PREFLIGHT_ARGS[@]}"
```

What the script does (handled automatically; you do not need to do any of this manually):

- Auto-installs `uv` / `uvx` / `code-review-graph` via the framework's existing fallback chain (`uv tool install` → `bootstrap_uv` → `pipx` → `pip`).
- Builds the code graph if missing, incrementally updates it if the local commit moved, or no-ops if it is already at HEAD.
- Re-emits `.mcp.json` (Claude) / `.codex/config.toml` (Codex) with the local machine's absolute framework path.
- Refreshes the LLM wiki if `graph_sha` or `last_indexed_commit` drift is detected.
- Writes a JSON success marker at `$ARTIFACTS_DIR/.preflight-ok` carrying `{git_head, graph_sha, wiki_*, provider, preflight_ran_at}`.

Behaviour:

- Hot path (graph + wiki already current): exits 0 in <3 seconds.
- Cold path: full graph build (~4 s on a small repo) plus wiki refresh (~30–90 s if stale).

**If the script exits non-zero, STOP.** Surface its output verbatim to the user. Do NOT continue to Phase 0.1, 0.2, or any later phase.

If it exits 0, the graph at `.code-review-graph/graph.db` and the wiki at `docs/llm-wiki/` are guaranteed current as of the local `git HEAD`. Subsequent phases assert `test -f "$ARTIFACTS_DIR/.preflight-ok"` before doing anything; if the marker is missing, return to Phase 0.

The `--skip-wiki` flag (passed to `/create-sdd-ticket` itself) is forwarded to this preflight as `--skip-wiki`. Use only when explicitly told to.

### Phase 0.1: Inject Project Conventions

Read the three prescriptive convention skill bodies that Phase 3 synthesis emitted for this project:

- `.claude/skills/code-conventions/SKILL.md` — gotchas with WRONG/CORRECT examples, naming rules, error handling, data-layer patterns
- `.claude/skills/multi-file-workflows/SKILL.md` — ordered checklists for cross-cutting changes (add endpoint, add entity, etc.)
- `.claude/skills/testing-conventions/SKILL.md` — what to mock and not, fixture conventions, coverage expectations, example tests

These are **prescriptive** — rules, examples, checklists. Use them for:

- conventions and patterns the project requires
- gotchas that should influence gap detection
- multi-file change checklists that may inform "what else needs touching"
- test expectations that affect ticket sizing

If any of these skills is missing (project not yet initialized), fall back to `.claude/CLAUDE.md` (CLAUDE.md / AGENTS.md cheat-sheet) and explicit codebase inspection, but still treat convention loading as required work before continuing. Phase 0.1 carries **prescriptive** rules; descriptive context (what the system IS) comes from Phase 0.2 — the wiki.

Before doing anything in this phase, verify the preflight marker: `test -f "$ARTIFACTS_DIR/.preflight-ok"` exits 0. If not, return to Phase 0.

### Phase 0.2: Wiki & Graph Context Preload

Phase 0.1 and Phase 0.2 are **complementary, not redundant**. They divide along a strict descriptive/prescriptive line:

| | Phase 0.1 — convention skills | Phase 0.2 — LLM wiki + graph |
|---|---|---|
| Shape | prescriptive rules / checklists / WRONG-CORRECT examples | descriptive structured docs + summary index |
| Authority | **highest** for "how do we DO this here" — conventions, gotchas, multi-file checklists, test rules | **highest** for "what IS this system" — architecture, service boundaries, data flows, any structural fact derivable from the AST |
| Freshness | regenerated on `/initialize-project` re-runs | refreshed every PR via `/implement-ticket` Phase 8.5; `last_updated` frontmatter shows currency |
| Cost | three skill body reads (already in agent context if `skills:` frontmatter is wired) | router (≤150 lines) + 1–3 page bodies + at most one optional graph call |

**No conflict by construction** — the descriptive/prescriptive split means each fact lives in exactly one place. If a fact appears in both (rare regression), the wiki wins for descriptive claims and the convention skills win for prescriptive rules.

If `docs/llm-wiki/` exists, defer retrieval to the wiki's own router. The router is project-specific and lists every available page with its summary inline; you do not need to walk frontmatter.

1. **Read the router.** Read `docs/llm-wiki/CLAUDE.md` (Claude provider) or `docs/llm-wiki/AGENTS.md` (Codex provider). Whichever exists for the active provider is the wiki's runtime entry point — capped at ~150 lines, with a decision table that names which page to consult for which question.

2. **Pick 1–3 pages from `index.md`.** Read `docs/llm-wiki/wiki/index.md` (it is the summary catalog: one line per page with summary / document_type / tags / related inline). Match the user's idea against the summaries; identify the 1–3 most relevant pages. Read **only** those page bodies.

3. **Optional graph call.** If the matched page bodies do not fully answer the gap-detection questions, call `mcp__code_graph__get_minimal_context_tool({ task: "<user idea or ticket summary>", changed_files: [], base: "HEAD~1" })` **at most once**. Preserve the full response — downstream `/implement-ticket` Phase 3 may reuse it.

   **Follow the graph navigation discipline.** When you fall back to graph MCP tools, follow the canonical rules in `<project>/.claude/CLAUDE.md` (Claude) or `<project>/.codex/AGENTS.md` (Codex), section *Graph navigation discipline*. Summary: start with `mcp__code_graph__get_minimal_context_tool`; never call `mcp__code_graph__get_architecture_overview_tool` (forbidden — response cannot be bounded); set `detail_level: "minimal"`, `limit: 20` MAX, `include_members: false`, `include_source: false` everywhere they apply.

4. **Persist** the loaded context to `.claude-temp/tickets/<draft-id>/context/wiki-context.md` with sections: `## ROUTER` (the router file path), `## WIKI_INDEX_SNAPSHOT` (the index.md content), `## WIKI_CORE` (the 1–3 expanded page paths + bodies), `## get_minimal_context_tool Payload` (only when step 3 ran).

**Tier discipline:** start with the router → 1–3 page bodies → at most one graph call. Never read every wiki page; the index entry summary is sufficient unless the user's question matches the page's topic. Stop wikilink traversal at depth 2.

**Fallback:** if `docs/llm-wiki/` is missing (project not yet initialized), log `wiki unavailable — falling back to convention skills + CLAUDE.md only` and continue with Phase 0.1's prescriptive context only. Do NOT fail the skill. Do NOT call graph tools if the graph MCP server is unavailable.

Optional flag: pass `--skip-wiki` to bypass Phase 0.2 entirely (useful for freshly-cloned projects or offline environments). When `--skip-wiki` is present, log `wiki unavailable — falling back to convention skills + CLAUDE.md only` and proceed directly to Phase 1. Use this only when the wiki is known to be drift-prone — the framework's default assumption is that the wiki is fresher than any prescriptive skill body.

### Phase 1: Parse Input Source

- detect which input mode is active
- load the source data from plain text, Jira, or markdown
- validate accessibility and basic structure
- normalize the raw source into a working internal representation

#### When `--from-jira`: invoke `/fetch-ticket-context` (MANDATORY)

When the input mode is `--from-jira`, invoking `/fetch-ticket-context` is **mandatory**, not optional. The canonical artifact at `$ARTIFACTS_DIR/context/ticket-context.md` — body, comments, linked resources, attachments, related tickets — is the source of truth for the rest of the workflow. Do NOT operate on the raw description-only response of `mcp__atlassian__jira_get_issue`; that bypasses the comment material the SDD synthesis depends on.

```bash
ARTIFACTS_DIR=".claude-temp/tickets/${JIRA_KEY}/artifacts"
mkdir -p "$ARTIFACTS_DIR/context"
/fetch-ticket-context "$JIRA_KEY"
# Artifact now at: $ARTIFACTS_DIR/context/ticket-context.md
```

After the artifact exists, parse:

- `## Ticket` — id, title, type, status, priority, labels, sprint, epic
- `## Description` — base requirement (starting point, NOT the final word)
- `## Acceptance Criteria` — initial AC, subject to deltas from comments
- `## Comments` — the conversation; treat as authoritative input alongside the description (see §Comment-Aware Synthesis below)
- `## Linked Resources` — already-fetched Notion / Confluence / Figma material with `Origin:` annotations
- `## Related Tickets` — Blocking / Depends on / Blocked by

### Phase 2: Intelligent Gap Detection

Validate the canonical ticket against the SDD requirements and, for every missing or weak field, exhaust inference before asking the engineer.

Required inference order:

1. **For Jira input — check `## Comments` first.** Many "gaps" are already answered by the conversation on the ticket: a comment may clarify which OAuth provider to use, which fields to add, which tests to write, or which scope to exclude. Walk the comments chronologically; if a comment resolves an open gap, apply the answer (most recent wins on conflict — see §Comment-Aware Synthesis) and remove the gap from the list.
2. Consult `WIKI_CORE` (the 1–3 page bodies loaded by Phase 0.2); every question the wiki already answers is removed from the gap list. If a matched page references a related page via `**Related:** [[...]]` and that related page is on-topic, expand it (depth ≤ 2).
3. Graph queries — classify each remaining gap by question type and route to the matching tool (e.g. `mcp__code_graph__semantic_search_nodes_tool` for symbol lookups, `mcp__code_graph__query_graph_tool` for relationships). Do NOT default to `semantic_search_nodes_tool` for everything. See the routing table below; cap at 6 graph queries total for this step.
4. Search the three convention skill bodies (`code-conventions`, `multi-file-workflows`, `testing-conventions`) and `.claude/CLAUDE.md` for prescriptive context.
5. Codebase grep + related file inspection (narrowed by graph node paths from step 3 when available; reuse cached graph results instead of re-querying).
6. Inspect existing tickets or drafts for precedents.
7. Only if 1–6 fail, add the item to the question batch.

   | Question class | Example | Tool | Reasoning |
   |---|---|---|---|
   | symbol_lookup | "Does `RateLimiter` exist?" | `mcp__code_graph__semantic_search_nodes_tool` | matches by name |
   | relationship | "Who calls `AuthService.login`?" / "What imports the `users` module?" | `mcp__code_graph__query_graph_tool` (`pattern: "callers_of"` / `"imports_of"` / `"tests_for"`) | edge traversal |
   | data_flow | "Does the request flow auth → users?" / "What's the request lifecycle for `/api/login`?" | `mcp__code_graph__list_flows_tool` then `mcp__code_graph__get_flow_tool` | execution paths |
   | boundary | "Are `users` and `auth` in the same service?" / "Which service owns `RateLimiter`?" | `mcp__code_graph__list_communities_tool` + `mcp__code_graph__get_community_tool` | community membership |
   | impact | "If we change `User` model, what's affected?" | `mcp__code_graph__get_impact_radius_tool` | blast radius |
   | overview | "What's the architectural shape?" | `mcp__code_graph__get_architecture_overview` | top-level topology (rare in gap detection — usually answered by Phase 0.2 wiki preload) |

   Pick exactly ONE tool per gap. If the gap is ambiguous, prefer the cheaper tool (`semantic_search_nodes_tool` → `query_graph_tool` → `list_flows_tool`/`get_flow_tool` → `get_impact_radius_tool`). Cap at 6 graph queries total for Phase 2 — beyond that, fall back to grep.

   Cache every result. If step 4 (codebase grep) needs the same symbol later, reuse the graph result instead of re-querying.

UI-specific handling must remain available:

- classify whether the work is UI-related
- if UI work is detected, check for existing UI or visual testing configuration
- if configuration is missing, ask one targeted batch question about whether visual UI testing against designs is required
- if UI testing is required, inject the relevant Definition of Done items, technical tasks, and BDD coverage expectations

### Phase 3: Batch Question Generation

- generate the minimum number of questions required to finish the ticket
- include what was searched so the engineer understands the missing context
- ask all unresolved questions at once
- avoid asking for information that could have been inferred from the repository

**Before choosing a path, you MUST detect the execution context by running this exact bash command and reading its literal output. Do NOT infer the value from prior context — run the check.**

```bash
echo "QAF_ASK_USER_MCP_TOOL=${QAF_ASK_USER_MCP_TOOL:-UNSET}"
```

- If the output ends in `=UNSET`, use the interactive-execution block below.
- Otherwise (any non-empty value), use the autonomous-execution block below.

When QAF_ASK_USER_MCP_TOOL is set (autonomous execution — questions are routed via MCP):

```bash
if [[ -n "${QAF_ASK_USER_MCP_TOOL:-}" ]]; then
  PAYLOAD=$(MCP_SKILL=create-sdd-ticket MCP_PHASE=phase-3-gaps \
    bash "$MCP_AUQ_HOOKS/build-mcp-payload.sh")
  mkdir -p "$ARTIFACTS_DIR/decisions"
  jq -r '.invocation.batch_id' <<<"$PAYLOAD" > "$ARTIFACTS_DIR/decisions/sdd-batch.txt"
  QUESTIONS_JSON="<build questions array from unresolvedGaps>"
  "$QAF_ASK_USER_MCP_TOOL" "$(jq --argjson q "$QUESTIONS_JSON" '.questions=$q' <<<"$PAYLOAD")"
fi
```

When QAF_ASK_USER_MCP_TOOL is unset (interactive execution — engineer reads and replies inline):

```markdown
I need clarification on ${unresolvedGaps.length} item(s) that could not be inferred:

## ${category}

${gap.field}
Question: ${gap.message}
Context: Searched ${attemptedSources.join(', ')} and did not find a definitive answer
Example: ${gap.example}

Your answer: **\_**
```

### Phase 4: Process Answers And Fill Gaps

- parse the engineer's answers
- apply them back into the canonical ticket
- re-run completeness validation
- ensure no unresolved placeholder content remains

### Phase 5: Apply INVEST Criteria

#### Phase 5a: Objective Scope Check (informs INVEST "Small")

Before evaluating "Small" subjectively, query the code graph for an objective blast-radius signal.

1. Identify the **primary touched files/services** from the ticket's `technicalContext.proposedChanges` and `wikiEvidence`/`graphEvidence` (already populated in Phases 0.5 and 2). If no concrete file paths can be inferred, skip this sub-step (proceed to subjective Small evaluation).

2. Call exactly once:
   ```
   mcp__code_graph__get_impact_radius_tool({
     changed_files: [<inferred primary files>],
     max_depth: 2,
     detail_level: "minimal"
   })
   ```

3. Interpret the response:
   - **`impacted_services > 3` OR `impacted_files > 25`** — flag the ticket as **likely too large for "Small"**. Record the impact radius numbers in `metadata.scope_impact` so Phase 5's split recommendation has objective backing.
   - **`impacted_services ≤ 3` AND `impacted_files ≤ 25`** — "Small" likely passes; proceed.
   - On graph unavailable / MCP unreachable: log `graph unavailable for scope check` and fall back to subjective evaluation.

4. Cache the impact-radius result in `technicalContext.graphEvidence[]` so the downstream planner doesn't re-issue it.

Validate the ticket across all INVEST dimensions:

- `Independent`
- `Negotiable`
- `Valuable`
- `Estimable`
- `Small`: ticket fits a 1–5 day implementation. **Use Phase 5a's impact-radius signal as objective input.** If `metadata.scope_impact.impacted_services > 3` or `impacted_files > 25`, flag for split — don't pass "Small" silently.
- `Testable`

If the ticket fails "Small" (subjectively or via Phase 5a's objective signal), provide a concrete split recommendation. When impact-radius data is available, use it: split along service boundaries surfaced by `impacted_services`, not by guesswork. Cite the actual numbers in the recommendation so reviewers can verify.

### Phase 6: Generate BDD Scenarios

- ensure there are at least 3 high-quality scenarios
- use Given-When-Then structure
- cover happy path, edge cases, and failure scenarios
- use concrete, verifiable examples instead of vague wording

### Phase 7: Output Ticket

- format the completed canonical ticket for the chosen destination
- if a markdown path is provided, save exactly there
- if markdown output is requested without a path, default to `.claude-temp/tickets/<ticket-id>/<ticket-id>.md`
- create parent directories when needed
- if saving to Jira, preserve priority, issue type, and project key when provided
- return the saved path or Jira key plus a short quality summary

## Comment-Aware Synthesis

When the input was `--from-jira`, the ticket-context artifact's `## Description` is the **starting point** of the SDD, not the final word. The `## Comments` section carries the conversation that refined the requirement after the description was written — and the SDD must reflect that final state.

Treat every shown comment as a potential delta on the description. A comment that names or renames the ticket subject (e.g. `"I want it called X"`, `"rename to X"`, `"the skill should be Y"`) also rewrites the SDD's `title` field and any inline references to the prior name. Common patterns the synthesizer should handle (these are guidance for interpretation, not deterministic pattern-matching):

- **"Add tests for X"** → extend `definitionOfDone.testing[]` AND add corresponding BDD scenarios in Phase 6.
- **"Switch to X" / "Replace Y with X" / "Call it X"** → overwrite the corresponding entry in `technicalContext.architectureDecisions[]`, `proposedChanges[]`, or `title`, whichever the comment targets.
- **"Out of scope" / "Remains for v2"** → add to `outOfScope[]`.
- **"Decision:" / "Approved by …"** → promote to `technicalContext.architectureDecisions[]` with rationale.
- **"?" / "It is not clear if…" with no later answer in the comments** → record in `Assumptions And Open Questions` of the SDD (or batch-question to the engineer in Phase 3 if the gap is load-bearing).

### Precedence rule

When two comments contradict each other on the same point, OR a comment contradicts the description, the **most recent comment wins** — the SDD must reflect the final state of the conversation.

Exception: when an older comment carries a strong-decision marker (`approved:`, `decision:`, `confirmed:`, "decisión:", "confirmado:") and no later comment explicitly contradicts it, the older decision stands. The more recent comment adds rather than overrides.

### Output is the SDD only

The SDD ticket body — whether saved to Jira, written to markdown, or printed for review — must contain ONLY the SDD content. It MUST NOT contain:

- inline citations like `_(from comment #10042, 2026-05-10, Jane Doe)_`
- rename / renumber log lines like `"Renamed from /old-name per comment #NNNN"`
- meta-narration about the synthesis process such as `"Most-recent-comment-wins rule applied"`
- any reference to the comment-id, comment-author, or comment-timestamp that drove a delta

Traceability lives in the Jira comment thread itself and in the working artifact at `$ARTIFACTS_DIR/context/ticket-context.md`; never in the ticket body the implementer will read.

### Seeding BDD scenarios from comments

When generating scenarios in Phase 6, sweep the comments again for test-relevant statements ("test for X", "agregar test de Y", "validar Z"). Each such comment seeds at least one Given-When-Then scenario.

---

## Canonical Expectations

The completed ticket should include, when applicable:

- title and user story
- stakeholders
- success criteria and metrics
- acceptance criteria with BDD scenarios
- technical context
- dependencies and integration points
- out of scope and future considerations
- edge cases and error scenarios
- validation rules
- Definition of Done
- implementation notes and references
- metadata indicating INVEST validation and BDD scenario count

## Canonical Ticket Structure

Use this structure as the mental model for completeness checks:

```json
{
  "id": "PROJ-123 or DRAFT-YYYYMMDD-HHMMSS",
  "source": "jira | markdown | input",
  "title": "Concise ticket title",
  "userStory": {
    "role": "user persona",
    "goal": "desired capability",
    "benefit": "business value"
  },
  "stakeholders": [
    {
      "role": "Product Owner",
      "name": "Jane Doe",
      "responsibility": "Acceptance, prioritization"
    }
  ],
  "successCriteria": ["Measurable outcome 1", "Measurable outcome 2"],
  "metrics": "How success will be measured",
  "acceptanceCriteria": [
    {
      "scenario": "Happy path",
      "given": "initial context",
      "and_given": ["additional context"],
      "when": "action trigger",
      "then": "expected outcome",
      "and_then": ["additional outcomes"]
    }
  ],
  "technicalContext": {
    "currentState": ["What exists today"],
    "proposedChanges": ["What will be built"],
    "constraints": ["Performance, security requirements"],
    "integrationPoints": ["Systems to integrate with"],
    "architectureDecisions": [
      {
        "decision": "Use JWT tokens",
        "rationale": "Industry standard, stateless"
      }
    ],
    "wikiEvidence": ["docs/llm-wiki/wiki/services/auth.md", "docs/llm-wiki/wiki/PATTERNS.md#throttling"],
    "graphEvidence": [
      { "tool": "mcp__code_graph__semantic_search_nodes_tool", "params": { "query": "rate limit" }, "finding": "3 hits in src/auth/throttle.ts" },
      { "tool": "mcp__code_graph__query_graph_tool", "params": { "pattern": "callers_of", "target": "AuthService.login" }, "finding": "called from api/routes/auth.ts and middleware/session.ts" },
      { "tool": "mcp__code_graph__get_community_tool", "params": { "node": "RateLimiter" }, "finding": "belongs to auth service community" }
    ]
  },
  "outOfScope": ["Item explicitly not included"],
  "futureConsiderations": "What might be addressed later",
  "edgeCases": [
    {
      "case": "Edge case description",
      "handling": "How to handle it"
    }
  ],
  "errorScenarios": [
    {
      "error": "Error condition",
      "systemBehavior": "User message, system behavior"
    }
  ],
  "validationRules": ["Data validation rules"],
  "dependencies": {
    "blocking": ["PROJ-122"],
    "related": ["PROJ-100 - Related feature"]
  },
  "definitionOfDone": {
    "codeQuality": ["Unit test coverage >= 80%"],
    "testing": ["All BDD scenarios automated"],
    "documentation": ["API endpoints documented"],
    "review": ["Code reviewed and approved"]
  },
  "implementationNotes": "Additional context for implementer",
  "references": ["Design mockups URL"],
  "metadata": {
    "createdAt": "2026-04-15T10:00:00Z",
    "investValidated": true,
    "bddScenarioCount": 5,
    "priority": "High",
    "labels": ["sdd", "authentication"],
    "scope_impact": {
      "impacted_services": 2,
      "impacted_files": 14,
      "max_depth": 2,
      "tool": "mcp__code_graph__get_impact_radius_tool"
    }
  }
}
```

## Markdown Output Rule

Default markdown output path:

```text
.claude-temp/tickets/<ticket-id>/<ticket-id>.md
```

If the user supplies `--save-to-markdown <PATH>`, save the ticket to that exact path instead of rewriting it into `.claude-temp/tickets/`.

## Markdown Template Structure

Markdown output should align with [`templates/sdd-ticket-template.md`](./templates/sdd-ticket-template.md) and include these sections:

````markdown
# PROJ-123: [Title]

## User Story

**As a** [role]
**I want** [goal]
**So that** [benefit]

## Stakeholders

- Role / name / responsibility

## Success Criteria

1. [Measurable outcome 1]
2. [Measurable outcome 2]

## Acceptance Criteria

### Scenario 1: [Happy Path]

```gherkin
Given [context]
When [action]
Then [outcome]
```

## Technical Context

- Current state
- Proposed changes
- Technical constraints
- Integration points
- Architecture decisions

## Out Of Scope

- [Item]

## Edge Cases And Error Handling

- Edge cases
- Error scenarios
- Validation rules

## Dependencies

- Blocking
- Related

## Definition Of Done

- Code quality
- Testing
- Documentation
- Review and deployment

## Wiki Evidence

- `docs/llm-wiki/wiki/ARCHITECTURE.md`
- `docs/llm-wiki/wiki/services/<service-id>.md`

## Graph Evidence

- Tool: `mcp__code_graph__semantic_search_nodes_tool` — params: `{"query": "<symbol>"}` — finding: `<result>`
- Tool: `mcp__code_graph__query_graph_tool` — params: `{"pattern": "callers_of", "target": "<symbol>"}` — finding: `<result>`
- Tool: `mcp__code_graph__get_community_tool` — params: `{"node": "<symbol>"}` — finding: `<result>`

## Implementation Notes

## References

**INVEST Validated**: ✅
**BDD Scenarios**: 5
````

## Question Policy

Ask questions only when the answer cannot be reliably inferred from:

- the three convention skills (`code-conventions`, `multi-file-workflows`, `testing-conventions`)
- `.claude/CLAUDE.md`
- the LLM wiki under `docs/llm-wiki/`
- repository structure and nearby implementations
- existing tickets or drafts
- visible integration and testing patterns

Questions should be:

- batched
- specific
- contextualized with what was searched
- phrased to unblock implementation, not to outsource architecture decisions

## Quality Bar

Before finalizing, ensure:

- no required section is missing
- no placeholder markers remain
- INVEST validation has been applied
- BDD scenarios are concrete and testable
- markdown output guidance uses `.claude-temp/tickets/`
- the ticket remains ready for `implement-ticket`

## Usage Examples

### Text To Markdown

Invoke the `create-sdd-ticket` skill with:

```text
--from-input "Admin users report taking too long to find specific users in the 500+ user list. Add search filtering by name and email, similar to the existing product search." --save-to-markdown "./specs/user-search.md"
```

### Text To Jira

Invoke the `create-sdd-ticket` skill with:

```text
--from-input "Add user export feature for admins to download CSV reports" --save-to-jira "https://acme.atlassian.net/jira/software/projects/PROJ/boards/1" --project-key PROJ --priority High
```

### Jira To Markdown

Invoke the `create-sdd-ticket` skill with:

```text
--from-jira "PROJ-100" --save-to-markdown "./specs/refined-PROJ-100.md"
```

### Markdown To Jira

Invoke the `create-sdd-ticket` skill with:

```text
--from-markdown "./specs/draft-feature.md" --save-to-jira "https://acme.atlassian.net/jira/software/projects/PROJ/boards/1" --project-key PROJ
```

## Error Handling

### Input Source Unavailable

Report which input could not be loaded and why, for example:

- Jira ticket not found
- markdown path missing or unreadable
- empty plain-text description

### Inference Could Not Resolve All Gaps

Summarize:

- how many gaps were found
- how many were inferred
- which searches were attempted
- the exact remaining questions

Example:

**Before choosing a path, you MUST detect the execution context by running this exact bash command and reading its literal output. Do NOT infer the value from prior context — run the check.**

```bash
echo "QAF_ASK_USER_MCP_TOOL=${QAF_ASK_USER_MCP_TOOL:-UNSET}"
```

- If the output ends in `=UNSET`, use the interactive-execution block below.
- Otherwise (any non-empty value), use the autonomous-execution block below.

When QAF_ASK_USER_MCP_TOOL is set (autonomous execution — questions are routed via MCP):

```bash
if [[ -n "${QAF_ASK_USER_MCP_TOOL:-}" ]]; then
  HOOK_SCRIPT="${MCP_AUQ_HOOKS:-}/build-mcp-payload.sh"
  if [[ ! -f "$CLAUDE_PROJECT_DIR/.claude-temp/sessions/session.json" || ! -f "$HOOK_SCRIPT" ]]; then
    echo "QAF_ASK_USER_MCP_TOOL set but session or MCP_AUQ_HOOKS hook missing. See ask-user-questions-contract.md §3.3."
    exit 1
  fi
  export MCP_SKILL=create-sdd-ticket MCP_PHASE=phase-3-gaps-reask
  export MCP_PARENT_BATCH_ID="$(cat "$ARTIFACTS_DIR/decisions/sdd-batch.txt" 2>/dev/null || true)"
  PAYLOAD=$(source "$HOOK_SCRIPT")
  QUESTIONS_JSON="<build questions array from remaining unresolved gaps>"
  "$QAF_ASK_USER_MCP_TOOL" "$(jq --argjson q "$QUESTIONS_JSON" '.questions=$q' <<<"$PAYLOAD")"
fi
```

When QAF_ASK_USER_MCP_TOOL is unset (interactive execution — engineer reads and replies inline):

```markdown
🧠 Gap Detection Summary:
Inferred: 8/12 gaps (67%)
Unresolved: 4 gaps

I need clarification on 4 items that couldn't be inferred from the codebase:

## Technical Context

proposedChanges
Question: What specific components will be modified?
Context: Searched the codebase but found multiple possible implementations
Example: "Modify UserController, add AuthService, update User model"

Your answer: **\_**
```

### INVEST Validation Failed

If the ticket is too large or not testable enough, do not silently continue. Provide the failure reason and a split or refinement recommendation.

Example:

```markdown
⚠️ INVEST Validation: Small criterion failed

Estimated: 8 days
Recommendation: Split into 2 tickets

Suggested Split:
Ticket 1: Basic login and token generation
Estimate: 3 days

Ticket 2: Refresh tokens and session management
Estimate: 4 days
```

### Jira Output Unavailable

If Jira creation fails, recommend either saving to the user-requested markdown path or, if no path was provided, falling back to `.claude-temp/tickets/`.

Example:

```markdown
❌ Jira output unavailable

Fallback:
.claude-temp/tickets/DRAFT-20260415-143022/DRAFT-20260415-143022.md

Options:

1. Save to markdown now
2. Re-run later when Jira access is available
3. Copy the generated content into Jira manually
```

## Quality Checks

Before finalizing, validate:

### Completeness

- [ ] user story includes who, what, and why
- [ ] all main sections are present
- [ ] no `[NEEDS_CLARIFICATION]` markers remain
- [ ] no placeholder text remains

### INVEST

- [ ] Independent passes
- [ ] Negotiable passes
- [ ] Valuable passes
- [ ] Estimable passes
- [ ] Small is within expected scope or split recommendation is provided
- [ ] Phase 5a impact-radius check ran (or was skipped with reason logged)
- [ ] Testable passes

### BDD

- [ ] at least 3 scenarios exist
- [ ] all scenarios use Given-When-Then
- [ ] scenarios use concrete examples
- [ ] happy path, edge cases, and failures are covered

### Technical Clarity

- [ ] integration points are documented
- [ ] constraints are documented
- [ ] architecture decisions are explained where needed
- [ ] error handling is defined
- [ ] wiki evidence cited when available
- [ ] graph evidence cited when the graph is available

## Integration Notes

- `code-conventions` / `multi-file-workflows` / `testing-conventions`: required in Phase 0.1 (the three prescriptive skills generated by `/initialize-project`)
- `fetch-ticket-context`: **mandatory** in Phase 1 when `--from-jira`. Produces the canonical artifact at `$ARTIFACTS_DIR/context/ticket-context.md` whose `## Description` plus `## Comments` are the source of truth for Comment-Aware Synthesis
- `implement-ticket`: the resulting markdown or Jira ticket should be directly implementable
- `ui-testing` and `ui-visual-testing`: used when UI work is detected and testing expectations need to be injected
- LLM wiki: required in Phase 0.2 when available; soft-optional when missing

## Version History

- **3.6.0** (2026-04-29): replaced Phase 0.1's monolithic `project-context` skill with the three prescriptive convention skills (`code-conventions`, `multi-file-workflows`, `testing-conventions`); descriptive content now lives only in the wiki (Phase 0.2)
- **3.5.0** (2026-04-29): mandatory Phase 0 deterministic preflight (`bash $FRAMEWORK_PATH/scripts/ensure-context.sh`) auto-installs the graph + wiki dependencies and refreshes both before any context loading runs. Existing convention-skills and wiki preload phases renumbered to 0.1 and 0.2; each now asserts `$ARTIFACTS_DIR/.preflight-ok` before doing work
- **3.4.0** (2026-04-27): clarified Phase 0 vs Phase 0.5 (§8) — both inject target-project context but in complementary shapes (prescriptive vs descriptive/graph-backed); explicit conflict-resolution rule (wiki wins on structural facts); confidence-aware Tier 3 page selection; per-project skills documented as target-project-generated, not framework knowledge
- **3.3.0** (2026-04-24): objective INVEST "Small" scope check via get_impact_radius_tool (§6) — Phase 5a queries blast radius before subjective evaluation; `metadata.scope_impact` records impacted_services/impacted_files/max_depth; split recommendations cite actual numbers; fallback logs `graph unavailable for scope check`
- **3.2.0** (2026-04-24): multi-tool graph routing in Phase 2 gap detection (§5 of OPTIMIZATION_REVIEW) — question-class classifier table routes symbol_lookup, relationship, data_flow, boundary, impact, and overview gaps to the correct graph MCP tool; `graphEvidence` reshaped to array of `{tool, params, finding}` entries; 6-query cap enforced
- **3.1.0** (2026-04-24): wiki + graph aware Phase 0.5, inference-order rewrite, `wikiEvidence`/`graphEvidence` in canonical ticket structure, `--skip-wiki` flag, updated Quality Checks
- **3.0.0** (2026-04-15): unified command and skill behavior into one directly invokable skill, restored Phase 0 prescriptive-context injection, and removed slash-command duplication
- **2.0.0** (2026-03-08): added multiple input and output modes plus intelligent gap detection
- **1.0.0** (2026-03-02): initial release

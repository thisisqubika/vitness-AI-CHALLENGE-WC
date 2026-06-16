---
name: generate-test-cases
version: 1.0.0
lastUpdated: 2026-05-08
description: Generate structured, tool-agnostic test cases from a Jira ticket, free-form text, or markdown spec, and publish them to a test management tool (Qase, Jira subtasks, TestRail, Xray, or a markdown file). Use when asked to "create test cases", "generate QA cases", "write test cases for TICKET-123", or "crear casos de prueba".
argument-hint: '--from-jira <KEY> | --from-text "<text>" | --from-markdown <path>  --to-qase [CODE] | --to-jira | --to-testrail [ID] | --to-xray | --to-markdown <path>  [--format classic|gherkin] [--suite-id <ID>]'
allowed-tools: Read, Write, Bash, Glob, Grep, Edit
---

# Generate Test Cases Skill

Turns a ticket, feature description, or markdown document into structured, ready-to-execute test cases and publishes them to any supported test management tool via output adapters.

## Contents

- [Purpose](#purpose)
- [Prerequisites](#prerequisites)
- [Input Modes](#input-modes)
- [Output Adapters](#output-adapters)
- [Workflow](#workflow)
- [Canonical Test Case Format](#canonical-test-case-format)
- [Quality Checks](#quality-checks)
- [Adding a New Output Adapter](#adding-a-new-output-adapter)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [References](#references)

---

## Purpose

Automates the conversion of acceptance criteria and feature descriptions into well-structured test cases:

1. **Fetches the source** — pulls a Jira ticket, reads a markdown file, or accepts free-form text
2. **Analyzes the content** — extracts testable scenarios from descriptions, ACs, edge cases, and service boundaries
3. **Generates canonical test cases** — produces tool-agnostic cases with title, preconditions, steps, postconditions, priority, type, tags
4. **Publishes via an output adapter** — each `--to-*` flag selects an adapter that maps the canonical format to the target tool's API

**Principle**: Every test case must be independently executable. A tester reading only the test case (without the original ticket) should be able to run it. Generation is fully decoupled from the output tool.

---

## Prerequisites

**Common**: Claude Code with MCP support, plus at least one input source:
- **Atlassian MCP** (`mcp__claude_ai_Atlassian__*`) for `--from-jira`
- A local markdown file for `--from-markdown`
- Free-form text inline for `--from-text`

**Adapter-specific**: each adapter has its own MCPs/plugins/permissions — see the corresponding file under `adapters/`, loaded only when its `--to-*` flag is used.

**Optional**: existing suite passed via `--suite-id <ID>`; project conventions documented in `.claude/CLAUDE.md` (used to ground preconditions — service names, env vars, session cookie name, etc.).

---

## Input Modes

### `--from-jira <TICKET-KEY>`
Fetch the ticket and extract testable scenarios from description, ACs, and embedded checklists. Uses `mcp__claude_ai_Atlassian__getJiraIssue` with `responseContentFormat: markdown`.
```bash
/generate-test-cases --from-jira PROJ-123 --to-qase MYPROJ
```

### `--from-text "<description>"`
Accept free-form text and infer test cases.
```bash
/generate-test-cases --from-text "Users can add products to a wishlist and remove them" --to-qase MYPROJ
```

### `--from-markdown <PATH>`
Read a local markdown file (SDD ticket, spec document, etc.).
```bash
/generate-test-cases --from-markdown ./specs/PROJ-123.md --to-qase MYPROJ
```

---

## Output Adapters

Each `--to-*` flag selects an adapter that translates the canonical test case format into the target tool's payload. Generation is shared — only the adapter changes.

**Adapter details live in separate files under `adapters/` and are loaded on-demand.** Phase 4 reads only the file for the selected `--to-*` flag.

| Flag | Adapter file | Description |
|------|-------------|-------------|
| `--to-qase [CODE]` | [`adapters/qase.md`](./adapters/qase.md) | Publishes to Qase via MCP (suite + bulk-create). |
| `--to-jira` | [`adapters/jira.md`](./adapters/jira.md) | Creates one Jira Subtask per case under the source ticket. Requires `--from-jira`. |
| `--to-testrail [ID]` | [`adapters/testrail.md`](./adapters/testrail.md) | Publishes to TestRail (MCP) or falls back to CSV-importable markdown. |
| `--to-xray` | [`adapters/xray.md`](./adapters/xray.md) | Creates Xray Test issues in Jira (Xray plugin required). |
| `--to-markdown <path>` | [`adapters/markdown.md`](./adapters/markdown.md) | Writes all cases to a local markdown file. No MCP needed. |

**Display only** (no `--to-*` flag): prints a formatted summary in the conversation. Useful for review before publishing. No adapter file is loaded.

---

## Workflow

### Phase 0: Parse Arguments

Parse all arguments before doing anything else. Print usage if required arguments are missing.

```
Usage: /generate-test-cases
         --from-jira <KEY> | --from-text "<text>" | --from-markdown <path>
         [--to-qase [CODE]] | [--to-jira] | [--to-testrail [ID]] | [--to-xray] | [--to-markdown <path>]
         [--format classic|gherkin]
         [--suite-id <ID>]
```

### Phase 1: Load Source Content

**`--from-jira`**: call `mcp__claude_ai_Atlassian__getJiraIssue` and extract summary, description, checklist items (`- [ ] ...`), labels, issue type. Each checklist item is a test case candidate; labels/type feed tags.

Announce what was loaded:
```
✓ Loaded: PROJ-124 — Feature name
  Source: Jira (WorkItemType)
  Labels: ...
  Output adapter: Qase → project MYPROJ
```

### Phase 2: Confirm Format

Resolves the format contract (title convention, fields, priority/type scales, step style). Persisted per project in `generate-test-cases.json` at the project root.

- **Config file present** → read it, print a one-line summary (`Style:` + truncated `Customizations:`), forward to Phase 3. Do NOT ask.
- **Config file missing** → load [`references/format-config.md`](./references/format-config.md) and follow its first-run flow (default preview, ask user, persist).

For full details (schema, returning vs first-run, temporary overrides) see [`references/format-config.md`](./references/format-config.md).

### Phase 3: Generate Test Cases

No user interaction, but announce every sub-step. Generate in **canonical format** (see below) with Phase 2 customizations applied — never tool-specific.

**Progress announcements:**
- Before 3a: `⏳ Analyzing ticket to identify test areas...`
- Before 3b: `⏳ Applying QA design techniques (BVA, equivalence partitioning, negatives...)`
- Before 3c: `⏳ Organizing test cases into logical groups...`
- Before 3d: `⏳ Writing test cases in canonical format...`
- Before 3e: `⏳ Verifying coverage checklist...`
- After 3e: `✓ Generated test cases across logical areas` — **do not include specific numbers until Phase 4 completes**.

#### 3a. Identify test areas

Scan the source for:
- **Explicit checklist items** (`- [ ] ...`) — each is a candidate
- **Acceptance criteria** — convert each into one or more cases
- **Edge cases** — empty, zero, max, concurrent
- **Error scenarios** — failed service calls, invalid input, timeouts
- **Integration points** — each external service call is a boundary
- **Persistence** — "persists between sessions" needs its own case
- **UI feedback** — badges, loading states, success/empty messages

#### 3b. Apply test design techniques

Deliberately apply the techniques below to avoid happy-path-only batches. The first four apply to almost every ticket; the last two apply conditionally.

**Always apply:**

- **Equivalence partitioning** — for each input field with a range/enumeration/category, group values into classes and test one representative per class. Example: an `age` field `0-12 free / 13-17 half / 18-64 full / 65+ senior` yields 4 cases, not one per integer.
- **Boundary value analysis (BVA)** — for each numeric/length-bounded field, test exact boundaries AND just outside. A "password 8-64 chars" rule yields at minimum: 7 (reject), 8 (accept), 64 (accept), 65 (reject). Boundary defects are one of the most common bug classes — never skip.
- **Negative testing** — for every positive case ask "what's its invalid/malicious twin?". Per field, generate: invalid format, wrong type, empty/null, oversized payload, unauthorized actor, concurrent modification, retry after partial failure. **Target ~40-50% negatives in the final batch.**
- **Error guessing (common pitfalls)** — race conditions, cache staleness, timezone/locale shifts, null/undefined propagation, integer overflow, UTF-8/emoji in text, retry idempotency, back-button behavior, session expiration mid-flow, very long strings, HTML/script injection, copy-paste of formatted content.

**Conditional:**

- **State transition testing** — when the feature has states (e.g. order: `created → paid → shipped → delivered`, optional `cancelled`). Generate one case per **legal** transition AND extra cases attempting **illegal** transitions (e.g., "cancel an already delivered order") asserting proper rejection.
- **Decision table testing** — when rules combine multiple conditions (e.g. "discount IF `user_tier = gold` AND `cart_total > 100` AND `NOT on_sale`"). Enumerate truth-table rows that produce distinct outcomes; collapse equivalent rows.

After applying, the batch should include: clear positives per equivalence class, boundary probes, explicit per-field negatives, and (where applicable) transition + rule-combination coverage.

#### 3c. Group into logical areas

Organize cases into groups reflecting the feature's structure (e.g., for a currency feature: Selector, Price Conversion, Correctness & Edge Cases).

#### 3d. Write each test case in canonical format

Every test case must have ALL fields populated — never leave one empty. See [Canonical Test Case Format](#canonical-test-case-format).

#### 3e. Coverage checklist

Before Phase 4, verify:
- [ ] Primary happy path
- [ ] Empty/zero state
- [ ] Each distinct CRUD-style operation
- [ ] Persistence (if mentioned)
- [ ] Currency/localization (if prices involved)
- [ ] Each integration point failure (service down, timeout)
- [ ] Each validation/error message in the ticket
- [ ] **At least one negative per input field** (invalid format, out-of-range, unauthorized, null/empty, oversized)
- [ ] **Boundary values for each bounded input** (exact min/max, just below/above)
- [ ] **Each legal state transition AND attempts at illegal transitions** (if stateful)
- [ ] **Decision-table rows enumerated** (if multi-condition rules)
- [ ] **Roughly 40-50% of cases are negative** (if below ~30%, revisit 3b)

A typical Story should yield at least 8–12 test cases.

### Phase 4: Output via Adapter

When the user specifies a `--to-<name>` flag, **load the matching adapter file**:

1. Read `adapters/<name>.md` (relative to this skill directory).
2. Apply the field mapping table to transform canonical cases into the tool's payload.
3. Make the MCP/API calls in the order specified.
4. Use the progress announcements and success report template from the adapter file.

If no `--to-*` flag, skip adapter loading and print the formatted display-only summary.

After publishing, report with the actual count from the response. Example for Qase:
```
✅ Created 17 test cases
   Adapter: Qase
   Project: MYPROJ | Suite: "PROJ-124 - X Feature" (ID: 6)
   Created test cases with IDs 34–50
```

---

## Canonical Test Case Format

Default internal format produced by Phase 3. Every adapter consumes this. Customized via `generate-test-cases.json` (see [Phase 2](#phase-2-confirm-format)) — adapters always consume the canonical shape, so customizations must map cleanly to each adapter's field mapping table.

```json
{
  "title": "Feature | Scenario name",
  "preconditions": "Exact system state before the test. Be specific.",
  "steps": [
    { "action": "One atomic action", "expected_result": "Observable outcome" }
  ],
  "postconditions": "System state after success",
  "priority": "high | medium | low",
  "type": "functional | security | usability | accessibility | performance | compatibility",
  "tags": ["feature-name", "service-name", "test-area"],
  "format": "classic | gherkin"
}
```

**Priority** — `high`: core feature broken if it fails. `medium`: secondary flows / locale / secondary UI. `low`: cosmetic, accessibility convenience.

**Type** — case's primary validation purpose (NOT execution context):
- `functional` — does the feature do what it should? Default.
- `security` — auth/authz, data exposure, injection, sessions.
- `usability` — clarity, flow, feedback, error messages.
- `accessibility` — screen readers, keyboard, contrast, ARIA, WCAG.
- `performance` — timing, throughput, resource usage, load.
- `compatibility` — browsers, devices, OS, resolutions, platforms.

**Suite membership** (regression / smoke / sanity / acceptance) — encode in `tags`, NOT in `type`. Examples: `["auth", "regression-suite"]`, `["checkout", "smoke"]`, `["uat", "order-flow"]`. A single case can belong to multiple suites without losing what it validates.

**Gherkin format** — steps use a single `value` field with Given/When/Then syntax instead of `action`/`expected_result`.

### Quality standards (applied during 3d)

- **Titles**: follow the convention from `generate-test-cases.json` (default `Feature | Scenario`). Good: `Currency | Badge count updates immediately after currency change`. Bad: `Test currency selector`.
- **Preconditions**: name exact services that must be running, whether data exists or is empty, session/cookie state. Avoid vague "user is logged in".
- **Steps**: one atomic action per step. Expected result must answer "how does the tester know it succeeded?" — not just "it works". If a step triggers a backend call, mention it so the case is testable at the service level.
- **Negatives ratio**: target ~40-50% negatives. Below ~30% → re-apply 3b. Above ~70% → confirm positive coverage isn't starved. Indicator of quality, not a hard quota.

---

## Quality Checks

Before finalizing a batch (end of Phase 3, before Phase 4 publishing), validate per-case, batch-level, and adapter output.

**Per case:**
- [ ] Title follows the configured convention (default: `Feature | Scenario`)
- [ ] Preconditions name exact services, data state, session requirements
- [ ] Every step has both `action` and `expected_result` (classic) or complete Given-When-Then (gherkin)
- [ ] Each step performs exactly one action
- [ ] Expected result is observable (not "it works")
- [ ] Postconditions describe final system state
- [ ] `priority` set with clear rationale
- [ ] `type` set
- [ ] `tags` include feature name and affected service(s)

**Batch:**
- [ ] At least one happy path
- [ ] At least one empty/zero state
- [ ] One case per distinct CRUD operation
- [ ] Persistence case (if applicable)
- [ ] Localization/currency case (if applicable)
- [ ] One failure case per integration point
- [ ] One case per validation/error message
- [ ] Story yields **8–12 cases minimum**
- [ ] No duplicate titles
- [ ] Consistent tagging across cases

**Adapter output:**
- [ ] Field mapping applied per loaded `adapters/<tool>.md`
- [ ] MCP calls returned successful IDs (or markdown file written)
- [ ] Success report includes adapter name, project/suite, created IDs

---

## Changing the Saved Format

Stored in `generate-test-cases.json` at the project root. To re-ask the prompt: delete the file. To tweak without re-asking: edit `customizations` directly. To share across a team: commit it. Full schema and validation caveats in [`references/format-config.md`](./references/format-config.md).

---

## Adding a New Output Adapter

Create `adapters/<toolname>.md` (don't edit this skill) with sections: requirements, flag syntax, MCP/API calls, field mapping table, Phase 4 progress announcements, success report, errors/fallbacks, references. Add a row to the [Output Adapters](#output-adapters) table and update the `argument-hint`. Phase 3 generation logic does NOT change — the canonical format is stable.

---

## Examples

```bash
# Jira ticket → Qase (most common)
/generate-test-cases --from-jira PROJ-123 --to-qase MYPROJ

# Jira ticket → markdown file (preview before publishing)
/generate-test-cases --from-jira PROJ-123 --to-markdown ./cases.md
```

For all input/adapter combinations, gherkin variants, `--suite-id`, and full interactive transcripts (first-run config prompt, returning-run flow), see [`references/examples.md`](./references/examples.md).

---

## Error Handling

Adapter-specific errors live in each `adapters/*.md`. Common errors:

| Error | Message |
|------|---------|
| Missing input source | `❌ No input source specified. Use: --from-jira <KEY>, --from-text "<text>", or --from-markdown <path>` |
| Jira ticket not found | `❌ Could not fetch <KEY> from Jira. Check the ticket key and Atlassian MCP configuration.` |
| No testable content | `⚠️  No checklist items or acceptance criteria found. Generating from description text. Review before publishing.` |

---

## Best Practices

- **Generate in canonical format first** — keep destination-portability; never write tool-specific fields in Phase 3.
- **Cases must be independently executable** — preconditions name services, data states, session/cookie requirements explicitly.
- **One action per step**; expected result must be observable.
- **Cover the full matrix** — happy path, empty state, each CRUD, persistence, localization, integration failures, every validation message.
- **Tag by service and feature** for downstream filtering.
- **Prefer `--to-markdown` first** when exploring a new ticket — review locally before pushing to a shared tool.
- **Don't mix classic and gherkin** in the same run — pick one via `--format`.
- **Always capture returned IDs** from bulk-create responses and echo them in the success report.

---

## Integration with Other Skills

- After **`/create-sdd-ticket`** — turn a fully-specified ticket into executable tests.
- After **`/analyze-requirements`** — generate cases from the implementation plan's Testing Strategy.
- Pairs with **`/implement-ticket`** — run after implementation to create regression tests before the PR.

---

## Version History

See [`references/changelog.md`](./references/changelog.md).

---

## References

- **Input**: Atlassian MCP `mcp__claude_ai_Atlassian__getJiraIssue` (markdown response).
- **Output adapters**: [`adapters/`](./adapters/) — one file per tool, loaded on-demand by Phase 4.
- **Related skills**: [`/create-sdd-ticket`](../../020-development-workflow/create-sdd-ticket/SKILL.md), [`/analyze-requirements`](../../020-development-workflow/analyze-requirements/SKILL.md), [`/implement-ticket`](../../020-development-workflow/implement-ticket/SKILL.md).
- **External**: [Gherkin Reference](https://cucumber.io/docs/gherkin/reference/).

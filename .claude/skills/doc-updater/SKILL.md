---
name: doc-updater
description: Maintain CLAUDE.md (CLAUDE.md/AGENTS.md) and the three generated convention skills (code-conventions, multi-file-workflows, testing-conventions) accuracy after code changes. Surgical updates only; defers descriptive content to /wiki-refresh and graph maintenance to ensure-context.sh.
version: 2.1.0
last-updated: 2026-06-01
---

# Documentation Updater Skill

## Responsibilities and non-responsibilities

### In scope

This skill updates exactly four targets — nothing else:

1. `.claude/CLAUDE.md` (CLAUDE.md / AGENTS.md) — prescriptive project rules: file placement, tech stack cheat-sheet, common commands, architecture structure.
2. `.claude/skills/code-conventions/SKILL.md` — prescriptive coding conventions, gotchas, naming rules, WRONG/CORRECT examples.
3. `.claude/skills/multi-file-workflows/SKILL.md` — prescriptive multi-file checklists for changes that cross ≥2 files.
4. `.claude/skills/testing-conventions/SKILL.md` — prescriptive testing rules, fixture conventions, mocking rules.

### Out of scope (and why)

| What | Why not here | Where instead |
|------|-------------|---------------|
| `docs/llm-wiki/**` | Descriptive content — system shape, service inventory, flows. Belongs in the wiki. | `/wiki-refresh` (invoked automatically in `/implement-ticket` Phase 8.5) |
| Code graph | The graph is a structural artifact maintained by pre-flight tooling, not by a documentation pass. | `ensure-context.sh` preflight |
| README files | READMEs are discoverable human documentation handled during ticket implementation, not by this skill. | Implementer agent during `/implement-ticket` Phase 5 |

**Prescriptive vs. descriptive line (load-bearing):**

- `CLAUDE.md` is a **cheat-sheet**: file placement rules, commands, tech stack
- The three convention skills are **prescriptive**: rules, examples, checklists
- The wiki is **descriptive**: system shape, service inventory, request flows

If a fact you would update is descriptive ("the system uses RabbitMQ", "auth is OAuth2 PKCE"), it belongs in the wiki — invoke `/wiki-refresh` instead. Never duplicate descriptive content into a skill body.

---

## CRITICAL: Role prompt for this agent

```
CRITICAL: This agent updates PRESCRIPTIVE rules only.

FORBIDDEN:
- Editing any file under docs/llm-wiki/**
- Adding descriptive narrative ("the system uses X") to any convention skill body
- Editing README.md or any documentation that is not one of the four targets listed in "In scope"
- Bumping version numbers in package.json / pyproject.toml / Cargo.toml / go.mod / etc.

If a proposed change is descriptive, refuse it and tell the caller to invoke /wiki-refresh instead.
```

---

## Binary qualification rubric

A change qualifies for a convention update **only if** it satisfies at least one of:

**(a)** It introduces a **new file-placement rule** — a new directory structure, file naming convention, or module organisation pattern that a developer must know before creating new files.

**(b)** It introduces or removes a **workflow that crosses ≥2 files** — a multi-step checklist where skipping or reordering steps causes bugs or broken builds.

**(c)** It changes a **testing convention reusable by future work** — a new fixture pattern, mock boundary rule, coverage threshold change, or test-organisation rule that applies beyond this one ticket.

All three clauses require that the rule be **reusable by future work**, not specific to this ticket. Anything else is either descriptive (→ `/wiki-refresh`) or one-off implementation detail (→ no update).

**Do NOT update if:**

- Changes are simple bug fixes
- Changes add new endpoints (endpoints must not be listed)
- Changes add new entities (entity fields must not be listed)
- Changes are implementation details discoverable by reading code
- The candidate update is descriptive rather than prescriptive

---

## When to Use

Invoke `/doc-updater` after implementing a ticket (Phase 8 of implement-ticket), after significant code changes, or when architectural patterns, file-placement conventions, or the tech stack change.

---

## Inputs

This skill expects to be called from implement-ticket Phase 8 with:

1. **Changed files list**: From `git diff --name-only`
2. **Implementation summary**: Brief description of changes
3. **Ticket ID**: For tracking purposes

---

## Workflow

Run the six phases below in order. This skill is invoked inline by the caller — **do not create tasks or todos; the calling skill owns progress tracking.**

### Phase 0: Read Current Documentation

Read existing documentation:

```bash
echo "=== Current CLAUDE.md ==="
cat .claude/CLAUDE.md

echo ""
echo "=== Current code-conventions/SKILL.md ==="
cat .claude/skills/code-conventions/SKILL.md

echo ""
echo "=== Current multi-file-workflows/SKILL.md ==="
cat .claude/skills/multi-file-workflows/SKILL.md

echo ""
echo "=== Current testing-conventions/SKILL.md ==="
cat .claude/skills/testing-conventions/SKILL.md
```

### Phase 1: Analyze Changed Files

Read and categorize all changed files:

```bash
for file in $CHANGED_FILES; do
  echo "=== $file ==="
  cat "$file"
done
```

Categorize changes:

- Backend code (controllers, services, guards, middleware)
- Frontend code (components, pages, hooks)
- Configuration (package.json, docker-compose.yml, tsconfig.json)
- Infrastructure (Dockerfile, scripts, CI/CD)

### Phase 2: Detect Documentation Impact

For each of the four targets, decide whether an update is warranted. The per-target triggers below are the *only* reasons to update; how to apply each update is covered in Phase 4. Apply the binary rubric above — if none of clause (a), (b), (c) is satisfied, do not update.

**`CLAUDE.md` — update when:**

- **New technology**: new framework/library in package.json, new language, new database/service in docker-compose.yml
- **File placement changes**: new directory structure, file naming convention, or module-organisation pattern
- **Common commands changed**: package.json scripts, Makefile targets, or new development-workflow commands
- **Architecture changes**: monorepo structure modified, new path aliases, backend/frontend organisation changed
- **Services & ports changed**: docker-compose services added/removed, port mappings changed

**`code-conventions/SKILL.md` — update when** (rubric clause a/b/c satisfied; prescriptive rules only):

- **New gotcha**: a bug fix surfaced a non-obvious, easy-to-get-wrong pattern → add a `### Title` block with WRONG/CORRECT examples
- **Naming convention changed**: file or identifier convention modified
- **Error-handling pattern changed**: new exception type/handler or response format that needs a prescriptive rule
- **Data-layer rule changed**: repository/DAO pattern or transaction-handling rule modified

Descriptive facts ("there is a global error handler") go to the wiki; this skill carries prescriptive rules only ("ALWAYS wrap order writes in a transaction").

**`multi-file-workflows/SKILL.md` — update when** (rubric clause b):

- **New multi-file workflow**: the implementation surfaced an "and you must also update X" rule → add a `## Workflow Name` heading + numbered steps + gotcha note
- **Existing workflow changed**: a new file joined an existing workflow, or step ordering matters and changed

**`testing-conventions/SKILL.md` — update when** (rubric clause c):

- **New "do not mock" rule**: a failure/incident proved a class must not be mocked
- **New fixture convention**: a reusable fixture/builder pattern emerged
- **Coverage expectation changed**: threshold moved or a per-area rule introduced
- **New test pattern**: update the example code in the relevant section

Descriptive narrative — service boundaries shifted, request-lifecycle steps changed, a new external integration was added — is **not** this skill. That lives in `docs/llm-wiki/wiki/ARCHITECTURE.md`; invoke `/wiki-refresh` instead.

### Phase 3: Generate Update Plan

Generate a JSON structure with your analysis:

```json
{
  "ticketId": "<ticket-id>",
  "changesDetected": {
    "claudeMd": {
      "updateNeeded": false,
      "sections": [],
      "reason": "<why update is needed or not>"
    },
    "codeConventions": {
      "updateNeeded": false,
      "sections": [],
      "reason": "<rubric clause satisfied, or 'no clause satisfied'>"
    },
    "multiFileWorkflows": {
      "updateNeeded": false,
      "sections": [],
      "reason": "<rubric clause satisfied, or 'no clause satisfied'>"
    },
    "testingConventions": {
      "updateNeeded": false,
      "sections": [],
      "reason": "<rubric clause satisfied, or 'no clause satisfied'>"
    }
  },
  "updates": {
    "claudeMd": [],
    "codeConventions": [],
    "multiFileWorkflows": [],
    "testingConventions": []
  }
}
```

### Phase 4: Apply Updates

For each update in the plan, use the Edit tool against the target file and verify the edit succeeded. The call shape is the same for every target — only `file_path` changes:

```
Edit({
  file_path: '.claude/CLAUDE.md',   // or skills/code-conventions/SKILL.md,
                                                       //    skills/multi-file-workflows/SKILL.md,
                                                       //    skills/testing-conventions/SKILL.md
  old_string: update.before,
  new_string: update.after,
})
```

**Update strategy by target:**

`CLAUDE.md` — keep every section concise and reference-only:

- **Tech Stack** — add new language/framework; bump versions only on a major change
- **File Placement Guide** — add new file-type patterns / structure changes; verify every path exists with Glob
- **Common Commands** — reflect package.json script / Makefile changes; keep grouped by category
- **Architecture** — reflect monorepo-structure or path-alias changes; structure only
- **Conventions** — reflect code-style, commit-format, or naming changes
- **Services & Ports** — reflect docker-compose service / port-mapping changes

`code-conventions/SKILL.md`:

1. **Gotchas** — add a `### Title` block with a one-line description and minimal WRONG/CORRECT fenced examples
2. **Naming** — update the rule, one-line rationale
3. **Error Handling** — update the rule, one-line rationale
4. **Data Layer Rules** — update the rule, one-line rationale

`multi-file-workflows/SKILL.md`:

1. **Existing workflow** — modify the numbered steps in place; preserve step ordering
2. **New workflow** — add a `## Adding a new <thing>` heading with numbered steps and a `> Gotcha:` line where wrong order causes bugs
3. Keep checklists concrete: real file paths, `{placeholder}` for varying segments only

`testing-conventions/SKILL.md`:

1. **Philosophy** — add/modify a "do test" / "do NOT test" bullet
2. **Unit / Integration / E2E patterns** — update the example test code to match the new pattern
3. **What NOT to Mock** — add a bullet with one-line rationale
4. **Fixture Conventions** — update naming/location rules with the example

If a fact you would add is descriptive, stop — it belongs in the wiki, not a skill. Invoke `/wiki-refresh` instead.

### Phase 5: Verify Updates

Read updated files to confirm correctness:

```bash
echo "=== Updated CLAUDE.md ==="
cat .claude/CLAUDE.md

echo ""
echo "=== Updated code-conventions/SKILL.md ==="
cat .claude/skills/code-conventions/SKILL.md

echo ""
echo "=== Updated multi-file-workflows/SKILL.md ==="
cat .claude/skills/multi-file-workflows/SKILL.md

echo ""
echo "=== Updated testing-conventions/SKILL.md ==="
cat .claude/skills/testing-conventions/SKILL.md
```

Confirm the result against the Success Criteria below.

---

## Completion

When all phases are done, emit a one-line summary to the caller — either the list of files updated, or `doc-updater: no prescriptive doc changes needed` when the rubric gated every target — and return control. This step **always runs, including the no-change case**: emitting the summary is a successful return to the caller, not the end of the run — the calling skill continues with its next phase. Do not create tasks or todos; the calling skill owns progress tracking.

---

## Success Criteria

Your documentation update is successful if:

- Only necessary sections are updated; existing structure and formatting preserved
- No exhaustive lists added (no endpoint lists, entity-field lists, or similar inventories)
- Only hard-to-discover patterns documented — nothing obvious from reading code
- All referenced paths exist in the codebase (verified with Glob)
- Every change satisfies at least one binary rubric clause (a/b/c)
- Each file remains within its line bounds:
  - CLAUDE.md 30–250 lines
  - code-conventions/SKILL.md 30–250 lines
  - multi-file-workflows/SKILL.md 20–200 lines
  - testing-conventions/SKILL.md 25–200 lines
- No descriptive prose leaked into the skills (descriptive belongs in the wiki)
- No file under `docs/llm-wiki/**`, no README, and no package-manifest version field was touched

---

## Example Outputs

### Example 1: No Updates Needed

```json
{
  "ticketId": "PROJ-123",
  "changesDetected": {
    "claudeMd": {
      "updateNeeded": false,
      "sections": [],
      "reason": "Changes are implementation details, no architectural patterns affected"
    },
    "codeConventions": {
      "updateNeeded": false,
      "sections": [],
      "reason": "No clause (a/b/c) satisfied"
    },
    "multiFileWorkflows": { "updateNeeded": false, "sections": [], "reason": "No cross-file workflow change" },
    "testingConventions": { "updateNeeded": false, "sections": [], "reason": "No reusable test rule change" }
  },
  "updates": {
    "claudeMd": [],
    "codeConventions": [],
    "multiFileWorkflows": [],
    "testingConventions": []
  }
}
```

→ Then report `doc-updater: no prescriptive doc changes needed` and **return control to the caller. This is a successful result, NOT the end of the run — `/implement-ticket` continues with Phase 8.4.**

### Example 2: New Gotcha + Cross-File Workflow (rubric clauses a and b)

```json
{
  "ticketId": "PROJ-789",
  "changesDetected": {
    "claudeMd": { "updateNeeded": false, "sections": [], "reason": "No cheat-sheet impact" },
    "codeConventions": {
      "updateNeeded": true,
      "sections": ["Gotchas"],
      "reason": "Rubric clause (a/b): transaction wrapper is a prescriptive rule — bare repo.save corrupts state on partial failure"
    },
    "multiFileWorkflows": {
      "updateNeeded": true,
      "sections": ["Adding a new entity"],
      "reason": "Rubric clause (b): workflow now also requires registering the entity in EntityRegistry — cross-file step"
    },
    "testingConventions": { "updateNeeded": false, "sections": [], "reason": "No clause satisfied" }
  },
  "recommendation": "Descriptive context about the new EntityRegistry belongs in /wiki-refresh, not here.",
  "updates": {
    "codeConventions": [
      {
        "section": "Gotchas",
        "action": "add",
        "before": null,
        "after": "### Inventory writes must go through dataSource.transaction\n\n```typescript\n// WRONG\nawait inventoryRepo.save(inv);\n```\n\n```typescript\n// CORRECT\nreturn dataSource.transaction(async (m) => m.save(Inventory, inv));\n```",
        "justification": "Prescriptive rule — bare save corrupts state on partial failure"
      }
    ],
    "multiFileWorkflows": [
      {
        "section": "Adding a new entity",
        "action": "update",
        "before": "1. Create migration\n2. Update entity class",
        "after": "1. Create migration\n2. Update entity class\n3. Register in `apps/api/src/entity-registry.ts`",
        "justification": "Rubric clause (b): EntityRegistry is now a required cross-file step"
      }
    ]
  }
}
```

→ Apply the edits above, then report `doc-updater: updated code-conventions/SKILL.md, multi-file-workflows/SKILL.md` and return control to the caller.

---

## Integration with implement-ticket

This skill is invoked from `implement-ticket` Phase 8. The caller derives the changed-file list and ticket ID, then invokes the skill:

```bash
CHANGED_FILES=$(git diff --name-only origin/main...HEAD)
echo "Changed files: $CHANGED_FILES"
echo "Ticket ID: $TICKET_ID"
```

The skill detects changed files via git, analyzes each against the binary rubric, updates only the four in-scope targets when a clause is satisfied, and returns a one-line completion summary (see Completion).

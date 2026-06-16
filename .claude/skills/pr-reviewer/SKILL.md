---
name: pr-reviewer
version: 4.0.0
last-updated: 2026-05-14
description: Reviews a GitHub Pull Request using a deterministic-glue plus specialist-agent pipeline. Invoked by /implement-ticket Phase 10 once per PR URL; also user-invocable directly. Supports single-repo and multi-repo modes.
allowed-tools: Bash, Read, Grep, Glob, Task
argument-hint: '[--pr-url <URL>] [--jira-key <KEY>] [--mode automated|manual] [--artifacts-dir <abs>] [--repos <abs1>,<abs2>,...] [--aggregate]'
user-invocable: true
disable-model-invocation: false
---

# PR Reviewer

Input: $ARGUMENTS

Parse the input for these flags:
- `--pr-url <URL>` — GitHub PR URL to review (required unless `--aggregate`)
- `--jira-key <KEY>` — JIRA ticket key for artifact namespacing
- `--mode automated|manual` — automated writes JSON and returns; manual pauses for human edit before posting (default: automated)
- `--artifacts-dir <abs>` — absolute dir to write output under (`<dir>/pr/...`); parsed into `$ARTIFACTS_DIR_FLAG`. Passed by `/implement-ticket`. When omitted, falls back to the relative default — see Artifact Paths.
- `--repos <abs1>,<abs2>,...` — absolute paths to repo roots in multi-repo mode
- `--aggregate` — skip review pipeline; run cross-repo aggregator over existing per-PR JSONs for this JIRA key

## Artifact Paths

Resolve the base once: use `--artifacts-dir` (`$ARTIFACTS_DIR_FLAG`, absolute, passed by `/implement-ticket`) when given, else the prior relative default. Every path below is `$ARTIFACTS_BASE/pr/...`.

```bash
ARTIFACTS_BASE="${ARTIFACTS_DIR_FLAG:-.claude-temp/artifacts/${JIRA_KEY}}"
```

**Single-repo:**
```
$ARTIFACTS_BASE/pr/review/
  review-results.json
  review.md
  human.md
  inline.md
  iteration-{N}.json
```

**Multi-repo (per PR):**
```
$ARTIFACTS_BASE/pr/<repo-basename>/review/
  review-results.json
  review.md
  human.md
  inline.md
  iteration-{N}.json
```

**Cross-repo summary (--aggregate only):**
```
$ARTIFACTS_BASE/pr/cross-repo-summary.json
$ARTIFACTS_BASE/pr/cross-repo-summary.md
```

## Pipeline Architecture

```
/pr-reviewer --pr-url <URL> --jira-key <KEY>
  1. fetch_pr_data.py            (deterministic: gh CLI → JSON)
  2. detect-stack agent          (1 LLM call, cache-friendly; returns language/framework profile)
  3. context-pack builder        (diff + neighbor symbols via code-graph MCP if available, else AST grep)
  4. parallel specialist agents  (bug-logic, security-style, tests, performance, conventions)
  5. coordinator/judge agent     (deduplicates, severity-grades, applies do-not-flag list, max 5 nits)
  6. devil's-advocate critic     (severity >= major only; 1 round)
  7. verifier                    (greps each cited file:line; drops hallucinations)
  8. generate_review_files.py    (deterministic: results.json → review.md / human.md / inline.md)
  9. add_inline_comment.py       (deterministic: posts to GitHub via gh CLI)
```

When `--aggregate` is passed and multiple per-PR JSONs exist under `$ARTIFACTS_BASE/pr/`, run **only** the cross-repo aggregator agent and skip steps 1–9.

## Execution

### Step 1: Fetch PR Data

```bash
ARTIFACTS_BASE="${ARTIFACTS_DIR_FLAG:-.claude-temp/artifacts/${JIRA_KEY}}"
REVIEW_DIR="$ARTIFACTS_BASE/pr/${REPO_BASENAME}/review"
mkdir -p "$REVIEW_DIR"

python skills/030-quality-assurance/pr-reviewer/scripts/fetch_pr_data.py \
  "$PR_URL" \
  --output-dir "$REVIEW_DIR"
```

This populates `$REVIEW_DIR/PRs/<repo>/<PR_NUMBER>/` with:
- `metadata.json` — title, author, state, branches, labels, headSha, baseSha, linesChanged, filesChanged
- `diff.patch` — full PR diff from gh CLI
- `comments.json` — existing review comments
- `commits.json` — commit history
- `related_issues.json` — linked GitHub issues
- `SUMMARY.txt` — human-readable summary

### Step 2: Detect Stack

Spawn a Task sub-agent using the role prompt at `agents/specialist-bug-logic.md` — no, use the detect-stack role inline:

```
Spawn Task sub-agent:
  prompt: |
    Read the following files and return a JSON object with fields:
    - primaryLanguage: string (e.g. "TypeScript", "Python", "Go")
    - frameworks: string[] (e.g. ["React", "NestJS"])
    - testRunner: string (e.g. "Jest", "Pytest", "Go test")
    - packageManagers: string[]
    - linters: string[]

    Files to read:
    - <REVIEW_DIR>/PRs/<repo>/<PR_NUMBER>/metadata.json
    - <REPO_PATH>/{package.json,go.mod,Cargo.toml,pyproject.toml,pom.xml,Gemfile,composer.json,*.csproj} (whichever exists)
    Output raw JSON only.
```

Persist the result to `$REVIEW_DIR/stack-profile.json`.

### Step 3: Build Context Pack

Read `$REVIEW_DIR/PRs/<repo>/<PR_NUMBER>/diff.patch`. For each changed file path in the diff:
- Skip files matching: `*.lock`, `*-lock.json`, `*.min.js`, `dist/`, `build/`, `vendor/`, `node_modules/`, `generated/`
- If `mcp__code_graph__get_minimal_context_tool` is available, call it once with `{ task: "PR review for <PR_TITLE>", changed_files: [<list>] }` and include the response.
- Otherwise, for each changed file, Grep for function/class signatures ±20 lines around changed line ranges.

Persist context to `$REVIEW_DIR/context-pack.json`.

### Step 4: Parallel Specialist Agents

Spawn four Task sub-agents concurrently, each loading its role prompt from the `agents/` directory:

```
Task(agents/specialist-bug-logic.md,     context: diff + stack + context-pack) → bug-findings.json
Task(agents/specialist-security-style.md, context: diff + stack + context-pack) → security-findings.json
Task(agents/specialist-tests.md,         context: diff + stack + context-pack) → tests-findings.json
Task(agents/specialist-performance.md,   context: diff + stack + context-pack) → perf-findings.json
Task(agents/specialist-conventions.md,   context: diff + stack + context-pack + code-conventions skill) → conv-findings.json
```

Wait for all four to complete. Each produces a JSON array of `Finding` objects (see schema below).

### Step 5: Coordinator / Judge

Spawn `Task(agents/coordinator-judge.md)` with:
- All specialist findings arrays merged
- Stack profile
- `references/review_criteria.md` (the rubric)
- Cap: at most 5 nits in the final output; additional nits summarised as "plus N similar items"

The coordinator produces the consolidated `review-results.json` (see schema below).

### Step 6: Devil's Advocate Critic

If `review-results.json` contains any findings with `severity == "major"` or `severity == "blocking"`:

```
Spawn Task(agents/devils-advocate-critic.md) with review-results.json
```

The critic must produce at least one alternate hypothesis per finding it challenges. Its output is a `CriticReport` JSON. Merge accepted challenges back into `review-results.json` (downgrade severity or drop finding per critic's verdict).

Skip this step if all findings are `severity == "minor"`.

### Step 7: Verifier

For each finding in the final `review-results.json` that has a non-null `file` and `line`:

```bash
# Confirm the cited line exists and contains the cited code snippet
grep -n "" "<REPO_PATH>/<finding.file>" | sed -n "${finding.line}p"
```

Drop any finding where the file does not exist or the line does not exist. Log dropped findings to `$REVIEW_DIR/verifier-drops.json`.

### Step 8: Generate Review Files

```bash
python skills/030-quality-assurance/pr-reviewer/scripts/generate_review_files.py \
  "$REVIEW_DIR" \
  --findings "$REVIEW_DIR/review-results.json" \
  --metadata "$REVIEW_DIR/PRs/<repo>/<PR_NUMBER>/metadata.json"
```

Produces `review.md`, `human.md`, `inline.md` in `$REVIEW_DIR`.

### Step 9: Post Inline Comments

In **automated** mode, post inline comments immediately:

```bash
python skills/030-quality-assurance/pr-reviewer/scripts/add_inline_comment.py \
  <OWNER> <REPO> <PR_NUMBER> <HEAD_SHA> \
  "<finding.file>" <finding.line> "<finding.issue>"
```

In **manual** mode, pause here. Present the user with:
- Path to `$REVIEW_DIR/human.md` — review before posting
- Path to `$REVIEW_DIR/inline.md` — proposed inline comments

When the user approves with `/send`:
```bash
gh pr comment <PR_NUMBER> --repo <OWNER>/<REPO> --body-file "$REVIEW_DIR/human.md"
gh pr review <PR_NUMBER> --repo <OWNER>/<REPO> --request-changes
```

When the user declines all changes with `/send-decline`:
```bash
gh pr comment <PR_NUMBER> --repo <OWNER>/<REPO> --body-file "$REVIEW_DIR/human.md"
gh pr review <PR_NUMBER> --repo <OWNER>/<REPO> --approve
```

### Aggregate Mode (--aggregate)

When `--aggregate` is passed:

0. Resolve `$ARTIFACTS_BASE` (see Artifact Paths) — same base the per-PR runs used.
1. Find all `review-results.json` files under `$ARTIFACTS_BASE/pr/*/review/`
2. If fewer than 2 exist, emit a warning and exit cleanly (no cross-repo concerns to aggregate)
3. Spawn `Task(agents/cross-repo-aggregator.md)` with all per-PR JSONs and the JIRA key
4. Write output to:
   - `$ARTIFACTS_BASE/pr/cross-repo-summary.json`
   - `$ARTIFACTS_BASE/pr/cross-repo-summary.md`

## Output Schema

### review-results.json

```json
{
  "jiraKey": "PROJ-123",
  "prUrl": "https://github.com/owner/repo/pull/456",
  "prNumber": 456,
  "reviewIteration": 1,
  "timestamp": "2026-05-14T10:30:00Z",
  "overallStatus": "CHANGES_REQUESTED",
  "summary": "2 blocking issues, 1 major issue, 3 minor issues",
  "repository": {
    "owner": "owner",
    "name": "repo",
    "path": "/abs/path/to/repo"
  },
  "prMetadata": {
    "commitSha": "abc123",
    "baseRef": "main",
    "headRef": "feat/my-feature",
    "linesChanged": 245,
    "filesChanged": 8
  },
  "findings": {
    "blocking": [
      {
        "id": "SEC-001",
        "category": "Security",
        "severity": "blocking",
        "issue": "SQL injection via string concatenation",
        "file": "src/user/repository.ts",
        "line": 45,
        "details": "User-controlled input is concatenated directly into a query string",
        "codeSnippet": "const q = `SELECT * FROM users WHERE id = ${userId}`;",
        "fixInstructions": {
          "action": "replace",
          "file": "src/user/repository.ts",
          "line": 45,
          "oldCode": "const q = `SELECT * FROM users WHERE id = ${userId}`;",
          "newCode": "const q = repo.createQueryBuilder('u').where('u.id = :id', { id: userId });",
          "explanation": "Use parameterized queries to prevent SQL injection"
        },
        "testSuggestion": "Add test with userId = '1 OR 1=1'",
        "references": ["https://owasp.org/www-community/attacks/SQL_Injection"]
      }
    ],
    "major": [],
    "minor": []
  },
  "metrics": {
    "totalFindings": 6,
    "blockingCount": 2,
    "majorCount": 1,
    "minorCount": 3,
    "filesReviewed": 8,
    "linesChanged": 245
  },
  "tokenUsage": {
    "input": 12400,
    "output": 3200,
    "cached_input": 9800,
    "cache_creation": 2100
  },
  "recommendations": [
    "Run `npm audit` to check for dependency vulnerabilities"
  ],
  "nextSteps": {
    "action": "TRIGGER_FIX_ITERATION",
    "reason": "Blocking issues found that require fixes before merge",
    "maxIterations": 3,
    "currentIteration": 1
  }
}
```

### cross-repo-summary.json

```json
{
  "ticketId": "PROJ-123",
  "prs": [
    {
      "repo": "shared-lib",
      "url": "https://github.com/org/shared-lib/pull/12",
      "blockingCount": 1,
      "majorCount": 0,
      "minorCount": 2,
      "overallStatus": "CHANGES_REQUESTED"
    }
  ],
  "crossRepoConcerns": [
    {
      "kind": "api-contract-mismatch",
      "summary": "shared-lib exports changed interface but consumer-a still imports old signature",
      "evidence": [
        { "repo": "shared-lib", "file": "src/api.ts", "line": 12 },
        { "repo": "consumer-a", "file": "src/client.ts", "line": 34 }
      ]
    }
  ],
  "mergeOrder": ["shared-lib", "consumer-a"]
}
```

## Finding Schema

```typescript
interface Finding {
  id: string;
  category: string;
  severity: "blocking" | "major" | "minor";
  issue: string;
  file: string | null;
  line: number | null;
  details: string;
  codeSnippet: string | null;
  fixInstructions: FixInstruction;
  testSuggestion: string | null;
  references: string[];
}

interface FixInstruction {
  action: "replace" | "add" | "delete" | "refactor";
  file: string;
  line?: number;
  insertAfterLine?: number;
  oldCode?: string;
  newCode?: string;
  explanation: string;
}
```

## Severity Definitions

- **blocking** — must be fixed before merge. Real bugs, security vulnerabilities, broken contracts, data loss risk, tests that fail.
- **major** — should be fixed. Missing tests for new public APIs, uncaught error paths, unguarded external inputs, performance regressions with evidence.
- **minor** — optional improvement. At most 5 per review. Additional nits are summarised as "plus N similar items" in the review summary.

## Multi-Repo Behaviour

When invoked by `/implement-ticket` Phase 10 with multiple PR URLs, each invocation of `/pr-reviewer --pr-url <URL> --artifacts-dir "$ARTIFACTS_DIR"` is independent and writes to its own `$ARTIFACTS_BASE/pr/<repo-basename>/review/` directory. The absolute `--artifacts-dir` keeps every tree at the workspace root, even though each invocation targets a child repo via `--repos`.

After all per-PR invocations complete, `/implement-ticket` calls `/pr-reviewer --aggregate --jira-key <KEY> --artifacts-dir "$ARTIFACTS_DIR"` once. It reads all per-PR JSONs and produces the cross-repo summary.

## References

- `references/review_criteria.md` — binary rubric (Always / Conditionally / Never flag)
- `references/gh_cli_guide.md` — gh CLI command reference
- `references/scenarios.md` — common review scenarios
- `references/troubleshooting.md` — error patterns and fixes
- `agents/` — role prompts for each specialist and the coordinator
- `scripts/README.md` — deterministic glue script documentation

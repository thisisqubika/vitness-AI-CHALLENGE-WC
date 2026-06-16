# Cross-Repo Aggregator

## objective

Read the per-PR `review-results.json` files produced for each repository in a multi-repo ticket. Identify concerns that span repository boundaries — API contract mismatches, schema version skew, shared library changes that affect consumers, dependency version conflicts, merge ordering constraints. Produce `cross-repo-summary.json` and a human-readable `cross-repo-summary.md`.

This agent runs only when `--aggregate` is passed and at least two per-PR review results exist for the same JIRA key. It does not re-review individual PRs; it reasons only about cross-repo relationships.

## output_format

Produce two files.

**cross-repo-summary.json:**

```json
{
  "ticketId": "<JIRA_KEY>",
  "prs": [
    {
      "repo": "<repo-basename>",
      "url": "<PR URL>",
      "blockingCount": 0,
      "majorCount": 0,
      "minorCount": 0,
      "overallStatus": "APPROVED | CHANGES_REQUESTED | COMMENTED"
    }
  ],
  "crossRepoConcerns": [
    {
      "kind": "api-contract-mismatch | schema-version-skew | shared-dependency-conflict | merge-order-constraint | other",
      "summary": "one-paragraph description of the concern",
      "evidence": [
        { "repo": "<repo-basename>", "file": "<relative path>", "line": 42 }
      ],
      "recommendation": "what the developer should do to resolve this concern"
    }
  ],
  "mergeOrder": ["<repo-basename-first>", "<repo-basename-second>"]
}
```

`mergeOrder` lists the recommended merge sequence when ordering matters (e.g. shared lib before consumers). Omit or set to `[]` when order does not matter.

**cross-repo-summary.md:**

A human-readable Markdown summary with sections:
- `## Overview` — table of PRs with status, blocking count, major count
- `## Cross-Repo Concerns` — one subsection per concern, citing evidence with file:line references
- `## Recommended Merge Order` — ordered list with rationale, or "No ordering constraint found"

## tools

- Read: read each per-PR `review-results.json` and the diff patches if available for cross-repo analysis
- Grep: search for exported symbol names from one repo's diff in another repo's diff to detect contract mismatches
- Bash: run `grep -rn` to find API surface in changed files and check for corresponding usage in sibling repo diffs

## boundaries

- Read only `review-results.json` files and their associated diff patches. Do not re-read the full repositories.
- A cross-repo concern requires evidence from at least two different repos' diffs. Do not emit speculative concerns.
- Evidence citations (`file:line`) MUST reference specific lines from the diff patches you read. If you cannot cite a specific line, omit the `line` field (set to `null`).
- `kind` values: use `api-contract-mismatch` for changed exported function signatures with mismatched consumers, `schema-version-skew` for database or message-format versioning gaps, `shared-dependency-conflict` for incompatible version ranges for a shared dependency, `merge-order-constraint` when the correct merge sequence is non-obvious, `other` for anything else.
- Merge order: recommend the sequence that minimises integration breakage. When a shared library is changed and a consumer depends on it, the library merges first.
- If no cross-repo concerns exist, set `crossRepoConcerns: []` and state that explicitly in the Markdown summary.

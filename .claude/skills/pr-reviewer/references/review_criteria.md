# Review Criteria Rubric

This document is the binary decision rubric for all specialist agents and the coordinator/judge. Every finding must pass through the three sections below before being emitted. The "Never flag" list is enforced by the coordinator as a hard filter.

## Severity Definitions

- **blocking** — must be fixed before this PR can merge. Examples: real bug, security vulnerability, broken contract, data loss risk, failing test.
- **major** — should be fixed before merge. Examples: missing test for a new public API, uncaught error path on an external boundary, performance regression with concrete evidence, unguarded external input.
- **minor** — optional improvement, no blocking issue. At most 5 minor findings per review. If more exist, the coordinator summarises the excess as "plus N similar items".

## Always Flag

Flag these regardless of context. They are automatic at the stated severity.

| Issue | Minimum severity | Notes |
|---|---|---|
| SQL injection (string concatenation in a query) | blocking | |
| Command injection (unescaped user input in shell exec) | blocking | |
| Path traversal (user-controlled file path without sanitisation) | blocking | |
| Hardcoded credential, API key, or secret | blocking | |
| Authentication bypass (new endpoint without auth check) | blocking | |
| Crash in a normal execution path (unhandled exception, null dereference) | blocking | |
| Test suite invocation that fails on the diff as-is | blocking | |
| Broken exported contract (changed function signature with no caller update) | blocking | |
| Missing test for a new exported public API | major | |
| Missing error handler on a network or database call in a public function | major | |
| N+1 database query with concrete evidence in the diff | major | |
| New dependency pinned to a version with a known CVE (cite the CVE) | major | |
| Module or file placed in a directory that breaks the build or test runner's discovery | major | |

## Conditionally Flag

Flag these only when the diff contains concrete evidence of the problem. Do not speculate.

| Issue | Severity | Required evidence |
|---|---|---|
| Off-by-one error | major or blocking | Quote the specific lines; explain the incorrect boundary condition |
| Missing null guard | major | Show that the value can be null at the call site in the diff |
| Performance regression | major | Quote the loop + I/O call; estimate the request-time impact |
| Readability that affects correctness | minor | Explain how the unclear name could cause a caller to misuse the API |
| Convention violation | minor or major | Cite where the convention is established (skill doc or adjacent file) |
| Missing edge-case test | minor | Name the missing case; explain why it is reachable |
| Logging of sensitive data | minor | Quote the log statement; identify what field is sensitive |

## Never Flag

The coordinator MUST drop any finding that falls into this list before emitting `review-results.json`.

- Style issues already enforced by the project linter (ESLint, Pylint, RuboCop, golangci-lint, etc.)
- Formatting differences (indentation, trailing whitespace, import ordering)
- Naming preferences that are not established project conventions
- Pre-existing issues in code that this PR did not touch
- Speculative performance concerns with no evidence in the diff ("this might be slow")
- "Could be cleaner" observations with no correctness impact
- Suggestions to use a different language feature when the current one is correct
- Missing comments or documentation on internal helpers (only flag missing docs on exported public API)
- Commit message style or PR description quality (out of scope for code review)
- Test coverage for unchanged code paths

## Nit Cap

The `minor` findings array in `review-results.json` MUST contain at most **5 entries**. The coordinator selects the 5 most impactful minor findings by affected surface area (public API > service boundary > internal helper). Excess minor findings are captured as a single `recommendations` string: "plus N additional minor observations not listed individually".

## Do-Not-Flag Reference Check

Before the coordinator emits any finding, it MUST verify:

1. The issue exists in a file changed by this PR (not in unchanged code).
2. The issue is not in the "Never flag" list above.
3. The evidence (`file:line` and `codeSnippet`) can be confirmed by a `grep` on the current file. If it cannot, the finding is dropped by the verifier.

Specialists are expected to self-apply this check. The coordinator enforces it as a hard gate.

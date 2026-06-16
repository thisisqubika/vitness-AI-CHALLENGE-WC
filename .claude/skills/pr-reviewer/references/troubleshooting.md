# Troubleshooting

Common issues and solutions for the PR Reviewer skill.

## gh CLI Not Found

```bash
# macOS
brew install gh

# Linux (Debian/Ubuntu)
sudo apt install gh

gh auth login
```

## Authentication Errors

```bash
# Check status
gh auth status

# Refresh with repo scope
gh auth refresh -s repo
```

## Invalid PR URL

Ensure format: `https://github.com/<owner>/<repo>/pull/<NUMBER>`

The `fetch_pr_data.py` script validates this format and exits non-zero with a clear error message if the URL is malformed.

## Inline Comment Line Number Mismatch

Inline comment `line` parameters are **diff-relative**, not file-absolute. Use:

```bash
gh pr diff <number> --repo <owner>/<repo> | cat -n
```

to find the correct diff position before calling `add_inline_comment.py`.

## Rate Limit Errors

```bash
# Check current limits
gh api /rate_limit

# Authenticated users: 5000 requests/hour
gh auth login
```

## fetch_pr_data.py Fails

Common causes and fixes:

| Symptom | Cause | Fix |
|---|---|---|
| `403 Forbidden` | Insufficient token scope | `gh auth refresh -s repo` |
| `404 Not Found` | PR number wrong or repo private | `gh repo view <owner>/<repo>` to confirm access |
| `jq` parse error | Malformed API response | Check `gh api /rate_limit` for exhaustion |
| Script exits with "PR URL required" | `--pr-url` flag missing | Pass `--pr-url https://github.com/...` |

## generate_review_files.py Fails

Common causes and fixes:

| Symptom | Cause | Fix |
|---|---|---|
| `FileNotFoundError` on findings JSON | Wrong path to `review-results.json` | Pass the correct `--findings` path |
| Empty `human.md` | No findings in the JSON | Normal when the PR has no issues |
| Unicode decode error | Non-UTF-8 in diff patch | `fetch_pr_data.py` already sanitises; re-run fetch |

## add_inline_comment.py Fails

| Symptom | Cause | Fix |
|---|---|---|
| `422 Unprocessable Entity` | Wrong diff line position or commit SHA | Use the latest commit SHA from `fetch_pr_data.py` output; verify diff position |
| `403 Forbidden` | Token lacks `pull_requests: write` | `gh auth refresh -s repo` |

## Verifier Drops All Findings

This means the coordinator cited `file:line` references that cannot be confirmed by `grep` in the current tree. Possible causes:

1. The diff was fetched before the branch was pushed — re-fetch with `fetch_pr_data.py`.
2. The agent hallucinated a line number — the verifier correctly drops it.
3. The file was renamed after the diff was fetched — re-fetch.

Re-running the full pipeline after re-fetching resolves most cases.

## cross-repo-summary.json Not Written

The aggregator only runs when `--aggregate` is passed AND at least two per-PR `review-results.json` files exist under `.claude-temp/artifacts/<JIRA_KEY>/pr/*/review/`. Verify:

```bash
find .claude-temp/artifacts/<JIRA_KEY>/pr -name review-results.json
```

If fewer than 2 results appear, the per-PR reviews have not completed yet.

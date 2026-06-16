# GitHub CLI Reference for PR Reviews

Quick command reference for accessing PR data using the GitHub CLI (`gh`).

## Prerequisites

Install and authenticate:

```bash
# macOS
brew install gh

# Linux (Debian/Ubuntu)
sudo apt install gh

gh auth login
gh auth status
```

## PR Information

```bash
# View PR details
gh pr view <number> --repo <owner>/<repo>

# JSON output with specific fields
gh pr view <number> --repo <owner>/<repo> \
  --json number,title,body,state,author,headRefName,baseRefName,\
  headRefOid,baseRefOid,additions,deletions,changedFiles

# View PR diff
gh pr diff <number> --repo <owner>/<repo>

# List files changed
gh pr view <number> --repo <owner>/<repo> --json files --jq '.files[].path'
```

## Comments and Reviews

```bash
# Review comments on code lines (paginated)
gh api /repos/<owner>/<repo>/pulls/<number>/comments --paginate

# Formatted: path, line, author, body
gh api /repos/<owner>/<repo>/pulls/<number>/comments \
  --jq '.[] | {path, line, body, user: .user.login}'

# PR-level reviews (APPROVE, CHANGES_REQUESTED, COMMENT)
gh api /repos/<owner>/<repo>/pulls/<number>/reviews \
  --jq '.[] | {state, user: .user.login, body}'

# General issue comments (PR body-level comments)
gh api /repos/<owner>/<repo>/issues/<number>/comments
```

## Commits

```bash
# List commits
gh api /repos/<owner>/<repo>/pulls/<number>/commits \
  --jq '.[] | {sha: .sha[0:7], message: .commit.message}'

# Get latest commit SHA (used for inline comments)
gh api /repos/<owner>/<repo>/pulls/<number>/commits --jq '.[-1].sha'

# Get commit diff
gh api /repos/<owner>/<repo>/commits/<sha> \
  -H "Accept: application/vnd.github.diff"
```

## Branch Information

```bash
# Source branch (head)
gh pr view <number> --repo <owner>/<repo> --json headRefName --jq '.headRefName'

# Target branch (base)
gh pr view <number> --repo <owner>/<repo> --json baseRefName --jq '.baseRefName'

# Compare two branches
gh api /repos/<owner>/<repo>/compare/<base>...<head> \
  --jq '.files[] | {filename, status, additions, deletions}'
```

## Linked Issues and Tickets

```bash
# PR body (may contain #123 or JIRA-456 references)
gh pr view <number> --repo <owner>/<repo> --json body --jq '.body'

# Extract issue references
gh pr view <number> --repo <owner>/<repo> --json body --jq '.body' \
  | grep -oE '#[0-9]+'

# Get linked issue details
gh issue view <number> --repo <owner>/<repo> \
  --json number,title,body,state,labels
```

## Status Checks

```bash
# CI check status
gh pr checks <number> --repo <owner>/<repo>

# Check runs for a specific commit
gh api /repos/<owner>/<repo>/commits/<sha>/check-runs \
  --jq '.check_runs[] | {name, status, conclusion}'
```

## Adding Comments

```bash
# Inline code comment (diff line number, not file line number — see note below)
gh api -X POST /repos/<owner>/<repo>/pulls/<number>/comments \
  -f body="Your comment" \
  -f commit_id="<sha>" \
  -f path="src/file.ts" \
  -f side="RIGHT" \
  -f line=42

# Multi-line inline comment
gh api -X POST /repos/<owner>/<repo>/pulls/<number>/comments \
  -f body="Multi-line comment" \
  -f commit_id="<sha>" \
  -f path="src/file.ts" \
  -f side="RIGHT" \
  -f start_line=40 \
  -f start_side="RIGHT" \
  -f line=45

# General PR comment
gh pr comment <number> --repo <owner>/<repo> --body "Your comment"
```

## Submitting a Review

```bash
# Approve
gh api -X POST /repos/<owner>/<repo>/pulls/<number>/reviews \
  -f body="LGTM" \
  -f event="APPROVE" \
  -f commit_id="<sha>"

# Request changes
gh api -X POST /repos/<owner>/<repo>/pulls/<number>/reviews \
  -f body="Please address these issues" \
  -f event="REQUEST_CHANGES" \
  -f commit_id="<sha>"

# Comment without blocking
gh api -X POST /repos/<owner>/<repo>/pulls/<number>/reviews \
  -f body="See comments" \
  -f event="COMMENT" \
  -f commit_id="<sha>"
```

## Diff Line Numbers for Inline Comments

The `line` parameter in inline comments refers to the **position in the diff**, not the absolute line number in the file.

```bash
# View diff with line numbers to find position
gh pr diff <number> --repo <owner>/<repo> | cat -n

# Get file-level diff data (includes patch positions)
gh api /repos/<owner>/<repo>/pulls/<number>/files \
  --jq '.[] | select(.filename == "src/file.ts") | {patch}'
```

`side: "RIGHT"` refers to the new version of the file (after the PR change).
`side: "LEFT"` refers to the old version.

## Useful JQ Patterns

```bash
# Extract a field
--jq '.field'

# Iterate an array
--jq '.array[].field'

# Filter
--jq '.[] | select(.field == "value")'

# Count
--jq '. | length'

# Map
--jq '.array | map(.field)'
```

## Rate Limits

```bash
# Check current rate limit
gh api /rate_limit

# Authenticated users get 5000 requests/hour (unauthenticated: 60)
gh auth status
```

## Error Handling

| HTTP code | Cause | Fix |
|---|---|---|
| 401 Unauthorized | Token expired | `gh auth refresh` |
| 403 Forbidden | Missing scope | `gh auth refresh -s repo` |
| 404 Not Found | Private repo or wrong PR number | `gh repo view <owner>/<repo>` to confirm access |
| 422 Unprocessable | Invalid parameters | Check flag names and value types |

## References

- GitHub CLI docs: https://cli.github.com/manual/
- GitHub REST API: https://docs.github.com/en/rest
- PR Comments API: https://docs.github.com/en/rest/pulls/comments
- PR Reviews API: https://docs.github.com/en/rest/pulls/reviews
- jq manual: https://jqlang.github.io/jq/manual/

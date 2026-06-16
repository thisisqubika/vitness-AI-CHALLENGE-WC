# Scripts

Deterministic glue scripts that wrap the `gh` CLI and produce/consume structured JSON. These scripts contain no LLM logic; they are idempotent and exit non-zero on hard failure.

## fetch_pr_data.py

Fetches all PR data from GitHub via the `gh` CLI and organises it into a structured directory.

```
python fetch_pr_data.py <pr_url> [--output-dir <dir>] [--no-clone]
```

| Flag | Default | Description |
|---|---|---|
| `<pr_url>` | (required) | Full GitHub PR URL: `https://github.com/<owner>/<repo>/pull/<N>` |
| `--output-dir` | `/tmp` | Base directory for output |
| `--no-clone` | false | Skip cloning the source branch (faster; omits `git_diff.patch`) |

**Output structure** (written to `<output-dir>/PRs/<repo>/<PR_NUMBER>/`):

```
metadata.json       # PR title, author, state, branches, labels, headSha, baseSha, linesChanged, filesChanged
diff.patch          # Full PR diff from gh CLI
git_diff.patch      # Git diff between base and head (only when cloned)
comments.json       # Inline review comments
commits.json        # Commit history
related_issues.json # Linked GitHub issues
ticket_numbers.json # Extracted JIRA and GitHub issue references
SUMMARY.txt         # Human-readable summary of all fetched data
```

**Exit codes**: `0` on success; `1` on invalid URL, authentication failure, or network error.

## generate_review_files.py

Converts a `review-results.json` findings object into three human-readable review files.

```
python generate_review_files.py <pr_review_dir> --findings <findings_json> [--metadata <metadata_json>]
```

| Flag | Default | Description |
|---|---|---|
| `<pr_review_dir>` | (required) | Output directory (same as `--output-dir` from `fetch_pr_data.py`) |
| `--findings` | (required) | Path to `review-results.json` |
| `--metadata` | auto-detected | Path to `metadata.json` (auto-detected if inside `pr_review_dir`) |

**Output** (written to `<pr_review_dir>/`):

```
review.md    # Detailed internal review with line numbers and severity markers
human.md     # Clean review suitable for posting as a GitHub PR comment (no emojis, no line numbers)
inline.md    # Proposed inline comment commands for each finding with a file:line citation
```

**Exit codes**: `0` on success; `1` on missing `--findings` file or malformed JSON.

## add_inline_comment.py

Posts a single inline review comment to a GitHub PR via the `gh` CLI API.

```
python add_inline_comment.py <owner> <repo> <pr_number> <commit_id> <file_path> <line> <comment> \
  [--side RIGHT|LEFT] [--start-line N] [--start-side RIGHT|LEFT]
```

| Argument | Description |
|---|---|
| `<owner>` | GitHub repository owner |
| `<repo>` | Repository name |
| `<pr_number>` | Pull request number |
| `<commit_id>` | HEAD commit SHA of the PR branch (from `metadata.json`) |
| `<file_path>` | Relative file path as it appears in the diff |
| `<line>` | **Diff-relative** line number (not file-absolute — see `references/gh_cli_guide.md`) |
| `<comment>` | Comment body text |
| `--side` | `RIGHT` (new file) or `LEFT` (old file); default `RIGHT` |
| `--start-line` | Starting line for a multi-line comment |
| `--start-side` | Side for the start line of a multi-line comment |

**Exit codes**: `0` on success; `1` on authentication failure, invalid parameters, or API error.

**Note on line numbers**: The `line` argument is the position in the diff, not the absolute line number in the file. Use `gh pr diff <number> | cat -n` to find the correct position. The pipeline's verifier step confirms each `file:line` exists in the current tree before this script is called.

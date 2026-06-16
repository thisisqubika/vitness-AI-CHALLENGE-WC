# Review Scenarios

Common workflows for specific review use cases.

## Scenario 1: Quick Automated Review

**Trigger**: `/implement-ticket` Phase 10 invokes `/pr-reviewer --pr-url <URL> --jira-key <KEY> --mode automated`.

**Workflow**:
1. `fetch_pr_data.py` fetches PR metadata, diff, comments, commits into `$REVIEW_DIR`
2. Detect-stack step identifies language and framework from manifest files
3. Context-pack builder reads diff and fetches neighbor symbols
4. Parallel specialists produce findings JSONs
5. Coordinator consolidates, deduplicates, applies rubric, caps nits at 5
6. Critic runs if `major` or `blocking` findings exist
7. Verifier confirms each `file:line` citation
8. `generate_review_files.py` produces `review.md`, `human.md`, `inline.md`
9. `add_inline_comment.py` posts inline comments; `review-results.json` is written

**Outcome**: `$REVIEW_DIR/review-results.json` exists with a stable schema for `/implement-ticket` to consume.

## Scenario 2: Manual Review with Human Edit

**Trigger**: User invokes `/pr-reviewer --pr-url <URL> --mode manual`.

**Workflow**:
1–7. Same as Scenario 1.
8. `generate_review_files.py` produces `review.md`, `human.md`, `inline.md`
9. Skill pauses and presents the user with paths to `human.md` and `inline.md`
10. User reviews and optionally edits `human.md`
11. User approves with `/send` (posts and requests changes) or `/send-decline` (posts and approves)

**Outcome**: Review posted to GitHub with the exact content the user reviewed.

## Scenario 3: Security-Focused Review

**Trigger**: User requests a security-specific review, or `specialist-security-style.md` emits a `SEC-DEEP-SCAN` finding.

**Workflow**:
1. Run the full pipeline as in Scenario 1.
2. If `specialist-security-style.md` emitted `SEC-DEEP-SCAN`, the coordinator preserves it as a `major` finding.
3. The orchestrator (or the user) invokes `/security-review --pr-url <URL>` for the full SAST + LLM adjudicator scan.
4. Results from `/security-review` are separate artifacts; they do not overwrite `review-results.json`.

## Scenario 4: Review Against a Linked JIRA Ticket

**Trigger**: `/pr-reviewer --pr-url <URL> --jira-key <KEY>`.

**Workflow**:
1. `fetch_pr_data.py` extracts `ticket_numbers.json` from the PR body and commit messages.
2. The context-pack builder includes the ticket references in the evidence pack.
3. Specialists can read `related_issues.json` to compare PR changes against ticket requirements.
4. The coordinator notes unimplemented acceptance criteria as `major` findings when they are verifiable from the diff.

## Scenario 5: Large PR (>400 lines changed)

**Trigger**: `prMetadata.linesChanged > 400` in `metadata.json`.

**Workflow**:
1. The coordinator adds a `recommendations` entry: "PR exceeds 400 lines changed. Consider splitting into smaller, independently reviewable PRs."
2. The specialists still review the full diff — no truncation.
3. Findings are prioritised by severity: `blocking` > `major` > `minor`.
4. Architecture and contract issues take priority over style in the coordinator's nit-cap selection.

## Scenario 6: Multi-Repo Aggregation

**Trigger**: `/implement-ticket` Phase 10 has reviewed all per-repo PRs and calls `/pr-reviewer --aggregate --jira-key <KEY>`.

**Workflow**:
1. The skill finds all `review-results.json` files under `.claude-temp/artifacts/<KEY>/pr/*/review/`.
2. If fewer than 2 exist, the skill emits a warning and exits cleanly.
3. `agents/cross-repo-aggregator.md` reads all per-PR JSONs and their diff patches.
4. The aggregator identifies cross-repo concerns: API contract mismatches, schema version skew, dependency conflicts, merge ordering constraints.
5. Output: `cross-repo-summary.json` and `cross-repo-summary.md` at `.claude-temp/artifacts/<KEY>/pr/`.

**Outcome**: A single cross-repo view for the ticket reviewer.

## Scenario 7: Iterative Review (Fix and Re-review)

**Trigger**: A previous review produced `nextSteps.action == "TRIGGER_FIX_ITERATION"` and the developer pushed fixes.

**Workflow**:
1. `/implement-ticket` Phase 10 calls `/pr-reviewer --pr-url <URL> --jira-key <KEY>` again.
2. `fetch_pr_data.py` fetches the updated diff (new commits since last review).
3. The pipeline runs identically to Scenario 1.
4. The coordinator sets `reviewIteration` to the previous value + 1.
5. The previous `review-results.json` is renamed to `iteration-{N}.json` before the new one is written.
6. Fixed findings must not reappear; the coordinator consults the previous `iteration-{N}.json` to confirm resolution.

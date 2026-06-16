#!/bin/bash
# ============================================================================
# ENSURE-CONTEXT — deterministic preflight for /create-sdd-ticket and /implement-ticket
# ============================================================================
#
# Single bash entry point that both skills call as their literal first phase.
# Idempotent. Auto-installs every dependency it needs.
#
# Usage (engineer projects):
#   bash <project>/.claude/scripts/ensure-context.sh \
#     [--artifacts-dir <path>] \
#     [--force-graph] [--quiet]
#
# The framework's own copy at `<framework>/scripts/ensure-context.sh` is the
# single source of truth and is also runnable directly during dogfooding.
#
# What it does (in order):
#   1. Auto-install code-review-graph if missing (existing setup-code-graph.sh
#      fallback chain: uv → uvx → uv tool install → bootstrap_uv → pipx → pip).
#   2. Build / incrementally update / no-op the graph based on the
#      state-first tier check in setup-code-graph.sh::decide_graph_tier.
#   3. Override .code-review-graph/.gitignore with the framework allowlist.
#   4. Re-emit .mcp.json (Claude) or .codex/config.toml (Codex) with the
#      machine's local absolute paths.
#   5. Write a JSON success marker at <artifacts-dir>/.preflight-ok carrying
#      git_head + graph_sha so subsequent skill phases can verify the
#      preflight ran for THIS run.
#
# WIKI STALENESS is no longer handled here — it is an AI-driven concern that
# the `/wiki-refresh` skill owns. Phase 8.5 of `/implement-ticket` invokes it
# after implementation; users invoke it directly whenever desired. The wiki
# `.state.json` tracks per-repo commits so the skill can diff cheaply.
#
# Exit code:
#   0  – preflight succeeded; the marker is written.
#   non-zero – something the preflight cannot fix on its own. The skill body
#              STOPs and surfaces our stderr to the user.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-paths.sh
source "$SCRIPT_DIR/lib/resolve-paths.sh"

PROJECT_PATH="$(project_path)"

# Every dependency this preflight needs ships as a sibling of this script,
# either inside the framework checkout (`<framework>/scripts/`) or in the
# engineer-facing copy (`<project>/.claude/scripts/`). No `qubika-agentic-framework/`
# checkout is required at runtime in user projects.
REQUIRED_SIBLING_FILES=(
  "$SCRIPT_DIR/setup-code-graph.sh"
  "$SCRIPT_DIR/code-review-graph-mcp.sh"
  "$SCRIPT_DIR/lib/bootstrap-uv.sh"
  "$SCRIPT_DIR/lib/register-submodules.sh"
)
for __required in "${REQUIRED_SIBLING_FILES[@]}"; do
  if [ ! -f "$__required" ]; then
    echo "[ensure-context] ERROR: required preflight file missing: $__required" >&2
    echo "[ensure-context] The shipped scripts directory at $SCRIPT_DIR appears to be incomplete." >&2
    echo "[ensure-context] Remediation: re-run the framework sync (\`pnpm --filter orchestration sync-framework-resources\`) or re-initialize the project to repopulate $SCRIPT_DIR." >&2
    FAILED_DIR="${ARTIFACTS_DIR:-$PROJECT_PATH/.claude-temp/preflight}"
    mkdir -p "$FAILED_DIR" 2>/dev/null || true
    cat > "$FAILED_DIR/.preflight-failed" 2>/dev/null <<EOF
{
  "reason": "shipped_scripts_missing",
  "missing": "$__required",
  "scripts_dir": "$SCRIPT_DIR",
  "ran_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    exit 4
  fi
done
unset __required REQUIRED_SIBLING_FILES

# ---------- option parsing ----------
ARTIFACTS_DIR=""
FORCE_GRAPH=0
QUIET=0

while [ $# -gt 0 ]; do
  case "$1" in
    --artifacts-dir)
      ARTIFACTS_DIR="$2"; shift 2 ;;
    --artifacts-dir=*)
      ARTIFACTS_DIR="${1#*=}"; shift ;;
    --force-graph)
      FORCE_GRAPH=1; shift ;;
    --quiet)
      QUIET=1; shift ;;
    --help|-h)
      sed -n '2,32p' "$0"; exit 0 ;;
    # Accept-and-ignore legacy flags so older callers don't break the moment
    # they upgrade. Safe to drop after one release cycle.
    --force-wiki|--skip-wiki)
      shift ;;
    *)
      echo "[ensure-context] ERROR: unknown argument: $1" >&2
      exit 2 ;;
  esac
done

# Default artifacts dir: <project>/.claude-temp/preflight (or .codex-temp/).
if [ -z "$ARTIFACTS_DIR" ]; then
  if [ -d "$PROJECT_PATH/.codex" ] && [ ! -d "$PROJECT_PATH/.claude" ]; then
    ARTIFACTS_DIR="$PROJECT_PATH/.codex-temp/preflight"
  else
    ARTIFACTS_DIR="$PROJECT_PATH/.claude-temp/preflight"
  fi
fi

# Anchor a caller-supplied relative --artifacts-dir (e.g. ".claude-temp/tickets/X/artifacts")
# to the deterministic project root. PROJECT_PATH comes from resolve-paths.sh, which is
# cwd-independent — so the marker, and every phase that reads it back, always lands under
# the workspace root and never inside a child repo, regardless of the caller's cwd.
case "$ARTIFACTS_DIR" in
  /*) : ;;
  *) ARTIFACTS_DIR="$PROJECT_PATH/$ARTIFACTS_DIR" ;;
esac

# ---------- logging ----------
log_info() {
  if [ "$QUIET" -eq 0 ]; then
    echo "[ensure-context] $1"
  fi
}
log_warn() { echo "[ensure-context] WARN: $1" >&2; }
log_error() { echo "[ensure-context] ERROR: $1" >&2; }

# ---------- helpers ----------

# Detect active provider: claude (default) or codex.
detect_provider() {
  if [ -d "$PROJECT_PATH/.codex" ] && [ ! -d "$PROJECT_PATH/.claude" ]; then
    echo "codex"
  else
    echo "claude"
  fi
}

# Compute sha256 of a file.
file_sha256() {
  local f="$1"
  if [ ! -f "$f" ]; then
    echo ""
    return
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$f" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$f" | awk '{print $1}'
  else
    echo ""
  fi
}

git_head() {
  (cd "$PROJECT_PATH" && git rev-parse HEAD 2>/dev/null) || echo ""
}

# ---------- mcp config writers (provider-aware, idempotent) ----------

write_claude_mcp_config() {
  local target="$PROJECT_PATH/.mcp.json"
  local launcher="$SCRIPT_DIR/code-review-graph-mcp.sh"

  if command -v node >/dev/null 2>&1; then
    local expected
    expected="$(node -e '
      const fs = require("fs");
      const path = process.argv[1];
      const launcher = process.argv[2];
      const project = process.argv[3];
      let cfg = {};
      try { cfg = JSON.parse(fs.readFileSync(path, "utf-8")); } catch {}
      if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) cfg = {};
      cfg.mcpServers = cfg.mcpServers || {};
      cfg.mcpServers.code_graph = {
        command: "bash",
        args: [launcher, "serve", "--repo", project],
      };
      process.stdout.write(JSON.stringify(cfg, null, 2) + "\n");
    ' "$target" "$launcher" "$PROJECT_PATH")" || {
      log_warn "node failed while emitting .mcp.json — falling back to bash heredoc"
      expected=""
    }
    if [ -n "$expected" ]; then
      if [ -f "$target" ] && [ "$(cat "$target")" = "$expected" ]; then
        return 0
      fi
      printf '%s' "$expected" > "$target"
      return 0
    fi
  fi

  if [ ! -f "$target" ]; then
    cat > "$target" << EOF
{
  "mcpServers": {
    "code_graph": {
      "command": "bash",
      "args": [
        "$launcher",
        "serve",
        "--repo",
        "$PROJECT_PATH"
      ]
    }
  }
}
EOF
  fi
}

write_codex_mcp_config() {
  local target="$PROJECT_PATH/.codex/config.toml"
  local launcher="$SCRIPT_DIR/code-review-graph-mcp.sh"
  mkdir -p "$PROJECT_PATH/.codex"

  if command -v python3 >/dev/null 2>&1; then
    if python3 - "$target" "$launcher" "$PROJECT_PATH" <<'PY'
import sys, re, os

target, launcher, project = sys.argv[1:4]
existing = ""
if os.path.exists(target):
    with open(target, "r", encoding="utf-8") as f:
        existing = f.read()

block = (
    "[mcp_servers.code_graph]\n"
    "command = \"bash\"\n"
    "args = [\n"
    f"    \"{launcher}\",\n"
    "    \"serve\",\n"
    "    \"--repo\",\n"
    f"    \"{project}\",\n"
    "]\n"
)

pattern = re.compile(r'^\[mcp_servers\.code_graph\].*?(?=^\[|\Z)', re.MULTILINE | re.DOTALL)
without = pattern.sub('', existing).rstrip()
new_content = (without + "\n\n" + block) if without else block

if new_content != existing:
    with open(target, "w", encoding="utf-8") as f:
        f.write(new_content)
PY
    then
      return 0
    fi
    log_warn "python3 codex-toml writer failed — falling back to bash heredoc"
  fi

  _write_codex_bash_fallback "$target" "$launcher" "$PROJECT_PATH"
}

_write_codex_bash_fallback() {
  local target="$1" launcher="$2" project="$3"
  local expected
  expected=$(cat << EOF
[mcp_servers.code_graph]
command = "bash"
args = [
    "$launcher",
    "serve",
    "--repo",
    "$project",
]
EOF
)
  if [ -f "$target" ] && [ "$(cat "$target")" = "$expected" ]; then
    return 0
  fi
  printf '%s\n' "$expected" > "$target"
}

# ---------- main flow ----------

PROVIDER="$(detect_provider)"
log_info "provider: $PROVIDER"
log_info "project:  $PROJECT_PATH"

# 1+2. Auto-install + state-first graph build.
if [ "$FORCE_GRAPH" -eq 1 ]; then
  export FORCE_REBUILD=1
fi
log_info "ensuring code graph is fresh..."
bash "$SCRIPT_DIR/setup-code-graph.sh" || {
  log_error "code graph build failed; see output above"
  mkdir -p "$ARTIFACTS_DIR"
  cat > "$ARTIFACTS_DIR/.preflight-failed" << EOF
{
  "reason": "graph_build_failed",
  "git_head": "$(git_head)",
  "ran_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
  exit 3
}

# 3. .gitignore allowlist is ensured by setup-code-graph.sh; nothing to do here.

# 4. Local MCP config — re-emitted with the machine's absolute paths.
log_info "syncing MCP config (.mcp.json or .codex/config.toml)..."
case "$PROVIDER" in
  codex) write_codex_mcp_config ;;
  claude|*) write_claude_mcp_config ;;
esac

# 5. Success marker. Wiki staleness is owned by /wiki-refresh now and not
# reflected in this marker — the skill checks `.state.json` directly.
HEAD_COMMIT="$(git_head)"
GRAPH_DB="$PROJECT_PATH/.code-review-graph/graph.db"
GRAPH_SHA="$(file_sha256 "$GRAPH_DB")"

# Deterministic workspace topology — the single source of truth for the
# /implement-ticket phases that branch / commit / push per git repo (Phase 4,
# 8.4, 9). `register-submodules.sh` only DEFINES functions when sourced (its
# CLI dispatch is guarded by `BASH_SOURCE == $0`), so this has no side effects.
#
# Detect a colocated framework checkout solely so is_multi_repo can exclude it
# from nested-child-repo discovery. Empty when absent — _qaf_discover_children
# treats an empty exclusion as "nothing to exclude", which is correct. Mirrors
# detect_local_framework_dir in setup-code-graph.sh (keep them identical). We do
# NOT call framework_path() here: the shipped resolve-paths.sh shim defines only
# project_path(), so framework_path() is undefined in `.claude/scripts/` installs.
detect_local_framework_dir() {
  local candidate="$PROJECT_PATH/qubika-agentic-framework"
  if [ -d "$candidate/scripts" ] && [ -f "$candidate/orchestration/package.json" ]; then
    ( cd "$candidate" && pwd )
    return 0
  fi
  echo ""
}
FRAMEWORK_PATH="$(detect_local_framework_dir)"
# shellcheck source=lib/register-submodules.sh
source "$SCRIPT_DIR/lib/register-submodules.sh"

# Build a JSON string array from newline-separated paths without depending on
# jq (this preflight must stay self-sufficient). Escapes \ and " per path.
json_string_array() {
  local first=1 line out="["
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    line="${line//\\/\\\\}"; line="${line//\"/\\\"}"
    if [ "$first" -eq 1 ]; then first=0; else out+=","; fi
    out+="\"$line\""
  done
  out+="]"
  printf '%s' "$out"
}

if is_multi_repo "$PROJECT_PATH" "$FRAMEWORK_PATH"; then
  WORKSPACE_MODE="multi"
  REPO_LIST="$(_qaf_discover_children "$PROJECT_PATH" "$FRAMEWORK_PATH")"
else
  WORKSPACE_MODE="single"
  # Prefer the repo toplevel; fall back to PROJECT_PATH so a rev-parse hiccup
  # can never abort an otherwise-good preflight (set -e is on).
  REPO_LIST="$( (cd "$PROJECT_PATH" && git rev-parse --show-toplevel 2>/dev/null) || printf '%s' "$PROJECT_PATH")"
fi
CHILD_REPOS_JSON="$(printf '%s\n' "$REPO_LIST" | json_string_array)"

# Defense-in-depth: ignore the provider temp dirs locally in every reachable repo
# (workspace root + every child repo) via .git/info/exclude — the UNTRACKED local
# ignore file. We deliberately avoid the tracked .gitignore: writing there would
# dirty the working tree and trip the clean-tree assertion. Even if some phase ever
# wrote .claude-temp into a child repo by mistake, it can never be staged or committed
# into that repo's PR. Both provider variants are listed so a provider switch needs
# no re-run. Idempotent: exact-line match before append.
ensure_temp_excluded() {
  local repo="$1" excl entry
  git -C "$repo" rev-parse --git-dir >/dev/null 2>&1 || return 0
  excl="$(git -C "$repo" rev-parse --git-path info/exclude 2>/dev/null)" || return 0
  [ -n "$excl" ] || return 0
  case "$excl" in /*) : ;; *) excl="$repo/$excl" ;; esac
  mkdir -p "$(dirname "$excl")" 2>/dev/null || return 0
  for entry in ".claude-temp/" ".codex-temp/"; do
    if [ ! -f "$excl" ] || ! grep -qxF "$entry" "$excl" 2>/dev/null; then
      printf '%s\n' "$entry" >> "$excl"
    fi
  done
}
ensure_temp_excluded "$PROJECT_PATH"
while IFS= read -r __repo; do
  [ -n "$__repo" ] || continue
  ensure_temp_excluded "$__repo"
done <<EOF
$REPO_LIST
EOF

mkdir -p "$ARTIFACTS_DIR"
cat > "$ARTIFACTS_DIR/.preflight-ok" << EOF
{
  "git_head": "$HEAD_COMMIT",
  "graph_sha": "$GRAPH_SHA",
  "provider": "$PROVIDER",
  "workspace_root": "$PROJECT_PATH",
  "artifacts_dir": "$ARTIFACTS_DIR",
  "workspace_mode": "$WORKSPACE_MODE",
  "child_repos": $CHILD_REPOS_JSON,
  "preflight_ran_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "preflight_version": 4
}
EOF

log_info "preflight: ok (marker at $ARTIFACTS_DIR/.preflight-ok)"

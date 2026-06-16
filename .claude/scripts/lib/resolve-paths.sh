#!/usr/bin/env bash
# Shim-only path resolver shipped under `<project>/.claude/scripts/lib/`
# (and the `.codex/scripts/lib/` equivalent). The preflight-scripts service
# copies this file out to engineer machines so `ensure-context.sh` and
# `setup-code-graph.sh` can locate the project root without depending on a
# `qubika-agentic-framework/` checkout being present in the user's project.
#
# This file intentionally exports ONLY `project_path()`. The full
# `framework_path()` lookup lives in the framework-internal companion
# (`scripts/lib/resolve-paths.sh`) for callers like `initialize-project` and
# `wiki-refresh` that actually need to locate the framework checkout.
#
# Usage (in another script):
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/resolve-paths.sh"
#   PROJECT_PATH="$(project_path)"
#
# Variables produced by this helper are LOCALLY SCOPED — never `export` them.
# The single allowed env injection is a child-process VAR=value invocation,
# not a global export.

__resolve_paths_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Walk up from the shipped `lib/` directory until a parent named `.claude` or
# `.codex` is found; echo that parent's parent (the project root). Falls back
# to three levels above `lib/` so a relocation does not hard-fail.
project_path() {
  if [ -n "${PROJECT_PATH:-}" ] && [ -d "$PROJECT_PATH" ]; then
    ( cd "$PROJECT_PATH" && pwd )
    return
  fi

  local dir="$__resolve_paths_lib_dir"
  while [ "$dir" != "/" ] && [ -n "$dir" ]; do
    local base
    base="$(basename "$dir")"
    if [ "$base" = ".claude" ] || [ "$base" = ".codex" ]; then
      ( cd "$dir/.." && pwd )
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  ( cd "$__resolve_paths_lib_dir/../../.." && pwd )
}

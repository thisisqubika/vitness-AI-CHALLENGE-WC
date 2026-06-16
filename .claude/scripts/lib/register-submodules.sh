#!/bin/bash
# Transient submodule registration for code-review-graph indexing.
#
# Why: when the project root is itself a git repo and contains nested git
# repos (each with their own `.git/`), `git ls-files` from the parent treats
# the children as opaque gitlinks and returns nothing inside them. The
# `code-review-graph` indexer relies on `git ls-files`, so children get
# skipped. Registering each child as a submodule (with a 160000 gitlink in
# the index + an entry in `.git/config`) lets `git ls-files
# --recurse-submodules` descend, and the indexer sees their files.
#
# This helper is transient: it is meant to be called immediately before a
# graph build/update and torn down right after via an EXIT trap so the
# user's working tree returns to its prior state.
#
# Sourceable AND executable. When sourced, it defines functions for callers
# (e.g. setup-code-graph.sh). When executed directly it dispatches on a
# subcommand (`register` / `unregister`) so non-bash callers (e.g. the
# TypeScript Tier 2 fast path) can drive it via a single bash subprocess.
#
# Stack-agnostic — operates purely on git plumbing; no language or
# project-layout assumptions.

# Echoes 0 (success) when <path> is the working tree of a git repo.
_qaf_is_git_repo() {
  git -C "$1" rev-parse --git-dir >/dev/null 2>&1
}

# Echoes one absolute path per line of top-level dirs under <parent> that
# are themselves git repos, excluding the framework dir. Top-level only —
# we do not recurse deeper, since deeper nesting would cross repository
# boundaries beyond what `git ls-files --recurse-submodules` can usefully
# index in a single graph build.
_qaf_discover_children() {
  local parent="$1"
  local framework="$2"
  local framework_real
  framework_real="$(cd "$framework" 2>/dev/null && pwd -P)" || framework_real="$framework"

  local entry rel real
  for entry in "$parent"/*/; do
    [ -d "$entry" ] || continue
    # `.git` may be a directory (normal repo) or a file (gitfile/worktree).
    if [ ! -e "$entry/.git" ]; then
      continue
    fi
    real="$(cd "$entry" 2>/dev/null && pwd -P)" || real=""
    [ -n "$real" ] || continue
    [ "$real" = "$framework_real" ] && continue
    # Skip empty repos (no HEAD yet) — `git update-index --cacheinfo`
    # needs a SHA we can resolve.
    if ! git -C "$entry" rev-parse HEAD >/dev/null 2>&1; then
      continue
    fi
    # Echo the trimmed absolute path (no trailing slash).
    echo "${entry%/}"
  done
}

# Returns 0 only when <parent>/.gitmodules does NOT already exist. When the
# user already manages submodules themselves, we silently no-op to avoid
# clobbering their config.
_qaf_safe_to_manage() {
  [ ! -e "$1/.gitmodules" ]
}

# Returns 0 (true) when <parent> is a multi-repo layout that this helper
# would actually act on: a git repo, no pre-existing `.gitmodules`, and at
# least one nested top-level child git repo (excluding the framework dir).
# Mirrors the conditions inside `register_child_repos_for_indexing` so
# detection and registration agree by construction.
#
# Used by both setup-code-graph.sh's bash decide_graph_tier and the TS
# decideGraphTier in code-graph.service.ts (via the `is-multi-repo`
# sub-CLI) to short-circuit to tier3. In multi-repo mode the parent's
# `git rev-parse HEAD` doesn't move when children advance, so the
# usual staleness signals (sqlite `git_head_sha` and `.state.json`'s
# `last_indexed_commit`) report a false-fresh tier1 forever — and
# `code-review-graph update` with `git diff HEAD~1` can't see child
# diffs either, so tier2 is unsafe too. Forcing tier3 every run is
# the simplest correct fix.
is_multi_repo() {
  local parent="$1" framework="$2"
  _qaf_is_git_repo "$parent" || return 1
  _qaf_safe_to_manage "$parent" || return 1
  local children
  children="$(_qaf_discover_children "$parent" "$framework")"
  [ -n "$children" ]
}

# Returns the path of <child> relative to <parent>, with no leading or
# trailing slashes.
_qaf_relpath() {
  local parent="$1" child="$2"
  local rel="${child#"$parent"/}"
  echo "${rel%/}"
}

# Returns 0 (skip) if <parent> already has an index entry at <rel>. We only
# add a gitlink for paths that are entirely untracked, so cleanup never
# removes a user's pre-existing tracked content.
_qaf_path_already_tracked() {
  local parent="$1" rel="$2"
  git -C "$parent" ls-files --error-unmatch -- "$rel" >/dev/null 2>&1
}

# Idempotent: registers every nested child repo as a submodule of <parent>.
# Silent no-op when <parent> is not a git repo, when `.gitmodules` already
# exists, or when no children are found. Best-effort per child — a single
# failure does not abort the whole batch.
register_child_repos_for_indexing() {
  local parent="$1"
  local framework="$2"

  _qaf_is_git_repo "$parent" || return 0
  _qaf_safe_to_manage "$parent" || return 0

  local children
  children="$(_qaf_discover_children "$parent" "$framework")"
  [ -n "$children" ] || return 0

  local child rel sha
  while IFS= read -r child; do
    [ -n "$child" ] || continue
    rel="$(_qaf_relpath "$parent" "$child")"
    [ -n "$rel" ] || continue

    # Don't clobber paths the user already tracks at the same location.
    if _qaf_path_already_tracked "$parent" "$rel"; then
      continue
    fi

    sha="$(git -C "$child" rev-parse HEAD 2>/dev/null)" || continue

    # `.gitmodules` declares the submodule (path + url). The url is a local
    # relative path — `code-review-graph` only walks files, so any URL git
    # accepts is fine, and `./<rel>` avoids depending on the child having
    # an `origin` remote.
    git -C "$parent" config -f .gitmodules "submodule.${rel}.path" "$rel" 2>/dev/null || continue
    git -C "$parent" config -f .gitmodules "submodule.${rel}.url"  "./$rel" 2>/dev/null || continue
    # Initialize in `.git/config` so the submodule is "active" — required
    # for `git ls-files --recurse-submodules` to descend into it.
    git -C "$parent" config "submodule.${rel}.url" "./$rel" 2>/dev/null || continue
    # Stage the gitlink (mode 160000) in the index. Git accepts any SHA
    # value here; the child's actual `.git/` is what `--recurse-submodules`
    # walks.
    git -C "$parent" update-index --add --cacheinfo "160000,${sha},${rel}" 2>/dev/null || continue
  done <<< "$children"
}

# Reverses `register_child_repos_for_indexing`. Each git command is guarded
# with `|| true` so a partial state from a half-finished registration never
# blocks cleanup.
unregister_child_repos() {
  local parent="$1"
  local framework="$2"

  _qaf_is_git_repo "$parent" || return 0
  [ -f "$parent/.gitmodules" ] || return 0

  local children child rel
  children="$(_qaf_discover_children "$parent" "$framework")"
  if [ -n "$children" ]; then
    while IFS= read -r child; do
      [ -n "$child" ] || continue
      rel="$(_qaf_relpath "$parent" "$child")"
      [ -n "$rel" ] || continue
      git -C "$parent" rm --cached --quiet -f "$rel" >/dev/null 2>&1 || true
      git -C "$parent" config --remove-section "submodule.${rel}" >/dev/null 2>&1 || true
    done <<< "$children"
  fi

  rm -f "$parent/.gitmodules"
}

# When executed (not sourced), dispatch on the first arg.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  case "${1:-}" in
    register)
      register_child_repos_for_indexing "${2:?usage: $0 register <parent> <framework>}" "${3:?usage: $0 register <parent> <framework>}"
      ;;
    unregister)
      unregister_child_repos "${2:?usage: $0 unregister <parent> <framework>}" "${3:?usage: $0 unregister <parent> <framework>}"
      ;;
    is-multi-repo)
      # Boolean probe: silent stdout/stderr; exit code is the answer.
      # 0 = multi-repo, 1 = single-repo (or unsupported layout).
      if is_multi_repo "${2:?usage: $0 is-multi-repo <parent> <framework>}" "${3:?usage: $0 is-multi-repo <parent> <framework>}"; then
        exit 0
      else
        exit 1
      fi
      ;;
    *)
      echo "Usage: $0 {register|unregister|is-multi-repo} <parent> <framework>" >&2
      exit 2
      ;;
  esac
fi

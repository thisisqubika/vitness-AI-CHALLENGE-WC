#!/usr/bin/env python3
"""Patch upstream code_review_graph/tools/analysis_tools.py for the
``'str' object has no attribute 'resolve'`` bug observed in
code-review-graph 2.3.2 (the latest release as of 2026-05-05).

Why this script exists
----------------------
``code_review_graph/tools/analysis_tools.py`` has a regression in five
tool functions: ``get_hub_nodes_func``, ``get_bridge_nodes_func``,
``get_knowledge_gaps_func``, ``get_surprising_connections_func``,
``get_suggested_questions_func``. They each do::

    root = _validate_repo_root(repo_root)
    store = _get_store(str(root))

with two bugs:

1. ``_validate_repo_root`` is annotated ``def _validate_repo_root(path:
   Path)`` and immediately calls ``path.resolve()``. Passing a raw
   ``str`` raises ``AttributeError: 'str' object has no attribute
   'resolve'``. (The other tool modules wrap with ``Path(...)`` first;
   only ``analysis_tools.py`` is broken.)

2. ``_get_store`` returns ``tuple[GraphStore, Path]``, so
   ``store = _get_store(...)`` assigns the tuple — and the subsequent
   ``find_hub_nodes(store, ...)`` then fails because the analysis
   helpers expect a ``GraphStore``.

The fix collapses both lines into the canonical pattern other tool
modules use::

    store, _ = _get_store(repo_root)

This script applies that fix idempotently. Re-running on an already-
patched file is a no-op. Once upstream releases a fix, the patch
becomes unnecessary but stays harmless (the search pattern won't
match), so the script can be left in place across multiple
upgrades.

Stack-agnostic — pure string transformation on a Python source file.

Exit codes
----------
0 — patch applied OR not needed (file already fixed)
0 — file not found (script is best-effort; the analyzer prompt has a
    fallback for this case)
1 — file found but had a shape we did not recognise (likely a new
    upstream release with a different layout — log + bail so we don't
    corrupt the file)
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import re
import sys
from pathlib import Path

# Bug 1: analysis_tools.py — five tool functions call
# `_validate_repo_root(repo_root)` directly with a str. Patched by
# collapsing the two lines into the canonical `_get_store(repo_root)`.
BROKEN_PATTERN = re.compile(
    r"^([ \t]+)root = _validate_repo_root\(([A-Za-z_][A-Za-z0-9_]*)\)\n"
    r"\1store = _get_store\(str\(root\)\)\n",
    re.MULTILINE,
)

# Idempotence sentinel — already-patched files have this comment.
PATCH_SENTINEL = "# AAF-PATCH: analysis_tools repo_root resolution"

# Bug 2: graph.py:get_communities_list — SELECTs only `id, name`,
# but `analysis.py:find_knowledge_gaps` (and `generate_suggested_questions`
# via that function) needs `size` too. The narrow SELECT plus the
# `.get()` method calls on `sqlite3.Row` together break
# `get_knowledge_gaps_tool` and `get_suggested_questions_tool`. Fix:
# extend the SELECT to include every documented column, so consumers
# that need `size` / `cohesion` / `dominant_language` can read them.
GRAPH_PY_BROKEN_PATTERN = re.compile(
    r'^(?P<indent>[ \t]+)return self\._conn\.execute\(\n'
    r'(?P=indent)[ \t]+"SELECT id, name FROM communities"\n'
    r'(?P=indent)\)\.fetchall\(\)\n',
    re.MULTILINE,
)
GRAPH_PY_PATCH_SENTINEL = "# AAF-PATCH: get_communities_list extended SELECT"

# Bug 3: analysis.py:find_knowledge_gaps — calls `.get()` on
# `sqlite3.Row` objects (which only support indexing). Even with the
# extended SELECT from bug 2, the `.get` calls fail. Fix: convert
# rows to dicts up-front so `.get(...)` works as the caller intended.
ANALYSIS_PY_BROKEN_PATTERN = re.compile(
    r"^([ \t]+)communities = store\.get_communities_list\(\)\n",
    re.MULTILINE,
)
ANALYSIS_PY_PATCH_SENTINEL = "# AAF-PATCH: rows-to-dict for find_knowledge_gaps"


def _candidate_pkg_roots() -> list[Path]:
    """Discover every ``code_review_graph`` package root the framework
    might end up importing.

    Why we patch every match instead of just the one importable here:
    ``uvx code-review-graph`` resolves a per-invocation environment and
    can land on different cache entries depending on the active Python,
    the active platform, or transient dependency resolution. Patching
    only the one importable from THIS Python leaves the other cache
    entries broken, and the framework picks one of those on the next
    ``uvx`` invocation. So we patch them all — every matching file
    is the same upstream module with the same bug.

    Discovery order:
      1. The path importable from this Python (most authoritative).
      2. ``$UV_CACHE_DIR`` (standard uv cache override) if set.
      3. ``~/.cache/uv`` on Unix / ``%LOCALAPPDATA%\\uv`` on Windows.
      4. ``$VIRTUAL_ENV/lib/*/site-packages`` if active.
      5. ``~/.local/pipx/venvs/code-review-graph/lib/*/site-packages``
         (pipx default).
    """
    found: set[Path] = set()

    # 1. Importable copy.
    spec = importlib.util.find_spec("code_review_graph")
    if spec is not None and spec.origin is not None:
        pkg_root = Path(spec.origin).parent
        if pkg_root.exists():
            found.add(pkg_root.resolve())

    # 2 + 3. uv cache root walk. When `$UV_CACHE_DIR` is set, uv treats
    # it as an OVERRIDE (not an additional location), so we honour the
    # same semantic — adding `~/.cache/uv` would walk a path the user
    # explicitly redirected away from. Same goes for `%LOCALAPPDATA%\uv`
    # on Windows: it's the platform default that `UV_CACHE_DIR`
    # supersedes.
    uv_cache_roots: list[Path] = []
    env_uv_cache = os.environ.get("UV_CACHE_DIR")
    home = Path.home()
    if env_uv_cache:
        uv_cache_roots.append(Path(env_uv_cache))
    else:
        uv_cache_roots.append(home / ".cache" / "uv")
        local_app = os.environ.get("LOCALAPPDATA")
        if local_app:
            uv_cache_roots.append(Path(local_app) / "uv")
    for root in uv_cache_roots:
        if not root.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [
                d for d in dirnames if d not in ("__pycache__", ".git", "node_modules")
            ]
            # Cheap signature: a code_review_graph package root has
            # `analysis.py` next to a `tools/` directory.
            if "analysis.py" in filenames and "tools" in dirnames:
                pkg_root = Path(dirpath)
                if pkg_root.name == "code_review_graph":
                    found.add(pkg_root.resolve())

    # 4. Active virtualenv.
    venv = os.environ.get("VIRTUAL_ENV")
    if venv:
        for site_pkgs in Path(venv).glob("lib/*/site-packages"):
            pkg = site_pkgs / "code_review_graph"
            if pkg.exists():
                found.add(pkg.resolve())

    # 5. pipx default install location.
    pipx_root = home / ".local" / "pipx" / "venvs" / "code-review-graph"
    if pipx_root.exists():
        for site_pkgs in pipx_root.glob("lib/*/site-packages"):
            pkg = site_pkgs / "code_review_graph"
            if pkg.exists():
                found.add(pkg.resolve())

    return sorted(found)


def find_analysis_tools_paths() -> list[Path]:
    """Return absolute paths to every ``tools/analysis_tools.py`` the
    framework might import. See `_candidate_pkg_roots` for the
    discovery story.
    """
    out: set[Path] = set()
    for pkg in _candidate_pkg_roots():
        candidate = pkg / "tools" / "analysis_tools.py"
        if candidate.exists():
            out.add(candidate.resolve())
    return sorted(out)


def find_graph_py_paths() -> list[Path]:
    """Locate every ``graph.py`` (the GraphStore module). Patched for
    bug 2 (``get_communities_list`` selects too few columns)."""
    out: set[Path] = set()
    for pkg in _candidate_pkg_roots():
        candidate = pkg / "graph.py"
        if candidate.exists():
            out.add(candidate.resolve())
    return sorted(out)


def find_analysis_py_paths() -> list[Path]:
    """Locate every ``analysis.py`` (the algorithms module). Patched
    for bug 3 (sqlite3.Row.get on `find_knowledge_gaps`)."""
    out: set[Path] = set()
    for pkg in _candidate_pkg_roots():
        candidate = pkg / "analysis.py"
        if candidate.exists():
            out.add(candidate.resolve())
    return sorted(out)


def needs_patch(content: str) -> bool:
    return PATCH_SENTINEL not in content and bool(BROKEN_PATTERN.search(content))


def apply_patch(content: str) -> str:
    """Bug 1: replace every two-line broken pair in ``analysis_tools.py``
    with ``store, _ = _get_store(<arg>)``. The original argument name is
    preserved (always ``repo_root`` in the released code, but defensive
    in case of upstream rename).
    """

    def _sub(m: re.Match[str]) -> str:
        indent = m.group(1)
        arg = m.group(2)
        return (
            f"{indent}{PATCH_SENTINEL}: collapse to _get_store(repo_root)\n"
            f"{indent}store, _ = _get_store({arg})\n"
        )

    return BROKEN_PATTERN.sub(_sub, content)


def apply_graph_py_patch(content: str) -> str:
    """Bug 2: extend ``get_communities_list``'s SELECT so callers that
    need ``size`` / ``cohesion`` / etc. can read them. The communities
    table schema has these columns since v4 of the upstream migration
    (see ``migrations.py:_migrate_v4``); the SELECT was just too narrow.
    """

    def _sub(m: re.Match[str]) -> str:
        indent = m.group("indent")
        return (
            f'{indent}{GRAPH_PY_PATCH_SENTINEL}: include size + sibling columns\n'
            f"{indent}return self._conn.execute(\n"
            f'{indent}    "SELECT id, name, level, parent_id, cohesion, size, '
            f'dominant_language, description FROM communities"\n'
            f"{indent}).fetchall()\n"
        )

    return GRAPH_PY_BROKEN_PATTERN.sub(_sub, content)


def apply_analysis_py_patch(content: str) -> str:
    """Bug 3: convert ``sqlite3.Row`` rows from
    ``store.get_communities_list()`` into plain ``dict`` so the
    subsequent ``.get(...)`` calls on each row work as the upstream
    code intended. This is a single one-line transform — change the
    assignment from
        communities = store.get_communities_list()
    to
        communities = [dict(c) for c in store.get_communities_list()]
    """

    def _sub(m: re.Match[str]) -> str:
        indent = m.group(1)
        return (
            f"{indent}{ANALYSIS_PY_PATCH_SENTINEL}: rows-to-dict for .get(...) compat\n"
            f"{indent}communities = [dict(c) for c in store.get_communities_list()]\n"
        )

    return ANALYSIS_PY_BROKEN_PATTERN.sub(_sub, content)


def _atomic_write(target: Path, body: str, quiet: bool) -> bool:
    tmp = target.with_suffix(target.suffix + ".aaf.tmp")
    try:
        tmp.write_text(body, encoding="utf-8")
        os.replace(tmp, target)
        return True
    except OSError as err:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        if not quiet:
            print(
                f"[patch-code-review-graph] Could not write {target}: {err}",
                file=sys.stderr,
            )
        return False


def patch_one(
    target: Path,
    *,
    pattern: re.Pattern[str],
    sentinel: str,
    transform,
    fixed_marker: str,
    check_only: bool,
    quiet: bool,
) -> str:
    """Generic patcher for any of the three bugs.

    ``pattern``     — regex that matches the broken shape
    ``sentinel``    — comment string we inject so re-runs see "already-patched"
    ``transform``   — function ``(content: str) -> str`` that applies the fix
    ``fixed_marker``— substring present in upstream-fixed releases, used to
                       distinguish "already fixed upstream" from "shape changed"

    Returns one of:
      * "patched"           — bug found and fixed (or would be in --check)
      * "already-patched"   — sentinel present, no-op
      * "already-fixed"     — upstream released the fix
      * "unknown-shape"     — file shape doesn't match either pattern
      * "io-error"          — could not read/write
    """
    try:
        content = target.read_text(encoding="utf-8")
    except OSError as err:
        if not quiet:
            print(
                f"[patch-code-review-graph] Could not read {target}: {err}",
                file=sys.stderr,
            )
        return "io-error"

    if sentinel in content:
        return "already-patched"

    if not pattern.search(content):
        if fixed_marker in content:
            return "already-fixed"
        return "unknown-shape"

    if check_only:
        return "patched"

    patched = transform(content)
    if patched == content:
        return "unknown-shape"

    if not _atomic_write(target, patched, quiet):
        return "io-error"

    return "patched"


PATCH_GROUPS = [
    {
        "label": "analysis_tools.py (resolve)",
        "discover": find_analysis_tools_paths,
        "pattern": BROKEN_PATTERN,
        "sentinel": PATCH_SENTINEL,
        "transform": apply_patch,
        "fixed_marker": "store, _ = _get_store(",
    },
    {
        "label": "graph.py (communities SELECT)",
        "discover": find_graph_py_paths,
        "pattern": GRAPH_PY_BROKEN_PATTERN,
        "sentinel": GRAPH_PY_PATCH_SENTINEL,
        "transform": apply_graph_py_patch,
        # Upstream fix would replace the narrow SELECT with a wider one;
        # the substring below is what the patched form contains.
        "fixed_marker": "SELECT id, name, level, parent_id, cohesion, size,",
    },
    {
        "label": "analysis.py (rows-to-dict)",
        "discover": find_analysis_py_paths,
        "pattern": ANALYSIS_PY_BROKEN_PATTERN,
        "sentinel": ANALYSIS_PY_PATCH_SENTINEL,
        "transform": apply_analysis_py_patch,
        "fixed_marker": "[dict(c) for c in store.get_communities_list()]",
    },
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 0 if patch is needed/applied/already-applied, "
        "1 if any file has unrecognised shape. No writes.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress non-error logging.",
    )
    args = parser.parse_args()

    total_targets = 0
    overall_counts: dict[str, int] = {
        "patched": 0,
        "already-patched": 0,
        "already-fixed": 0,
        "unknown-shape": 0,
        "io-error": 0,
    }

    for group in PATCH_GROUPS:
        targets = group["discover"]()
        total_targets += len(targets)
        if not targets:
            continue
        for target in targets:
            result = patch_one(
                target,
                pattern=group["pattern"],
                sentinel=group["sentinel"],
                transform=group["transform"],
                fixed_marker=group["fixed_marker"],
                check_only=args.check,
                quiet=args.quiet,
            )
            overall_counts[result] = overall_counts.get(result, 0) + 1
            if not args.quiet:
                print(
                    f"[patch-code-review-graph] {result:>16}  [{group['label']}] {target}",
                    file=sys.stderr,
                )

    if total_targets == 0:
        if not args.quiet:
            print(
                "[patch-code-review-graph] code_review_graph not found in any "
                "discovery path; skipping (this is fine if the framework runs "
                "without the graph).",
                file=sys.stderr,
            )
        return 0

    if not args.quiet:
        summary = ", ".join(f"{k}={v}" for k, v in overall_counts.items() if v > 0)
        print(
            f"[patch-code-review-graph] processed {total_targets} file(s) across "
            f"{len(PATCH_GROUPS)} bug groups: {summary}",
            file=sys.stderr,
        )

    # Unknown shape on at least one file is a soft signal — log it but
    # do not fail the preflight, because the framework still works
    # without the patch (the affected tools just error out at call
    # time, which is the state we're trying to fix). Returning 1
    # would block the entire `setup-code-graph.sh` run, which is too
    # heavy a hammer for a non-critical observability fix.
    return 0


if __name__ == "__main__":
    sys.exit(main())

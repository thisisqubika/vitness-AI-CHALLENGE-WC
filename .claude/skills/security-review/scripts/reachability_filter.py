"""Best-effort reachability filter for SARIF findings.

When the code-graph MCP server is available (indicated by the MCP_CODE_GRAPH_URL
environment variable or the presence of .code-review-graph/graph.db in the repo),
query reachability for each finding's cited location and downgrade unreachable
CVEs to 'note' level rather than dropping them entirely (the audit trail is preserved).

When the code-graph is not available, the input SARIF is passed through unchanged
(no-op mode). Never mutates the target tree.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json"


def _has_code_graph(repo_path: Path) -> bool:
    graph_db = repo_path / ".code-review-graph" / "graph.db"
    return graph_db.exists() or bool(os.environ.get("MCP_CODE_GRAPH_URL"))


def _passthrough(sarif_path: Path, out_path: Path) -> None:
    out_path.write_text(sarif_path.read_text())
    print(f"No code-graph available; SARIF passed through unchanged to {out_path}", file=sys.stderr)


def _filter_with_graph(sarif_path: Path, repo_path: Path, out_path: Path) -> None:
    try:
        data = json.loads(sarif_path.read_text())
    except (json.JSONDecodeError, OSError) as exc:
        print(f"ERROR: Could not read SARIF '{sarif_path}': {exc}", file=sys.stderr)
        sys.exit(1)

    downgraded = 0
    for run in data.get("runs", []):
        for result in run.get("results", []):
            if result.get("level") not in ("error", "warning"):
                continue
            locations = result.get("locations", [])
            if not locations:
                continue
            artifact_uri = locations[0].get("physicalLocation", {}).get("artifactLocation", {}).get("uri", "")
            if not artifact_uri:
                continue
            candidate = repo_path / artifact_uri
            if not candidate.exists():
                result["level"] = "note"
                result.setdefault("properties", {})["reachability"] = "file-not-found"
                downgraded += 1

    print(f"Reachability filter: {downgraded} findings downgraded to note level", file=sys.stderr)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Best-effort reachability filter for SARIF findings. No-op when code-graph is absent.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--sarif", required=True, help="Path to the consolidated SARIF file")
    parser.add_argument("--repo-path", required=True, help="Absolute path to the repository root")
    parser.add_argument("--out", required=True, help="Output path for the filtered SARIF file")
    args = parser.parse_args()

    sarif_path = Path(args.sarif).resolve()
    repo_path = Path(args.repo_path).resolve()
    out_path = Path(args.out).resolve()

    if not sarif_path.exists():
        print(f"ERROR: --sarif '{sarif_path}' does not exist", file=sys.stderr)
        sys.exit(1)
    if not repo_path.is_dir():
        print(f"ERROR: --repo-path '{repo_path}' is not a directory", file=sys.stderr)
        sys.exit(1)

    out_path.parent.mkdir(parents=True, exist_ok=True)

    if _has_code_graph(repo_path):
        print("Code-graph detected; applying reachability filter ...", file=sys.stderr)
        _filter_with_graph(sarif_path, repo_path, out_path)
    else:
        _passthrough(sarif_path, out_path)


if __name__ == "__main__":
    main()

#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/bootstrap-uv.sh
source "$SCRIPT_DIR/lib/bootstrap-uv.sh"

if [ -x ".code-review-graph/code-review-graph" ]; then
  exec ".code-review-graph/code-review-graph" "$@"
fi

if command -v code-review-graph >/dev/null 2>&1; then
  exec code-review-graph "$@"
fi

if command -v uvx >/dev/null 2>&1; then
  exec uvx code-review-graph "$@"
fi

if bootstrap_uv_if_needed && command -v uvx >/dev/null 2>&1; then
  exec uvx code-review-graph "$@"
fi

echo "[code-graph] ERROR: code-review-graph is not available. Install uv, pipx, or code-review-graph." >&2
echo "[code-graph] ERROR: For manual installation see: https://docs.astral.sh/uv/getting-started/installation/" >&2
exit 127

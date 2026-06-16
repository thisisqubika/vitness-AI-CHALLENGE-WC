#!/bin/bash
# Shared uv bootstrap logic sourced by setup-code-graph.sh and code-review-graph-mcp.sh.
# POSIX-compatible; uses only bash built-ins and standard UNIX utilities.
#
# After sourcing, call bootstrap_uv_if_needed. On success, PATH is updated
# in-process to include ~/.local/bin and ~/.cargo/bin so callers can
# immediately use `uvx` without a new shell.

_BOOTSTRAP_UV_TIMEOUT=60

_bootstrap_uv_log_info() { echo "[code-graph] $1"; }
_bootstrap_uv_log_error() { echo "[code-graph] ERROR: $1" >&2; }

_uv_export_paths() {
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
}

_run_uv_installer() {
  _bootstrap_uv_log_info "bootstrapping uv (single-binary Python tool runner)"
  _uv_export_paths

  local install_output
  local install_status=0
  if command -v timeout >/dev/null 2>&1; then
    if ! install_output="$(timeout "$_BOOTSTRAP_UV_TIMEOUT" curl -LsSf https://astral.sh/uv/install.sh | sh 2>&1)"; then
      install_status=1
    fi
  else
    if ! install_output="$(curl -LsSf --max-time "$_BOOTSTRAP_UV_TIMEOUT" https://astral.sh/uv/install.sh | sh 2>&1)"; then
      install_status=1
    fi
  fi

  if [ "$install_status" -ne 0 ]; then
    _bootstrap_uv_log_error "uv installer failed: ${install_output:-no output}"
    _bootstrap_uv_log_error "could not bootstrap uv; install uv manually from https://docs.astral.sh/uv/getting-started/installation/"
    return 1
  fi

  _uv_export_paths

  if ! command -v uvx >/dev/null 2>&1; then
    _bootstrap_uv_log_error "uv installed but uvx not found after updating PATH"
    _bootstrap_uv_log_error "could not bootstrap uv; install uv manually from https://docs.astral.sh/uv/getting-started/installation/"
    return 1
  fi

  _bootstrap_uv_log_info "uv bootstrapped successfully: $(uvx --version 2>&1 | head -n 1)"
  return 0
}

# Only tools that can actually install or RUN code-review-graph count as
# "suitable" — a bare interpreter does not. A bare python3/python requires a
# `pip install` that fails on PEP 668 externally-managed environments (Homebrew,
# Debian/Ubuntu 3.11+), so counting it here wrongly suppresses the uv bootstrap
# and forces those users down the one install path that cannot work.
_has_any_python_tool() {
  command -v code-review-graph >/dev/null 2>&1 && return 0
  command -v uvx >/dev/null 2>&1 && return 0
  command -v uv >/dev/null 2>&1 && return 0
  command -v pipx >/dev/null 2>&1 && return 0
  return 1
}

_has_curl() {
  command -v curl >/dev/null 2>&1
}

# Idempotent entry point. Installs uv only when no suitable tool is already
# present and curl is available. Callers should check for uvx after this returns.
# Returns 0 if uvx is available after the call, 1 if bootstrap failed.
bootstrap_uv_if_needed() {
  _uv_export_paths

  if command -v uvx >/dev/null 2>&1; then
    return 0
  fi

  if _has_any_python_tool; then
    return 0
  fi

  if ! _has_curl; then
    _bootstrap_uv_log_error "curl is not available; cannot bootstrap uv"
    _bootstrap_uv_log_error "install uv manually from https://docs.astral.sh/uv/getting-started/installation/"
    return 1
  fi

  if ! _run_uv_installer; then
    return 1
  fi

  return 0
}

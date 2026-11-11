#!/bin/bash
set -euo pipefail

# Run in Claude Code cloud sessions, or when forced (the Codex hook in
# .codex/hooks.json sets SESSION_HOOK_FORCE=1).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ "${SESSION_HOOK_FORCE:-}" != "1" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# This repository has no package manifests: the tests and sync script use only
# Node.js 22+ and Python 3 from the standard library, so nothing is installed.
# Verify the toolchain so a missing runtime is reported at session start.
if ! command -v node >/dev/null 2>&1; then
  echo "node is not installed; Node.js 22 or newer is required (node --test, scripts/sync-lsp-plugins.mjs)." >&2
  exit 1
fi
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 22 ]; then
  echo "Node.js 22 or newer is required; found $(node -v)." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is not installed; it is required for tests/hookify_test.py." >&2
  exit 1
fi

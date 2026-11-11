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

# Claude Code cloud sessions only: add the official marketplace and install and
# enable claude-md-management plus every *-lsp plugin from it (user scope).
# This mirrors the cloud environment's setup script, so resumed sessions and
# other environments get the same plugins. The Codex hook skips it.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ "${SESSION_HOOK_FORCE:-}" != "1" ] && command -v claude >/dev/null 2>&1; then
  mp=claude-plugins-official
  # The stamp lives in the plugin directory, so it disappears with the plugins.
  mkdir -p "$HOME/.claude/plugins"
  stamp="$HOME/.claude/plugins/.session-start.sha256"
  if ! sha256sum --check --status "$stamp" 2>/dev/null; then
    # Delete the old stamp first, so a failed run is retried at the next start.
    rm -f "$stamp"
    ok=1
    claude plugin marketplace add anthropics/claude-plugins-official || ok=0
    claude plugin marketplace update "$mp" || ok=0
    # Register the marketplace and enable every plugin in user settings, keeping
    # existing keys. Prints the plugin names: claude-md-management and each
    # *-lsp plugin in the marketplace catalog (falls back to the known set).
    names="$(python3 - "$HOME/.claude/settings.json" "$HOME/.claude/plugins/marketplaces/$mp/.claude-plugin/marketplace.json" "$mp" <<'PY' || true
import json, os, sys
settings_path, catalog_path, mp = sys.argv[1:4]
fallback = "clangd csharp gopls jdtls kotlin lua php pyright ruby rust-analyzer swift typescript".split()
try:
    catalog = [p["name"] for p in json.load(open(catalog_path))["plugins"]]
    lsp = [n for n in catalog if n.endswith("-lsp")]
except Exception:
    lsp = []
names = ["claude-md-management"] + (lsp or [n + "-lsp" for n in fallback])
s = json.load(open(settings_path)) if os.path.exists(settings_path) and os.path.getsize(settings_path) else {}
s.setdefault("extraKnownMarketplaces", {})[mp] = {"source": {"source": "github", "repo": "anthropics/claude-plugins-official"}}
enabled = s.setdefault("enabledPlugins", {})
for n in names:
    enabled[n + "@" + mp] = True
json.dump(s, open(settings_path, "w"), indent=2)
open(settings_path, "a").write("\n")
print(" ".join(names))
PY
)"
    if [ -z "$names" ]; then
      ok=0
    fi
    for name in $names; do
      claude plugin install "$name@$mp" || ok=0
    done
    # Record success only if every step worked. A plugin problem warns but does
    # not stop the session.
    if [ "$ok" = 1 ]; then
      sha256sum .claude/hooks/session-start.sh > "$stamp" || rm -f "$stamp"
    else
      echo "Some Claude plugins could not be added; will retry at the next session start." >&2
    fi
  fi
fi

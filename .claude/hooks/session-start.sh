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

# Claude Code cloud sessions only (the Codex hook skips this). Mirrors the cloud
# environment's setup script, so resumed sessions and other environments match:
# - install claude-md-management and every *-lsp plugin from
#   claude-plugins-official, and project-lsp from this checkout's marketplace;
# - keep claude-md-management and project-lsp enabled at user scope, but set
#   the *-lsp plugins to false there: project-lsp enables the ones each project
#   uses in its .claude/settings.json, which overrides the user setting.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ "${SESSION_HOOK_FORCE:-}" != "1" ] && command -v claude >/dev/null 2>&1; then
  mp=claude-plugins-official
  own=codex-plugin-ports
  # The stamp lives in the plugin directory, so it disappears with the plugins.
  mkdir -p "$HOME/.claude/plugins"
  stamp="$HOME/.claude/plugins/.session-start.sha256"
  if ! sha256sum --check --status "$stamp" 2>/dev/null; then
    # Delete the old stamp first, so a failed run is retried at the next start.
    rm -f "$stamp"
    ok=1
    claude plugin marketplace add anthropics/claude-plugins-official || ok=0
    claude plugin marketplace update "$mp" || ok=0
    claude plugin marketplace add "$PWD" || ok=0
    # LSP plugin names from the marketplace catalog (falls back to the known set).
    lsp="$(python3 -c 'import json,sys; print(" ".join(p["name"] for p in json.load(open(sys.argv[1]))["plugins"] if p["name"].endswith("-lsp")))' "$HOME/.claude/plugins/marketplaces/$mp/.claude-plugin/marketplace.json" 2>/dev/null || true)"
    if [ -z "$lsp" ]; then
      lsp="clangd-lsp csharp-lsp gopls-lsp jdtls-lsp kotlin-lsp lua-lsp php-lsp pyright-lsp ruby-lsp rust-analyzer-lsp swift-lsp typescript-lsp"
    fi
    for name in claude-md-management $lsp; do
      claude plugin install "$name@$mp" || ok=0
    done
    claude plugin install "project-lsp@$own" || ok=0
    # Installing enables at user scope; now set the user-scope state, keeping
    # existing keys.
    python3 - "$HOME/.claude/settings.json" "$mp" "$own" $lsp <<'PY' || ok=0
import json, os, sys
settings_path, mp, own, *lsp = sys.argv[1:]
s = json.load(open(settings_path)) if os.path.exists(settings_path) and os.path.getsize(settings_path) else {}
s.setdefault("extraKnownMarketplaces", {})[mp] = {"source": {"source": "github", "repo": "anthropics/claude-plugins-official"}}
enabled = s.setdefault("enabledPlugins", {})
enabled["claude-md-management@" + mp] = True
enabled["project-lsp@" + own] = True
for name in lsp:
    enabled[name + "@" + mp] = False
json.dump(s, open(settings_path, "w"), indent=2)
open(settings_path, "a").write("\n")
PY
    # Record success only if every step worked. A plugin problem warns but does
    # not stop the session.
    if [ "$ok" = 1 ]; then
      sha256sum .claude/hooks/session-start.sh > "$stamp" || rm -f "$stamp"
    else
      echo "Some Claude plugins could not be added; will retry at the next session start." >&2
    fi
  fi

  # Every start: run `claude plugin enable` for claude-md-management and
  # project-lsp if either is not enabled (for example after `claude plugin
  # disable`). Local settings override project settings, which override user
  # settings, so a `false` is undone at the scope that set it. The committed
  # project settings file is never edited; a disable there only warns. Enabled
  # plugins are skipped, so this costs nothing then. The *-lsp plugins are left
  # to project-lsp.
  todo="$(python3 - "$HOME/.claude/settings.json" .claude/settings.json .claude/settings.local.json "claude-md-management@$mp" "project-lsp@$own" <<'PY' || true
import json, sys
user_path, project_path, local_path, *ids = sys.argv[1:]
def plugins(path):
    try:
        return json.load(open(path)).get("enabledPlugins", {})
    except Exception:
        return {}
user, project, local = plugins(user_path), plugins(project_path), plugins(local_path)
for key in ids:
    if local.get(key) is False:
        print(key + "=local")
    elif project.get(key) is False:
        print(key + "=project")
    elif user.get(key) is not True:
        print(key + "=user")
PY
)"
  for item in $todo; do
    id="${item%%=*}"
    scope="${item##*=}"
    if [ "$scope" = project ]; then
      echo "Claude plugin $id is disabled in .claude/settings.json (committed); not changing it." >&2
      continue
    fi
    claude plugin enable --scope "$scope" "$id" >/dev/null 2>&1 \
      || echo "Could not enable Claude plugin $id ($scope scope)." >&2
  done
fi

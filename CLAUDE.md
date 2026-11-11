# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

One repository serving as two plugin marketplaces built from Anthropic's `anthropics/claude-plugins-official` (source of record: commit `0412be76f50ab4f4f8abff3753efa9269fbbca5b`):

- **Codex marketplace**: `.agents/plugins/marketplace.json` lists the 16 Codex ports in `plugins/`.
- **Claude Code marketplace**: `.claude-plugin/marketplace.json` lists 13 plugins in `claude-plugins/`, which are byte-identical copies of upstream. Their entries are upstream's entries with only `source` changed. Never edit files under `claude-plugins/`; re-copy from upstream instead. `claude-code-setup` and `claude-md-management` are deliberately absent because `claude plugin validate` reserves `claude-` names for Anthropic.

There are no package manifests or dependencies: everything runs on Node.js 22+ and the Python 3 standard library.

## Commands

```bash
node --test                                   # all Node tests (tests/*.test.mjs)
node --test --test-name-pattern="<name>" tests/bridge.test.mjs   # one Node test
python3 tests/hookify_test.py                 # Hookify tests (unittest)
python3 tests/hookify_test.py HookifyTest.<test_method>          # one Hookify test
node scripts/sync-lsp-plugins.mjs             # regenerate the 12 *-lsp Codex packages
node scripts/sync-lsp-plugins.mjs --check     # fail if generated packages drifted
node scripts/build-mcpb.mjs [plugin-name ...] # rebuild dist/mcpb/<name>.mcpb (needs network)
claude plugin validate .                      # validate the Claude Code marketplace
```

There is no linter and no CI; the sync `--check`, the tests and `claude plugin validate .` are the checks.

## Architecture

- **LSP bridge (generated code)**: `src/bridge.mjs` (stdio MCP server exposing `lsp_*` tools) and `src/lsp-client.mjs` (spawns and talks to the native language server) are shared by all LSP ports. `src/lsp-profiles.json` defines each language (plugin name, server command, args, extension map, install text). `scripts/sync-lsp-plugins.mjs` copies the bridge into every `plugins/<name>-lsp/server/` and generates each package's `plugin.json`, `mcp.json`, `README.md` and `LICENSE`. Edit `src/`, never the copies, then run the sync and `--check`.
- **Workspace safety**: the bridge requires `lsp_start` with an absolute workspace path and rejects files that resolve outside it (including through links); `tests/bridge.test.mjs` uses `tests/fixtures/fake-lsp.mjs` as a stand-in server.
- **Two Codex manifest styles**: most ports use a root `plugin.json` (agent-plugins.org schema, Codex UI under `extensions["com.openai"]`), with `mcp.json` for LSP ports. `hookify` instead uses `.codex-plugin/plugin.json` with `hooks/hooks.json` (Codex plugin hooks via `${PLUGIN_ROOT}`), driven by `hooks/run.py`.
- **project-lsp**: a skill (not a server) whose scripts in `plugins/project-lsp/skills/project-lsp/scripts/` detect project languages and enable the matching `*-lsp` ports through the project marketplace; covered by `tests/project-lsp.test.mjs`.
- **MCPB bundles**: `scripts/build-mcpb.mjs` wraps each LSP package's `server/` with a generated `manifest.json` into `dist/mcpb/` (committed on purpose, not gitignored). Rebuild after bridge changes; the sync check does not detect stale bundles.
- **The Codex marketplace file is hand-edited**: adding a plugin means updating `.agents/plugins/marketplace.json` and the README tables yourself.

## Session hooks

- `.claude/hooks/session-start.sh` (registered in `.claude/settings.json`) checks for Node 22+ and Python 3. In Claude Code cloud sessions it also installs and enables `claude-md-management` and every `*-lsp` plugin from `claude-plugins-official` at user scope, skipping via `~/.claude/plugins/.session-start.sha256`, and re-enables any of them disabled at user or local scope on each start.
- `.codex/hooks.json` runs the same script with `SESSION_HOOK_FORCE=1`, which does only the toolchain check. Test plugin behaviour in a throwaway `HOME`, and pass `--scope` to `claude plugin disable`: without it, the CLI can write to the committed `.claude/settings.json`.

## More context

`memory-bank/` holds the project brief, decisions and current status; read `activeContext.md` and `progress.md` before larger changes.

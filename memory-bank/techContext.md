# Tech Context

## Technologies Used
Node.js 22+ (ESM `.mjs`, `node --test`), Python 3 stdlib (hookify hook runner and test), JSON manifests, Markdown skills.

## Development Setup
No dependencies or package manifests. `.claude/hooks/session-start.sh` (registered in `.claude/settings.json`) verifies Node 22+ and Python 3; in Claude cloud sessions it also adds the `claude-plugins-official` marketplace and installs and enables `claude-md-management` plus every `*-lsp` plugin (user scope), skipping via a stamp in `~/.claude/plugins/` once done. `.codex/hooks.json` runs the same script with `SESSION_HOOK_FORCE=1`, which does only the toolchain check. The "plugin ports" cloud environment setup script installs the same plugins on fresh containers.

## Technical Constraints
- Codex ignores project `.codex/hooks.json` until the project is trusted, and the hook itself shows `untrusted` until approved in `/hooks`.
- No CI and no manifest-validation script in the repo.

## Dependencies
Upstream: `anthropics/claude-plugins-official`. Tools: Claude Code CLI (`claude plugin validate .`), Codex CLI (installed globally for testing, v0.167.1).

## Tool Usage Patterns
- `node scripts/build-mcpb.mjs` builds `dist/mcpb/<name>.mcpb` for the 12 LSP packages (CLI pinned `@anthropic-ai/mcpb@2.1.2`). `dist/` is deliberately tracked, not gitignored.
- `node --test` (21 tests), `python3 tests/hookify_test.py`, `node scripts/sync-lsp-plugins.mjs --check`.
- `claude plugin validate .` passes (warns only that copied READMEs lack a marketplace install line; left as-is).
- Codex checks: `codex plugin list --marketplace codex-plugin-ports`; hook discovery via `codex app-server` method `hooks/list`.

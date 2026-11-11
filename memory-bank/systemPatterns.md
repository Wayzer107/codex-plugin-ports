# System Patterns

## Architecture Overview
- `plugins/<name>/` holds 16 Codex plugins. `.agents/plugins/marketplace.json` lists them.
- `claude-plugins/<name>/` holds 13 verbatim upstream plugins. `.claude-plugin/marketplace.json` lists them (entries copied from upstream, only `source` changed).
- `src/` holds the shared LSP bridge (`bridge.mjs`, `lsp-client.mjs`, `lsp-profiles.json`). `scripts/sync-lsp-plugins.mjs` generates the 12 `*-lsp` Codex packages from it (`--check` detects drift).

## Key Technical Decisions
- Two manifest styles in `plugins/`: most use root `plugin.json` (agent-plugins.org schema, `mcp.json`); `hookify` uses `.codex-plugin/plugin.json` with `hooks/hooks.json` (Codex plugin hooks).
- Copies live in `claude-plugins/` because upstream `plugins/hookify` and `*-lsp` names collide with the Codex ports.
- `claude-code-setup` and `claude-md-management` are excluded from the Claude marketplace: `claude plugin validate` reserves names starting `claude-` for Anthropic; renaming would break "unmodified". Their Codex ports are `codex-setup` and `agents-md-management`.
- LSP plugins on the Claude side define servers in the marketplace entry (`lspServers`, `strict: false`), not in their folders.

## Design Patterns in Use
Generated-code sync with a drift check; skills as `skills/<name>/SKILL.md`; Codex hooks via `hooks.json` using `${PLUGIN_ROOT}`.

## Component Relationships
`src/` -> (sync script) -> `plugins/*-lsp`. `project-lsp` skill activates matching LSP plugins through the project marketplace.

## Critical Implementation Paths
Marketplace entry -> plugin manifest -> skill or MCP server / hook.

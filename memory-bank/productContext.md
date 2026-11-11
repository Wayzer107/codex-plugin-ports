# Product Context

## Why This Project Exists
Anthropic publishes useful Claude Code plugins (hookify, language servers, setup and instruction-file tooling). Codex users have no equivalent, and Claude Code users may want the same set from one repository.

## How It Should Work
- Codex: `codex plugin marketplace add Wayzer107/codex-plugin-ports`, then `codex plugin add <name>@codex-plugin-ports`.
- Claude Code: `/plugin marketplace add Wayzer107/codex-plugin-ports`, then `/plugin install <name>@codex-plugin-ports`.
- LSP plugins run a local MCP bridge to the native language server, which must be on PATH (Node.js 22+ required).

## User Experience Goals
Install a single plugin without the rest. Clear per-plugin READMEs that state prerequisites and changes from upstream.

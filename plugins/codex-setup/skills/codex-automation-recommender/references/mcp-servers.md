# MCP servers

| Evidence | Capability to consider |
| --- | --- |
| Several fast-moving framework or SDK dependencies | Documentation lookup, such as Context7 if available |
| UI tests, repeated manual browser checks, or screenshot work | Current browser tools for exploration and the repository's Playwright runner for regression tests. Consider Playwright MCP when the workflow needs a browser capability the host lacks. |
| Issues, pull requests, or CI runs referenced from the repository | Available GitHub or issue-tracker connector with the required read scopes |
| Supabase, Convex, or another data backend with recurring schema or diagnostics work | Vendor-maintained connector for the right project and environment |
| Observability or deployment triage | Official service integration scoped to the needed environments |

Check the current tool list and `codex mcp list` before recommending a second integration. Prefer least-privilege access. Distinguish a configured entry from authenticated tool discovery and from a successful read-only tool call.

User configuration lives in `~/.codex/config.toml` (or the configured Codex home). A trusted repo can share `.codex/config.toml` with non-secret settings. Verify the vendor's exact server name, entry point or HTTPS URL, installation prerequisites, and authentication flow. Use `codex mcp add --help` for the installed CLI syntax and `codex mcp login <name>` only where the server uses OAuth. Document variable names where appropriate and keep values outside tracked files.

[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp)

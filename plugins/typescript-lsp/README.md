# TypeScript LSP

Use typescript-language-server for TypeScript and JavaScript code navigation and diagnostics in Codex. Supported source extensions are `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`.

## Prerequisites

- Node.js 22 or newer on the Codex host's PATH.
- Run `npm install -g typescript@6 typescript-language-server` and make the npm bin directory available on PATH. Select the package or workspace containing its TypeScript or JavaScript configuration. [Language-server documentation](https://github.com/typescript-language-server/typescript-language-server#installing)

## Use in Codex

After adding the marketplace, install this plugin and start a new Codex conversation.

~~~powershell
codex plugin add 'typescript-lsp@codex-plugin-ports'
~~~

Ask Codex to use the typescript language-server tools for your project. Every query tool takes a `file` (an absolute path works best) and starts typescript-language-server for that file's project on first use, then waits for it to initialize. There is no separate start step.

- **Project root**: the outermost directory inside the file's Git repository that contains `tsconfig.json`, `jsconfig.json`, `package.json`; otherwise the repository root. Pass `workspace` to choose the root yourself.
- **Positions**: lines and columns are one-based. Instead of a column you can pass `symbol`, the name to target on that line.
- **Tools**: `lsp_hover`, `lsp_definition`, `lsp_type_definition`, `lsp_implementation`, `lsp_references`, `lsp_document_symbols`, `lsp_workspace_symbols` and `lsp_diagnostics`. Results list relative paths, one-based positions and a preview of the source line. `lsp_status` shows running workspaces and indexing progress.
- **Lifecycle**: up to three workspaces run at once; the least recently used one stops when a fourth starts. `lsp_stop` frees them early, `lsp_start` warms one up ahead of time.

Queries read saved files. The available features and indexing behaviour depend on the native server.

Use trusted projects: a native language server can run build or project tools while indexing. To require an explicit `lsp_start` before any server runs, set `LSP_BRIDGE_AUTO_START=0` in the MCP server's environment.

## Upstream and changes

Adapted from Anthropic's [typescript-lsp](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins/typescript-lsp) under the [Apache License 2.0](LICENSE). This port keeps the upstream file mappings and uses a local MCP bridge to start the language server and query it from Codex.

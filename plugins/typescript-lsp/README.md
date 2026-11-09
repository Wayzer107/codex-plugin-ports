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

Ask Codex to use the typescript language-server tools for your project. Call `lsp_start` with the absolute project root and poll `lsp_status` if initialization is pending. Queries use saved files and zero-based UTF-16 positions. The available features and indexing behavior depend on the native server.

Open trusted workspaces. A native language server can run build or project tools while indexing. Stop the workspace with `lsp_stop` when you finish or before starting another workspace.

## Upstream and changes

Adapted from Anthropic's [typescript-lsp](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins/typescript-lsp) under the [Apache License 2.0](LICENSE). This port keeps the upstream file mappings and uses a local MCP bridge to start the language server and query it from Codex.

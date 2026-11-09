# PHP LSP

Use intelephense for PHP code navigation and diagnostics in Codex. Supported source extensions are `.php`.

## Prerequisites

- Node.js 22 or newer on the Codex host's PATH.
- Run `npm install -g intelephense` and make the npm bin directory available on PATH. [Language-server documentation](https://github.com/bmewburn/intelephense-docs)

## Use in Codex

After adding the marketplace, install this plugin and start a new Codex conversation.

~~~powershell
codex plugin add 'php-lsp@codex-plugin-ports'
~~~

Ask Codex to use the intelephense language-server tools for your project. Call `lsp_start` with the absolute project root and poll `lsp_status` if initialization is pending. Queries use saved files and zero-based UTF-16 positions. The available features and indexing behavior depend on the native server.

Open trusted workspaces. A native language server can run build or project tools while indexing. Stop the workspace with `lsp_stop` when you finish or before starting another workspace.

## Upstream and changes

Adapted from Anthropic's [php-lsp](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins/php-lsp) under the [Apache License 2.0](LICENSE). This port keeps the upstream file mappings and uses a local MCP bridge to start the language server and query it from Codex.

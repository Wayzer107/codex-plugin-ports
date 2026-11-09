# Java LSP

Use jdtls for Java code navigation and diagnostics in Codex. Supported source extensions are `.java`.

## Prerequisites

- Node.js 22 or newer on the Codex host's PATH.
- Install Eclipse JDT LS and the JDK required by that release. Put a working `jdtls` launcher on PATH. On Windows, use a launcher without a terminal pause if your distribution's batch file pauses on exit. Select the Maven or Gradle project root. [Language-server documentation](https://github.com/eclipse-jdtls/eclipse.jdt.ls#running-from-the-command-line)

## Use in Codex

After adding the marketplace, install this plugin and start a new Codex conversation.

~~~powershell
codex plugin add 'jdtls-lsp@codex-plugin-ports'
~~~

Ask Codex to use the jdtls language-server tools for your project. Call `lsp_start` with the absolute project root and poll `lsp_status` if initialization is pending. Queries use saved files and zero-based UTF-16 positions. The available features and indexing behavior depend on the native server.

Open trusted workspaces. A native language server can run build or project tools while indexing. Stop the workspace with `lsp_stop` when you finish or before starting another workspace.

## Upstream and changes

Adapted from Anthropic's [jdtls-lsp](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins/jdtls-lsp) under the [Apache License 2.0](LICENSE). This port keeps the upstream file mappings and uses a local MCP bridge to start the language server and query it from Codex.

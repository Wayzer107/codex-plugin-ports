# Pyright LSP

Use pyright-langserver for Python code navigation and diagnostics in Codex. Supported source extensions are `.py`, `.pyi`.

## Prerequisites

- Node.js 22 or newer on the Codex host's PATH.
- Run `npm install -g pyright` and make `pyright-langserver` available on PATH. Keep project interpreter and type-checker settings in the project's normal configuration. [Language-server documentation](https://github.com/microsoft/pyright/blob/main/docs/installation.md)

## Use in Codex

After adding the marketplace, install this plugin and start a new Codex conversation.

~~~powershell
codex plugin add 'pyright-lsp@codex-plugin-ports'
~~~

Ask Codex to use the pyright language-server tools for your project. Every query tool takes a `file` (an absolute path works best) and starts pyright-langserver for that file's project on first use, then waits for it to initialize. There is no separate start step.

- **Project root**: the outermost directory inside the file's Git repository that contains `pyrightconfig.json`, `pyproject.toml`, `setup.py`, `setup.cfg`, `Pipfile`; otherwise the repository root. Pass `workspace` to choose the root yourself.
- **Positions**: lines and columns are one-based. Instead of a column you can pass `symbol`, the name to target on that line.
- **Tools**: `lsp_hover`, `lsp_definition`, `lsp_type_definition`, `lsp_implementation`, `lsp_references`, `lsp_document_symbols`, `lsp_workspace_symbols` and `lsp_diagnostics`. Results list relative paths, one-based positions and a preview of the source line. `lsp_status` shows running workspaces and indexing progress.
- **Lifecycle**: up to three workspaces run at once; the least recently used one stops when a fourth starts. `lsp_stop` frees them early, `lsp_start` warms one up ahead of time.

Queries read saved files. The available features and indexing behaviour depend on the native server.

Use trusted projects: a native language server can run build or project tools while indexing. To require an explicit `lsp_start` before any server runs, set `LSP_BRIDGE_AUTO_START=0` in the MCP server's environment.

## Upstream and changes

Adapted from Anthropic's [pyright-lsp](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins/pyright-lsp) under the [Apache License 2.0](LICENSE). This port keeps the upstream file mappings and uses a local MCP bridge to start the language server and query it from Codex.

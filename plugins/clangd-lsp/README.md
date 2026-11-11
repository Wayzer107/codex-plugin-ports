# Clangd LSP

Use clangd for C and C++ code navigation and diagnostics in Codex. Supported source extensions are `.c`, `.h`, `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hxx`, `.C`, `.H`.

## Prerequisites

- Node.js 22 or newer on the Codex host's PATH.
- Use the project's compilation database for accurate build flags. [Language-server documentation](https://clangd.llvm.org/installation)

## Automatic clangd installation

If clangd is not available on PATH, the plugin downloads the latest stable x64 release from the official [clangd releases](https://github.com/clangd/clangd/releases) and verifies it against GitHub's published SHA-256 digest. It extracts the binary and builtin headers into the user's cache without changing the system PATH or requiring administrator privileges.

- Windows: %LOCALAPPDATA%\codex-plugin-ports\clangd-lsp
- macOS: ~/Library/Caches/codex-plugin-ports/clangd-lsp
- Linux: XDG_CACHE_HOME, or ~/.cache if it is unset, followed by /codex-plugin-ports/clangd-lsp

Automatic installation runs only when the configured clangd command is missing. It requires an internet connection on first use. Other operating systems and processor architectures still need a manual clangd installation.

## Use in Codex

After adding the marketplace, install this plugin and start a new Codex conversation.

~~~powershell
codex plugin add 'clangd-lsp@codex-plugin-ports'
~~~

Ask Codex to use the clangd language-server tools for your project. Call `lsp_start` with the absolute project root and poll `lsp_status` if initialization is pending. Queries use saved files and zero-based UTF-16 positions. The available features and indexing behavior depend on the native server.

Open trusted workspaces. A native language server can run build or project tools while indexing. Stop the workspace with `lsp_stop` when you finish or before starting another workspace.

## Upstream and changes

Adapted from Anthropic's [clangd-lsp](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins/clangd-lsp) under the [Apache License 2.0](LICENSE). This port keeps the upstream file mappings and uses a local MCP bridge to start the language server and query it from Codex.

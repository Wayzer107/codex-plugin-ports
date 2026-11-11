# Project LSP for Claude Code

Detects a Git project's source languages and enables the matching LSP plugins from Anthropic's `claude-plugins-official` marketplace in the project's `.claude/settings.json`. This is the Claude Code port of the Codex [project-lsp](https://github.com/Wayzer107/codex-plugin-ports/tree/main/plugins/project-lsp) plugin.

## What it does

- **At session start** (plugin hook): scans the project with `git ls-files`, maps file extensions to `*-lsp` plugins, and enables the matches at project scope. It prints a message only when something changed.
- **On request** (skill): run the same checker explicitly, preview with `--check`, or add files Git does not list yet with `--file`.
- **Tracking:** plugins it enabled are recorded in `.claude/project-lsp.json` and removed again when their language disappears. Entries you set by hand are never changed.
- **Extension map:** taken from the installed `claude-plugins-official` catalog (`lspServers.extensionToLanguage`), so new LSP plugins are picked up automatically; a bundled map is the fallback.

## Install

~~~bash
/plugin marketplace add Wayzer107/codex-plugin-ports
/plugin install project-lsp@codex-plugin-ports
~~~

## Prerequisites

- Node.js 22 or newer and Git on PATH.
- The LSP plugins installed from `claude-plugins-official` (for example `/plugin install gopls-lsp@claude-plugins-official`). Enabling at project scope overrides a user-scope `false`, so you can keep them installed but disabled globally.
- Each native language server on PATH (`gopls`, `clangd`, `pyright-langserver`, ...). This plugin installs none of them.

Plugin changes take effect in the next Claude Code session. The checker writes committed project settings, so review the resulting `git diff`.

## Upstream and license

Adapted from this repository's Codex port, which builds on Anthropic's [claude-plugins-official](https://github.com/anthropics/claude-plugins-official) LSP plugins, under the [Apache License 2.0](LICENSE).

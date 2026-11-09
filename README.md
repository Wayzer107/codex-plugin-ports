# Codex Plugin Ports

Codex plugins adapted from Anthropic's Claude plugins. Each plugin is independently installable.

| Plugin | Use it for |
| --- | --- |
| [Codex Setup](plugins/codex-setup/README.md) | Read-only recommendations for hooks, MCP, skills, plugins, subagents, and repeatable workflows |
| [AGENTS.md Management](plugins/agents-md-management/README.md) | Auditing project instructions and capturing durable session learnings |

## Install from GitHub

Run these commands with a Codex CLI that supports plugin marketplaces.

~~~powershell
codex plugin marketplace add 'Wayzer107/codex-plugin-ports'
codex plugin add 'codex-setup@codex-plugin-ports'
codex plugin add 'agents-md-management@codex-plugin-ports'
codex plugin list --marketplace codex-plugin-ports
~~~

For a local checkout, pass the checkout's absolute path to `codex plugin marketplace add` in place of the GitHub repository name.

Start a new Codex conversation, type `$`, and select the installed skill.

## Language server plugins

The LSP plugins run a local MCP bridge to the corresponding native language server. Install Node.js 22 or newer and the server for your language on the machine where Codex runs. Both executables must be on that host's PATH. The table links to each plugin's prerequisites and supported file extensions.

| Plugin | Language | Native server |
| --- | --- | --- |
| [`clangd-lsp`](plugins/clangd-lsp/README.md) | C and C++ | clangd |
| [`csharp-lsp`](plugins/csharp-lsp/README.md) | C# | csharp-ls |
| [`gopls-lsp`](plugins/gopls-lsp/README.md) | Go | gopls |
| [`jdtls-lsp`](plugins/jdtls-lsp/README.md) | Java | Eclipse JDT LS |
| [`kotlin-lsp`](plugins/kotlin-lsp/README.md) | Kotlin | Kotlin LSP |
| [`lua-lsp`](plugins/lua-lsp/README.md) | Lua | Lua Language Server |
| [`php-lsp`](plugins/php-lsp/README.md) | PHP | Intelephense |
| [`pyright-lsp`](plugins/pyright-lsp/README.md) | Python | Pyright |
| [`ruby-lsp`](plugins/ruby-lsp/README.md) | Ruby and ERB | Ruby LSP |
| [`rust-analyzer-lsp`](plugins/rust-analyzer-lsp/README.md) | Rust | rust-analyzer |
| [`swift-lsp`](plugins/swift-lsp/README.md) | Swift | SourceKit-LSP |
| [`typescript-lsp`](plugins/typescript-lsp/README.md) | TypeScript and JavaScript | typescript-language-server |

After adding the marketplace, use `codex plugin marketplace upgrade codex-plugin-ports` to refresh an existing GitHub checkout. Then install the ports you need. For example, this installs the C and C++ port.

~~~powershell
codex plugin add 'clangd-lsp@codex-plugin-ports'
~~~

Start a new Codex conversation in your project and ask it to use the installed language server for a symbol, definition, reference, hover, or diagnostic query. The MCP tools start the native server on demand for a trusted project root. The bridge reads saved source files and refreshes them when they change. Individual capabilities depend on the native server and its indexing state. A native server may invoke project tooling during indexing.

## Maintain the ports

The shared bridge and language profiles live under [`src/`](src). Each package contains a generated copy so it can be installed independently. After changing the bridge or profiles, regenerate the packages and run the checks.

~~~powershell
node scripts/sync-lsp-plugins.mjs
node scripts/sync-lsp-plugins.mjs --check
node --test
~~~

## Source and license

The original plugins are in [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins) at commit `0412be76f50ab4f4f8abff3753efa9269fbbca5b`. Isabella He is credited as the author of both upstream plugins. Each port describes its changes in its README.

The marketplace is distributed under the [Apache License 2.0](LICENSE). Each plugin also includes a copy of the license.

# Codex Plugin Ports

Codex plugins adapted from Anthropic's Claude plugins. Each plugin is independently installable.

| Plugin | Use it for |
| --- | --- |
| [Codex Setup](plugins/codex-setup/README.md) | Read-only recommendations for hooks, MCP, skills, plugins, subagents, and repeatable workflows |
| [AGENTS.md Management](plugins/agents-md-management/README.md) | Auditing project instructions and capturing durable session learnings |
| [Memory Bank](plugins/memory-bank/README.md) | Preserving project context across Codex sessions |
| [Project LSP](plugins/project-lsp/README.md) | Detecting source languages and enabling the matching LSP plugins in a Git project |
| [Hookify](plugins/hookify/README.md) | Writing local Markdown rules for Codex hooks |

## Claude Code marketplace

The same repository is also a Claude Code marketplace. [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) lists 13 plugins in [`claude-plugins/`](claude-plugins), which are unmodified copies of the originals from [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins) at commit `0412be76f50ab4f4f8abff3753efa9269fbbca5b`. Each marketplace entry is also copied from upstream, with only `source` changed to point at `claude-plugins/`. The Codex ports remain in [`plugins/`](plugins).

~~~bash
/plugin marketplace add Wayzer107/codex-plugin-ports
/plugin install hookify@codex-plugin-ports
~~~

Included: `hookify` and the `clangd-lsp`, `csharp-lsp`, `gopls-lsp`, `jdtls-lsp`, `kotlin-lsp`, `lua-lsp`, `php-lsp`, `pyright-lsp`, `ruby-lsp`, `rust-analyzer-lsp`, `swift-lsp` and `typescript-lsp` language server plugins. The language server plugins need the matching native server on your PATH.

Also included: [Project LSP for Claude Code](claude-ports/project-lsp/README.md) (`project-lsp@codex-plugin-ports`), the port of the Codex Project LSP plugin. It detects a Git project's languages and enables only the matching LSP plugins from `claude-plugins-official` in the project's `.claude/settings.json`, automatically at session start or on request.

Not included: `claude-code-setup` and `claude-md-management`. Claude Code reserves names beginning with `claude-` for Anthropic, so a third-party marketplace cannot list them without renaming. Use them from the official marketplace instead.

## Install from GitHub

Run these commands with a Codex CLI that supports plugin marketplaces.

~~~powershell
codex plugin marketplace add 'Wayzer107/codex-plugin-ports'
codex plugin add 'codex-setup@codex-plugin-ports'
codex plugin add 'agents-md-management@codex-plugin-ports'
codex plugin add 'memory-bank@codex-plugin-ports'
codex plugin list --marketplace codex-plugin-ports
~~~

For a local checkout, pass the checkout's absolute path to `codex plugin marketplace add` in place of the GitHub repository name.

Start a new Codex conversation, type `$`, and select the installed skill.

## Project-scoped LSP selection

Install [Project LSP](plugins/project-lsp/README.md) to let Codex detect source languages during coding work and enable their marketplace packages inside the Git project.

~~~powershell
codex plugin add 'project-lsp@codex-plugin-ports'
~~~

Use `$project-lsp:project-lsp` for an explicit setup or when you want to preview changes. The checker writes GitHub source references and activation settings inside the project, and Codex handles package downloads. Start a new thread if the current one does not yet expose the new tools.

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

## MCPB bundles

Each language server plugin is also built as a standalone [MCPB](https://github.com/anthropics/mcpb) bundle in [`dist/mcpb/`](dist/mcpb), for hosts such as Claude Desktop that install a single `.mcpb` file. A bundle contains the same bridge as the Codex plugin and has no dependencies beyond Node.js 22 or newer and the native language server on PATH. It asks for no install-time settings: call `lsp_start` with the absolute project root, as described in the plugin's README.

Rebuild all bundles after changing the bridge or profiles (the build needs network access to fetch the MCPB CLI):

~~~bash
node scripts/sync-lsp-plugins.mjs
node scripts/build-mcpb.mjs
~~~

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

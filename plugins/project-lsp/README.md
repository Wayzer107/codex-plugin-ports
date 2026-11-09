# Project LSP

Project LSP is a Codex skill for source-code work in Git repositories. It detects supported languages and enables the matching LSP packages from this marketplace at project scope. It works with all 12 language ports and can enable multiple ports for a mixed-language repository.

After adding or refreshing the marketplace, install the selector and start a Codex thread in the project.

~~~powershell
codex plugin add 'project-lsp@codex-plugin-ports'
~~~

Codex can select the skill for source-code work. To run it explicitly, type `$project-lsp:project-lsp` and ask it to detect and activate the project's language plugins. Implicit skill selection is model-driven.

## Project files

- `.codex/lsp-plugins/` holds the exact selected marketplace packages bundled with this version of the selector.
- `.agents/plugins/marketplace.json` lists their local sources. Existing entries are preserved.
- `.codex/config.toml` holds the managed MCP registrations. Existing settings take precedence over the selector when they configure the same plugin.

The selector runs offline and writes within the Git root. It registers the MCP entry points from the copied packages directly in project config. Run the checker again if you move the checkout, since those registrations contain absolute paths. The project must be trusted in Codex for the configuration to take effect. If new tools are missing in a running thread, open a fresh thread in that project. The LSP ports use the Node runtime and language-server executables already available on the Codex host's PATH.

## Use from a checkout

Run the checker directly from a checkout of this marketplace for a one-time project setup. Add `--check` to preview the detected ports and pending changes, or repeat `--file` to include new source paths.

~~~powershell
node '<marketplace checkout>/plugins/project-lsp/skills/project-lsp/scripts/project-lsp.mjs' --cwd '<project directory>'
~~~

Run the check again after the project changes languages. The checker removes its stale MCP registrations and retains their package files in the project for reuse.

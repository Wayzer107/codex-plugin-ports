# Codex Plugin Ports

Two skills-only Codex plugins adapted from Anthropic's Claude plugins. Each plugin is independently installable.

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

## Source and license

The original plugins are in [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins) at commit `0412be76f50ab4f4f8abff3753efa9269fbbca5b`. Isabella He is credited as the author of both upstream plugins. Each port describes its changes in its README.

The marketplace is distributed under the [Apache License 2.0](LICENSE). Each plugin also includes a copy of the license.

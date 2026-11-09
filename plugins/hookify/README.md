# Hookify for Codex

Create Markdown rules for Codex shell commands, patch edits, prompt submission, and completion. The marketplace plugin ships the Codex hook definitions, a Python evaluator, and the `$hookify:writing-rules` skill for creating, listing, validating, and toggling rules.

~~~powershell
codex plugin marketplace upgrade codex-plugin-ports
codex plugin add 'hookify@codex-plugin-ports'
~~~

Use Git and Python 3.10 or newer. The hook uses `python` on Windows and `python3` elsewhere. Start a new Codex session and review the plugin's definitions in `/hooks`. Rules take effect on the next matching event after the hooks are trusted.

Hookify uses `.codex-plugin/plugin.json` so Codex CLI can load its plugin hooks. It runs where Codex supports local command hooks.

Rules live in `.codex/hookify.<name>.local.md` at the Git root and must be ignored and untracked. To use a private ignore, add `/.codex/hookify.*.local.md` to the local exclude file reported by `git rev-parse --git-path info/exclude`. Invoke the writing skill with the behavior you want to warn about or block.

[Rule syntax and example](skills/writing-rules/references/rules.md) · [Codex hook behavior](https://learn.chatgpt.com/docs/hooks)

## Upstream

Adapted from [Anthropic Hookify](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins/hookify) under the [Apache License 2.0](LICENSE). This port replaces Claude hook payload and response handling with Codex events. It packages the original command workflows as a Codex skill and keeps Markdown rules with Python regular expressions.

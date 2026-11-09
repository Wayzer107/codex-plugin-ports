# Discovery and scope

Start with the Git root from `git rev-parse --show-toplevel`, or the current directory if no project root is identified. Within the requested repository, `rg --files --hidden -g AGENTS.md -g AGENTS.override.md -g '!.git'` lists ordinary candidates. Ripgrep honors ignore rules. Check literal filenames along each relevant directory chain to catch gitignored overrides or fallbacks. For a complete inventory, also account for ignored project directories in scope and exclude generated/vendor trees and separate repositories unless requested. Avoid following links outside the authorized scope.

## Active instructions

- Global guidance comes from the first non-empty `AGENTS.override.md` or `AGENTS.md` in the active Codex home (`CODEX_HOME`, default `~/.codex`).
- In a project, Codex builds its startup chain from the project root to the working directory. It loads at most one file per directory. The order is `AGENTS.override.md`, `AGENTS.md`, then `project_doc_fallback_filenames` in configured order. Empty files are skipped. Without a project root, Codex checks the working directory.
- Deeper files come later and can override earlier guidance. For work in a subdirectory, read the instructions for that subtree. When a non-empty override is present, the regular file at that level is shadowed for that chain.
- The combined project guidance is limited by `project_doc_max_bytes` (32 KiB by default). Flag likely truncation against the active configuration. Start a fresh Codex run to check updated startup guidance.

## Choose a destination

Put cross-project preferences in global guidance only when the user requests it. Put team-wide project guidance at the root and package rules at the narrowest applicable directory. Inspect any existing override before selecting a target. If a private override shadows a shared file, describe the effect on each audience and preserve the separation. Confirm tracking or ignore state with Git. The filename alone does not make an override private.

[Codex AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

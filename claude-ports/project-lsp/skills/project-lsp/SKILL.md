---
name: project-lsp
description: This skill should be used when the user asks to "enable language servers for this project", "set up LSP for this repo", "which LSP plugins does this project need", "check the project's language servers", "remove unused LSP plugins", or is about to add files in a language the project lacks, or LSP tools are missing for its language. It detects a Git project's languages and enables the matching *-lsp plugins from claude-plugins-official in .claude/settings.json.
---

# Project LSP

Enable exactly the language-server plugins a Git project needs, at project scope. The plugin's SessionStart hook already runs the checker automatically; use this skill to run it explicitly, preview changes, or count a language before its first file exists.

## Run the checker

Resolve the script path relative to this SKILL.md and run it with Node.js 22 or newer:

```bash
node "<directory containing this SKILL.md>/scripts/project-lsp.mjs" --cwd "<absolute project directory>"
```

`--cwd` must be absolute; any directory inside the repository works, since the checker resolves and writes to the Git root. Options:
- `--check`: report the plan without writing anything. Use it for audits or when the user asked not to change configuration.
- `--file <path>`: count a file Git does not list, either a file not created yet (to enable a language before its first file exists) or a gitignored file. Untracked, non-ignored files are already scanned. Give the path as absolute or relative to the Git root; it must be inside the project and not under an excluded directory. Repeat for several files.
- Do not pass `--hook`; it is reserved for the SessionStart hook, which suppresses the JSON result and errors.

## Read the result

The checker prints one JSON object:
- `project`: the Git root the checker resolved and wrote to.
- `detected`: plugin names (for example `gopls-lsp`) whose file extensions occur in the project.
- `managed`: plugin IDs (`<name>@claude-plugins-official`) the checker enabled and tracks in `.claude/project-lsp.json`.
- `skipped`: detected plugin IDs whose entry was set or changed by hand in `.claude/settings.json` (including `false`); never touched.
- `added` / `removed`: plugin IDs enabled or removed by this run. Under `--check` these are planned changes, not applied. Removals only affect plugins the checker enabled earlier.
- `changed`: whether any file was written, or under `--check` would be. It can be true with empty `added`/`removed`.
- `check`: true when run with `--check`.
- `extensions`: `catalog` when the installed claude-plugins-official catalog supplied the extension map, `bundled` when the fallback map was used.

Report `added` and `removed` to the user, saying "would enable/remove" when `check` is true, and state that plugin changes take effect in the next Claude Code session. If the checker exits non-zero, report its stderr message (prefixed `project-lsp:`) and continue the task with the tools already available.

## Constraints

- The checker scans tracked and non-ignored files and skips any path containing `node_modules`, `vendor`, `third_party`, `dist`, `build`, `target`, `.venv`, `__pycache__`, `.git`, `.claude`, `.codex` or `.agents` (case-insensitive).
- It writes the committed `.claude/settings.json` (`enabledPlugins`, plus `extraKnownMarketplaces.claude-plugins-official` when it manages any plugin) and `.claude/project-lsp.json`, creating `.claude/` only when it writes, so changes appear in `git diff`. It refuses to write through symbolic links and aborts if settings change during the run.
- The plugins must be installed from claude-plugins-official, and each language server binary (for example `gopls`, `clangd`) must be on PATH; the checker installs neither.

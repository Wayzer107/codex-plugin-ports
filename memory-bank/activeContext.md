# Active Context

## Current Focus
Draft PR 1 (branch `claude/claude-code-marketplace`): Claude Code marketplace, MCPB bundles, session hooks with plugin installation, `CLAUDE.md`, project MCP servers, and the Claude Code port of project-lsp.

## Recent Changes
- Ran the claude-md-optimizer audit: `CLAUDE.md` is 46 lines (threshold 200), no `AGENTS.md`/Copilot files, no git-crypt, nothing parses `CLAUDE.md`; no restructuring done. Optional follow-ups offered: drop hard-coded plugin counts, merge the `.mcp.json` regeneration note into the add-a-plugin checklist.
- Added `claude-ports/project-lsp/` (Claude Code port of the Codex project-lsp): skill + plugin SessionStart hook; detects languages and enables matching `*-lsp@claude-plugins-official` in the project's `.claude/settings.json`, tracking its entries in `.claude/project-lsp.json`. Listed in `.claude-plugin/marketplace.json`; 11 tests in `tests/claude-project-lsp.test.mjs`. This repo now enables `pyright-lsp` and `typescript-lsp` at project scope.
- Enable policy changed: repo hook and setup script install all LSP plugins but set them `false` at user scope; `claude-md-management` and `project-lsp` stay enabled; `project-lsp` is installed from this checkout's marketplace.
- Added `.mcp.json` with the 12 LSP bridge servers (`${CLAUDE_PROJECT_DIR:-.}/plugins/<name>-lsp/server/`) and `enableAllProjectMcpServers: true` in `.claude/settings.json`; noted in `CLAUDE.md`.
- Added `CLAUDE.md` (about 400 tokens): commands including single-test runs, architecture (generated LSP bridge, manifest styles, MCPB), hook behaviour, pointer to this memory bank.
- `.claude/hooks/session-start.sh` now, in Claude cloud sessions only, installs and enables `claude-md-management` and every `*-lsp` plugin from `claude-plugins-official` (stamp-skipped), and on every start runs `claude plugin enable` for any disabled at user or local scope (project-scope disable only warns).
- The "plugin ports" cloud environment setup script installs the same plugins on fresh containers and sets `enableAllProjectMcpServers: true` in user settings, so the `.mcp.json` servers are approved (stored on the environment, not in git).
- `scripts/build-mcpb.mjs` and 12 committed bundles in `dist/mcpb/`.
- `.claude/settings.json` enables `claude-md-management@claude-plugins-official`.

## Next Steps
Await review of PR 1. Done: the setup script now sets `enableAllProjectMcpServers`. Optional: optionally trim `.mcp.json` to used languages. Optional: README note on Codex trust steps; a staleness check for `dist/mcpb/`.

## Active Decisions & Considerations
- project-lsp's hook auto-writes committed `.claude/settings.json` in any Git repo (agreed); it writes at the Git root, which is unverified when Claude Code is started in a subdirectory.
- `claude-`-prefixed plugins stay out of our Claude marketplace (reserved names).
- `dist/` is tracked on purpose (user request).
- Hook and setup script duplicate the plugin logic; change both together.

## Important Patterns & Preferences
Copies in `claude-plugins/` stay unmodified. Commits end with the Co-Authored-By and Claude-Session lines. User prefers a formal tone and Dutch context for general advice.

## Learnings & Insights
- The memory-bank Stop hook compares file mtimes; after a fresh clone every file shares the checkout time, so it flags `src/` and `scripts/` files that did not change (check `git status`/`git log` before assuming work happened).
- A project-scope `enabledPlugins: true` overrides a user-scope `false` (verified with `claude plugin list`).
- `claude plugin marketplace add owner/repo#branch` pins a branch; the repo hook uses `marketplace add "$PWD"` instead.
- Claude LSP plugins live in marketplace entries (`lspServers`).
- A fresh Claude CLI knows only `anthropic-plugin-directory`; `claude plugin marketplace add` is needed for `claude-plugins-official`.
- `claude plugin enable` exits 1 on an already-enabled plugin; `disable` without `--scope` may write to the committed project settings.
- The cloud container sets `CLAUDE_CODE_REMOTE=true` in its own environment, so the Codex path must be gated on `SESSION_HOOK_FORCE` explicitly.
- `enableAllProjectMcpServers` is honoured from project settings only once the project is trusted (user settings work regardless); no environment-variable equivalent found in the CLI.
- Codex needs project trust and hook trust before running project hooks.

# Progress

## What Works
- Codex marketplace with 16 plugins (loads in Codex 0.167.1).
- Claude Code marketplace with 13 verbatim plugins (`diff -r` clean, validator passes).
- SessionStart hooks for Claude and Codex; Codex discovers the project hook (when trusted).
- All existing tests and the sync check pass.

## What's Left to Build
- Run the Codex hook end-to-end in a logged-in session (not possible in the cloud container).
- Optionally document project/hook trust steps in the README.
- Review and merge draft PR 1.

## Current Status
Branch `claude/claude-code-marketplace` pushed (3 commits ahead of `main`); draft PR 1 open.

## Known Issues
Copied READMEs lack a marketplace install line (validator warning, intentional). Windows Codex hook checks only the Node version.

## Decision History
`main` equalled the earlier work branch (`f39054b`), so no merge was needed. Copy location `claude-plugins/` chosen over moving the Codex ports. Scope limited to plugins that already have Codex ports.

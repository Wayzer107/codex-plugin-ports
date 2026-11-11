# Active Context

## Current Focus
Claude Code marketplace support and session-start hooks, delivered in draft PR 1 (branch `claude/claude-code-marketplace`).

## Recent Changes
- Added `.claude-plugin/marketplace.json` and `claude-plugins/` (13 plugins).
- Added Claude (`.claude/`) and Codex (`.codex/hooks.json`) SessionStart hooks.
- Verified Codex marketplace load and hook discovery with the Codex CLI.
- Added this memory bank.

## Next Steps
Await PR review; decide whether to add README notes on Codex trust steps.

## Active Decisions & Considerations
Excluded `claude-`-prefixed plugins from the Claude marketplace; revisit only if the user wants renamed variants.

## Important Patterns & Preferences
Copies must stay unmodified. Commits end with the Co-Authored-By and Claude-Session lines. User prefers a formal tone and Dutch context for general advice.

## Learnings & Insights
Claude LSP plugins live in marketplace entries. Codex needs project trust and hook trust before running project hooks.

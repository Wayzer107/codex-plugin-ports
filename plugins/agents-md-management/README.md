# AGENTS.md Management

| Skill | Use it when |
| --- | --- |
| `$agents-md-management:agents-md-improver` | You want a repository audit for stale, missing, or conflicting project instructions |
| `$agents-md-management:revise-agents-md` | The current session revealed a verified command, convention, or recurring gotcha worth saving |

Try “Audit this repository's AGENTS.md files” or “Use `$agents-md-management:revise-agents-md` to capture what we learned about running API tests.” The audit reports scores and proposals. The session skill presents concise proposals for the applicable scope. Both support reviewing complete proposed files before approving edits.

## Upstream and changes

Adapted from Isabella He's [claude-md-management](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins/claude-md-management) under the [Apache 2.0 license](LICENSE). The port audits Codex project instructions and exposes the upstream session-revision command as an explicitly invoked Codex skill.

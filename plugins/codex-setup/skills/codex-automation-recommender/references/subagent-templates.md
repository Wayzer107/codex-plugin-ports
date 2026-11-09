# Subagents

Use a subagent for a bounded research or review task that benefits from independent context. Examples include reviewing authentication changes, tracing API test coverage, or inspecting accessibility in a defined UI surface. Set a clear deliverable and file ownership if edits are authorized.

Put a custom agent in `.codex/agents/<name>.toml` for a project or `~/.codex/agents/<name>.toml` for personal use. Supply `name`, `description`, and `developer_instructions`.

```toml
name = "api-reviewer"
description = "Reviews changed API endpoints for compatibility and coverage."
developer_instructions = """
Review the assigned diff and relevant tests. Report concrete findings with file
references and explain how to reproduce each issue. Keep the review read-only.
"""
```

The agent inherits parent permissions, provider, and MCP servers. Its written read-only instruction is a scope constraint. Verify that the target Codex surface exposes delegation and honors the role before proposing a workflow that depends on it.

[Codex multi-agent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents)

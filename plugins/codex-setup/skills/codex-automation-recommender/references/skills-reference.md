# Skills and recurring workflows

A project skill lives at `.agents/skills/<name>/SKILL.md`. A user skill lives at `~/.agents/skills/<name>/SKILL.md`. In a plugin, package it as `skills/<name>/SKILL.md`. Use a matching folder and frontmatter name, plus a description that names the trigger.

```markdown
---
name: api-test-plan
description: Use when the user needs a test plan for a changed API endpoint in this repository.
---

Find the route, relevant fixtures, and tests for nearby endpoints.
Propose cases that match the existing harness and give its verified test command.
```

Invoke a skill explicitly with `$skill-name`. For an explicit-only workflow, put `policy.allow_implicit_invocation: false` in that skill's `agents/openai.yaml`. Invocation policy does not grant authority to deploy, send, commit, or change permissions.

| Signal | Workflow |
| --- | --- |
| Repeated schema, component, or test creation | A skill with a checked-in template and verification command |
| Recurring PR review or release notes | An explicitly invoked skill backed by the repository's actual checklist |
| A convention that applies to everyday changes | Scoped `AGENTS.md` guidance |
| Mechanical work with a reproducible command | Existing task runner or CI check |
| A separately scheduled task | Consider a Codex automation only if the target surface and execution environment support it |

[Codex skills documentation](https://developers.openai.com/plugins/build/skills)

---
name: codex-automation-recommender
description: Use when the user wants to set up Codex for a repository, optimize its Codex workflow, or asks which Codex hooks, MCP servers, skills, plugins, subagents, or repeatable workflows would help.
---

# Codex Automation Recommender

Inspect the repository and recommend automations tied to observed work. Run read-only inspection. Installing, configuring, or applying recommendations is a separate task.

## Inspect

1. Establish the repository root, working directory, and requested scope. Use `rg --files` and targeted reads. Sample representative packages in a large repository.
2. Read manifests, package scripts, lockfiles, CI, test and lint configuration, and existing project docs. Identify the stack, real commands, and repeated tasks or likely friction backed by evidence.
3. Check existing `AGENTS.md`, `AGENTS.override.md`, `.agents/skills/`, `.agents/plugins/marketplace.json`, `.codex/config.toml`, `.codex/hooks.json`, and `.codex/agents/` when present. Check the current tools first, then use `codex mcp list` or `codex plugin list` if the CLI is available and the inventory matters. Treat configured, installed, and callable as separate states. Summarize relevant settings without printing credentials, environment values, private endpoints, or unrelated personal config.

## Match the job to a Codex feature

| Feature | When it fits | Reference |
| --- | --- | --- |
| MCP or built-in tool | The workflow needs live data, docs, or browser interaction | [MCP servers](references/mcp-servers.md) |
| Skill | A repeatable workflow needs instructions, templates, or scripts | [Skills](references/skills-reference.md) |
| Hook | A narrow event needs a fast mechanical check | [Hooks](references/hooks-patterns.md) |
| Subagent | A parallel or specialized workstream has a clear independent scope | [Subagents](references/subagent-templates.md) |
| Plugin | A compatible bundle already solves the workflow or needs distribution | [Plugins](references/plugins-reference.md) |
| `AGENTS.md` or existing command | A durable repo convention or a command users can already run | [Skills](references/skills-reference.md) |

Read the applicable references. Verify current third-party packages, authentication, and install commands against their official sources or the active marketplace. Prefer available tools that meet the need. Keep hypotheses separate from repository findings.

## Report

- Start with the repository profile, relevant tooling already in place, and any limits on inspection.
- Give the best one or two recommendations per applicable category. If the user names specific categories, cover those categories. For a request focused on one category, give up to five supported options.
- For each option, state the evidence, benefit, exact scope or path, prerequisite, and a way to verify it. Mark suggestions whose availability you could not establish. Label snippets as examples, and match shell commands to the user's platform.
- Example. If `package.json` defines `pnpm lint` and CI repeats it, keep the existing script as the entry point. Suggest an opt-in edit hook only if it can run a fast scoped check and early feedback would help.

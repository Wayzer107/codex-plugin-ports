---
name: project-lsp
description: Use when beginning work that reads, writes, reviews, debugs, or navigates source code in a Git project, or when the user asks to activate language servers for a repository.
---

# Project LSP

Use this skill before the first source-code investigation or edit in a task. It keeps the matching Codex language plugins scoped to the current Git repository.

1. Use the task's working directory. If the session already exposes the needed project LSP tools and the relevant source languages have not changed, use those tools. Recheck when the task moves to another repository or introduces a source extension.
2. Run the bundled checker with Node.js 22 or newer. Resolve its path relative to this skill file. Pass the absolute task working directory to `--cwd`. For a new file or a known target omitted by Git's scan, pass `--file` with its absolute path or a path relative to the Git root. Repeat `--file` for multiple targets.
3. For an audit-only task or an instruction to avoid configuration changes, add `--check` to report the plan without writing.
4. Read the JSON result. `detected` lists matching ports. `managed` lists the ports enabled by the checker. `skipped` lists ports covered by existing project entries or settings that the checker preserves. If a prerequisite or project-config check fails, report the specific issue and continue the source task with the tools available.
5. Use the matching MCP server if the current thread exposes it. Call `lsp_start` with the relevant build or package root and poll `lsp_status` if needed. When a newly configured MCP tools are absent from the current thread, say that a new Codex thread in the trusted project picks up the project settings. Continue the current source task with available tools.

~~~text
node "<directory containing this SKILL.md>/scripts/project-lsp.mjs" --cwd "<absolute project working directory>"
~~~

The checker copies the included marketplace packages to `.codex/lsp-plugins/`, merges local entries into `.agents/plugins/marketplace.json`, and manages only its own MCP registration block in `.codex/config.toml`. It scans tracked and nonignored files, skips common dependency and build directories, and runs offline. Native language servers and Node must already be on the Codex host's PATH. Start native servers only for trusted code, since they can invoke project tooling.

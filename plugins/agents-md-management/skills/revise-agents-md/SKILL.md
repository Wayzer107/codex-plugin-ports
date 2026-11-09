---
name: revise-agents-md
description: Use when the user explicitly asks to capture durable learnings from the current Codex session in AGENTS.md.
---

# Revise AGENTS.md from this session

Review the current session for lessons that would help a future Codex run in this repository. Use this skill explicitly with `$agents-md-management:revise-agents-md`. Treat invocation as a request to review and propose updates.

1. Identify what future work would benefit from knowing. Keep verified build or test commands, recurring configuration quirks, project conventions, and non-obvious invariants. For each candidate, find session or repository evidence. If earlier context is unavailable, work from what you can verify and identify the gap.
2. Exclude secrets, private details, transient workarounds, one-time incident history, and generic advice. Keep each learning brief and merge it with existing guidance where it belongs.
3. Locate the narrowest applicable guide. Read [discovery and scope](../agents-md-improver/references/discovery-and-scope.md) for how root, nested, and override files interact. Check which file is effective and which files are shared. Use global guidance only when explicitly requested.
4. Show each target, a brief reason and supporting evidence, and the complete proposed file. Use [update guidelines](../agents-md-improver/references/update-guidelines.md). If there are no durable additions, say so and stop.
5. Apply only the specific changes the user authorizes. If that authorization is already clear, proceed after presenting the proposal. Otherwise wait for approval. Re-read the target before applying and verify the resulting file and effective scope.

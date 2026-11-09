---
name: writing-rules
description: Use when the user wants a Hookify rule to warn or block on recurring Codex behavior, asks to list or toggle Hookify rules, or asks how Hookify works.
---

# Hookify rules

Use local Markdown rules for concrete, detectable behavior. Ask for a pattern only when the requested behavior and intended action are unclear. Use `warn` when the user has not asked to block. A rule that blocks prompts or continues turns needs a narrow match.

## Create or change a rule

1. If the user describes a behavior, select the narrowest event and the actual field that carries the signal. If they ask to analyze the session, look for recent explicit corrections and recurring actions. Propose at most four rules and confirm which concrete behavior to capture when the request is open-ended.
2. Read [rule syntax](references/rules.md). Use `.codex/hookify.<name>.local.md` as a filename pattern under the Git root. Check that Git ignores the file and that the path is untracked. For a private ignore, locate the exclude file with `git rev-parse --git-path info/exclude` and add `/.codex/hookify.*.local.md` if needed for an authorized rule. Preserve existing ignore entries.
3. Preserve existing rules and unrelated settings. Show the complete proposed file when the user asks for a draft. When writing an authorized rule, validate it with `python "<plugin root>/hooks/run.py" validate "<rule path>"` and show a matching and non-matching input. Use `python3` on systems that name the executable that way.
4. Check `/hooks` in Codex CLI if the plugin hooks have not been trusted. Runtime rules are re-read on each event.

## List, configure, and explain

- List local rules with `python "<plugin root>/hooks/run.py" list --cwd "<project path>"`. It reports enabled state and malformed rules.
- To toggle a rule, edit its `enabled` value and validate the complete file.
- For help, explain the available events, what the requested action does in Codex, and where the user can verify it.

Resolve `<plugin root>` by walking two directories up from the directory containing this skill. Keep private prompts and transcripts out of saved rules.

---
name: agents-md-improver
description: Use when the user wants to audit, check, improve, or maintain AGENTS.md project instructions or asks whether the repository's Codex guidance is current.
---

# AGENTS.md Improver

Audit repository guidance against the codebase and propose targeted changes. Show the quality report and proposed changes before editing.

## Discover effective guidance

1. Identify the project root and the requested scope. For a broad audit, find canonical `AGENTS.md` and `AGENTS.override.md` files across the repository. Inspect applicable fallback filenames if a trusted config defines them.
2. For each requested work directory, resolve its active chain. Mark shadowed files separately from effective files. Inspect parent guidance to find duplication and conflicts. See [Discovery and scope](references/discovery-and-scope.md).
3. Include user-wide guidance only if requested. If no project file exists, report the gap and propose a minimal file only when there is concrete guidance worth adding.

## Assess and report

Verify advice against manifests, CI, scripts, entry points, and focused source reads. Separate commands found in source from commands successfully run. Read the [scoring rubric](references/quality-criteria.md) and use [templates](references/templates.md) for a missing or thin guide.

Report the audited scope, file count, and average for scored files. For each file, show the score and grade, whether and where it is active, concrete evidence for stale or missing advice, and recommended changes. Report missing files separately. If the scope is partial, say which directories were covered.

## Propose and apply

Follow [update guidelines](references/update-guidelines.md). For each proposed change, give the path, reason, and complete revised file. Keep untouched sections as written. Honor a user request for a diff.

Apply only the concrete changes the user authorizes. An audit or a general request to improve guidance starts with the report and proposal. If the user has already authorized the specific edits, apply them without asking again. Otherwise wait for approval. Re-read the files before editing and reconcile intervening changes before applying an approved proposal. Verify the final contents and the scope where they take effect.

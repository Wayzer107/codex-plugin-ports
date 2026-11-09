# Codex Setup

The `$codex-setup:codex-automation-recommender` skill profiles the current repository and ranks Codex setup options against the tools and workflows it finds. It is read-only.

Try “Recommend Codex automations for this repository” or “Which Codex hooks would help this project?” The skill reports the strongest one or two options per applicable category. A focused request can cover more options in that category.

## Upstream and changes

Adapted from Isabella He's [claude-code-setup](https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins/claude-code-setup) under the [Apache 2.0 license](LICENSE). The port replaces the upstream configuration, examples, and recommendation catalog with Codex equivalents.

# Project Brief

## Project Name
Codex Plugin Ports (`Wayzer107/codex-plugin-ports`)

## Core Goal
Provide a plugin marketplace for Codex CLI with ports of Anthropic's Claude plugins and the Codex edition of Ultrapowers Dev. The same repository is also a Claude Code marketplace that carries unmodified upstream copies.

## Key Requirements
- Each Codex plugin is independently installable from `.agents/plugins/marketplace.json`.
- Claude Code plugins under `claude-plugins/` are byte-identical copies of upstream (no modification), listed in `.claude-plugin/marketplace.json`.
- Upstream source of record: commit `0412be76f50ab4f4f8abff3753efa9269fbbca5b`.
- Apache-2.0 marketplace licence; every plugin keeps its own LICENSE copy. Ultrapowers Dev retains its MIT licence.

## Scope
In: Codex packages (`plugins/`), unmodified Claude copies (`claude-plugins/`), shared LSP bridge (`src/`), tests, session-start hooks.
Out: Claude plugins with no Codex port, third-party `external_plugins/`, and `claude-code-setup` / `claude-md-management` on the Claude side (see systemPatterns.md).

# Ultrapowers Dev for Codex

A skills-only Codex plugin with 55 reusable software-development skills for language practices, framework patterns, architecture, testing, security, and agent workflows. It is the Codex package of [Ultrapowers Dev](https://github.com/ennio-datatide/ultrapowers-dev), a companion to [Ultrapowers](https://github.com/ennio-datatide/ultrapowers).

## What's included

- 55 skills under skills/.
- The original MIT license and supplied Ultrapowers Dev icons.
- A root Agent Plugins 1.0 plugin.json manifest for Codex and other portable plugin hosts.
- A Codex-focused rewrite of skills/plugin-development/SKILL.md.
- Codex-compatible skill IDs in frontmatter, matching each skill's folder name.

The marketplace revision uses a dedicated browser session for authenticated automation and treats fetched web design guidelines as review reference material. A few agent-workflow examples demonstrate the Anthropic API to teach provider-specific integration. The plugin has no runtime dependency on that API.

This is a skills-only package. It does not include an MCP server, hooks, or executable code.

## Install in the Codex desktop app

Register the local Codex Plugin Ports checkout by running the first command from its root. Then install the plugin.

~~~sh
codex plugin marketplace add .
codex plugin add ultrapowers-dev@codex-plugin-ports
~~~

Start a new Codex conversation and use `$` to select a skill from Ultrapowers Dev.

## Upstream and attribution

- Upstream source: [Ultrapowers Dev v1.2.0](https://github.com/ennio-datatide/ultrapowers-dev/tree/11b7abc233259fa7600faef096eaa11fa95327de)
- Upstream documentation: [datatide.io/ultrapowers](https://datatide.io/ultrapowers)
- Publisher: Ennio Maldonado / DataTide
- License: MIT; see LICENSE.

The Codex package version is `1.2.0+codex.2`. The version keeps the upstream release number and marks this Codex packaging revision.

---
name: plugin-development
description: Use when designing, authoring, packaging, validating, or locally installing Codex plugins and marketplaces; covers manifests, skills, MCP configuration, assets, versioning, and distribution.
---

# Codex Plugin Development

Use this skill to build a plugin for Codex or another compatible Agent Plugins host. A plugin packages reusable skills and may also connect MCP servers or include host extensions.

## Plugin package layout

A portable package uses this layout:

~~~text
my-plugin/
├── plugin.json
├── skills/
│   └── my-skill/
│       └── SKILL.md
├── mcp.json                 # Optional portable MCP servers
├── assets/                  # Optional referenced assets
└── .codex-plugin/
    └── plugin.json          # Optional Codex compatibility fallback
~~~

Keep plugin.json, skills/, mcp.json, and assets/ at the plugin root. The portable manifest is the entry point. A .codex-plugin/plugin.json is optional; if you include it, keep its identity, version, and presentation synchronized with the root manifest.

A plugin needs at least one usable skill, MCP server, or connected app. Do not add empty components just to make a package appear complete.

## Portable manifest

Use the Agent Plugins 1.0 schema and lowercase kebab-case names:

~~~json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Reusable workflows for a specific audience.",
  "author": {
    "name": "Your team",
    "url": "https://example.com"
  },
  "license": "MIT",
  "keywords": ["workflow", "codex"],
  "extensions": {
    "com.openai": {
      "interface": {
        "displayName": "My Plugin",
        "shortDescription": "A clear purpose in 30 characters",
        "longDescription": "Describe the supported behavior and intended users.",
        "developerName": "Your team",
        "category": "Developer Tools",
        "capabilities": [],
        "defaultPrompt": "Help me with this workflow."
      }
    }
  }
}
~~~

Keep the plugin name stable across releases. Use a strict SemVer version for a new package. Put OpenAI-specific interface and app settings inside extensions.com.openai; do not add top-level skills, mcpServers, apps, or interface fields to the portable manifest. Skills and MCP servers are found at their fixed package paths.

Choose an exact supported category title. Software-development plugins use Developer Tools. The interface shortDescription must be no more than 30 characters. If you reference icons, use contained relative paths and include the files in the package.

## Skills

Put each skill at skills/<skill-id>/SKILL.md. Give it YAML frontmatter with a nonblank name and description:

~~~markdown
---
name: review-api
description: Use when reviewing API design, contracts, errors, or versioning.
---

Instructions for this workflow.
~~~

Use a unique, lowercase kebab-case name matching the directory. Keep each skill focused and say when it applies in its description. Store supporting files beside the skill and use relative references that remain inside the package. Do not place portable skills inside .codex-plugin/.

## MCP servers

Use root mcp.json for a portable plugin. It needs its own Agent Plugins schema declaration and a mcpServers object. Define a verified endpoint and transport for each remote server. For a local stdio server, use the real runtime and built entrypoint, for example:

~~~json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "local-tools": {
      "type": "stdio",
      "command": "node",
      "args": ["${PLUGIN_ROOT}/server/dist/index.js"],
      "cwd": "${PLUGIN_ROOT}"
    }
  }
}
~~~

Keep protocol output on stdout and logs on stderr. Do not package credentials or invent service URLs. A legacy .mcp.json alone is not a replacement for portable mcp.json.

## Local marketplaces and installation

A marketplace is a JSON catalog that points to local or Git-backed plugins. Local marketplace files can live in a repository at .agents/plugins/marketplace.json or in the personal directory at ~/.agents/plugins/marketplace.json.

For a local entry, keep source.path relative to the marketplace root, start it with ./, and point it to the plugin directory. Include an installation policy, authentication policy, and supported category:

~~~json
{
  "name": "local-plugins",
  "interface": {
    "displayName": "Local Plugins"
  },
  "plugins": [
    {
      "name": "my-plugin",
      "source": {
        "source": "local",
        "path": "./plugins/my-plugin"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Developer Tools"
    }
  ]
}
~~~

Register a marketplace with the Codex CLI:

~~~bash
codex plugin marketplace add ./path/to/marketplace-root
codex plugin marketplace list
codex plugin marketplace upgrade
codex plugin marketplace remove marketplace-name
~~~

Use the Codex desktop app's Plugins Directory to install and test a local marketplace plugin. Restart the app after changing marketplace sources. Inspect the installed plugin's skills and connections in the host before relying on it.

## Packaging and release review

- Package one plugin per ZIP or tar.gz, either directly at the archive root or inside one enclosing plugin directory.
- Keep marketplace files outside the plugin archive.
- Include hidden manifests and every referenced asset; omit unrelated files, secrets, symlinks, dependency folders, and build outputs the plugin does not need.
- Parse JSON and YAML frontmatter, check unique skill names, confirm references resolve, and inspect the final archive inventory.
- Keep the portable manifest and any compatibility manifest synchronized.
- Treat account creation, workspace sharing, and public submission as separate steps; packaging a local plugin does not publish it.

## Attribution

Adapted for Codex from Ultrapowers Dev's original plugin-development skill. Copyright © 2026 Ennio Maldonado. The upstream project is distributed under the MIT License; see the package's LICENSE.

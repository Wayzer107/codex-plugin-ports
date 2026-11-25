# OpenAI Docs

This Codex Plugin Ports package includes the curated [OpenAI Docs skill](https://github.com/openai/skills/tree/main/skills/.curated/openai-docs) and the public [OpenAI Developer Docs MCP server](https://developers.openai.com/resources/docs-mcp). Use it for OpenAI API reference, Codex questions, and model selection or migration. The two bundled helpers use Node.js 22 or newer and use `curl` when a proxy is configured.

After registering the marketplace, install the plugin and start a new Codex chat.

~~~sh
codex plugin add openai-docs@codex-plugin-ports
~~~

The packaged skill uses the plugin's MCP connection and falls back to official documentation when that connection is unavailable. It refers to documentation tools by name so the workflow works with the plugin's tool namespace.

The upstream [Apache 2.0 license](skills/openai-docs/LICENSE.txt) is included with the skill.

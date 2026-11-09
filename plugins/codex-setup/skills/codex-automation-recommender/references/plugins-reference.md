# Plugins

Use an existing Codex plugin when it fits the observed work. Check the current marketplace and local inventory. Select by capability and confirm the exact plugin name and marketplace before giving an install command.

| Workflow | Check for |
| --- | --- |
| Document and spreadsheet authoring | A plugin with appropriate file skills or a connector for the actual document host |
| Frontend work | A design or browser bundle that adds a capability the current setup lacks |
| Collaboration | A verified connector for the actual code host or issue tracker |
| Reusing several internal skills across repositories | A portable skills plugin and a local or curated marketplace |

Current Codex CLI flows include `codex plugin list`, `codex plugin marketplace add <source>`, and `codex plugin add <plugin>@<marketplace>`. Check local `--help` for the target build. Treat listing, installation, and runtime availability as separate checks. For a local plugin, verify the marketplace root, the portable `plugin.json`, and its components before recommending registration.

[Codex plugin authoring documentation](https://developers.openai.com/plugins/build/plugins)

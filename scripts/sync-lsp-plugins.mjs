import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const check = process.argv.slice(2).includes("--check");
const profiles = JSON.parse(await readFile(join(root, "src/lsp-profiles.json"), "utf8"));
const packageRoot = "https://github.com/Wayzer107/codex-plugin-ports";
const upstreamRoot = "https://github.com/anthropics/claude-plugins-official/tree/0412be76f50ab4f4f8abff3753efa9269fbbca5b/plugins/";
const license = await readFile(join(root, "LICENSE"));
const bridge = await readFile(join(root, "src/bridge.mjs"));
const transport = await readFile(join(root, "src/lsp-client.mjs"));
const mismatches = [];

async function output(path, contents) {
  const target = join(root, path);
  if (check) {
    const current = await readFile(target).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    const normalize = (value) => value.toString().replace(/\r\n/g, "\n");
    if (!current || normalize(current) !== normalize(contents)) mismatches.push(path);
    return;
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents);
}

function json(data) {
  return JSON.stringify(data, null, 2) + "\n";
}

for (const profile of profiles) {
  const { plugin, displayName, language, install, missingHint, documentation, server, readme = [] } = profile;
  const directory = "plugins/" + plugin;
  const description = "Use " + server.command + " for " + language + " code navigation and diagnostics in Codex.";
  const shortDescription = language + " code intelligence";
  const extensions = Object.keys(server.extensionToLanguage).map((ext) => "`" + ext + "`").join(", ");

  await output(directory + "/plugin.json", json({
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name: plugin,
    version: "0.2.0",
    description,
    author: { name: "Codex Plugin Ports" },
    repository: packageRoot,
    license: "Apache-2.0",
    extensions: { "com.openai": { interface: {
      displayName,
      shortDescription: shortDescription.length <= 30 ? shortDescription : displayName + " tools",
      longDescription: description,
      developerName: "Codex Plugin Ports",
      category: "Developer Tools",
      defaultPrompt: "Use " + displayName + " to find definitions in this workspace.",
    } } },
  }));
  await output(directory + "/mcp.json", json({
    $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    mcpServers: {
      [server.name]: {
        type: "stdio",
        command: "node",
        args: ["./server/bridge.mjs", "./server/profile.json"],
        cwd: "$" + "{PLUGIN_ROOT}",
      },
    },
  }));
  await output(directory + "/server/profile.json", json({ ...server, install: missingHint ?? install }));
  if (server.autoInstall) {
    await output(directory + "/server/" + server.autoInstall, await readFile(join(root, "src/installers", server.autoInstall)));
  }
  await output(directory + "/server/bridge.mjs", bridge);
  await output(directory + "/server/lsp-client.mjs", transport);
  await output(directory + "/LICENSE", license);
  await output(directory + "/README.md", [
    "# " + displayName,
    "",
    description + " Supported source extensions are " + extensions + ".",
    "",
    "## Prerequisites",
    "",
    "- Node.js 22 or newer on the Codex host's PATH.",
    "- " + install + " [Language-server documentation](" + documentation + ")",
    "",
    ...(readme.length ? [...readme, ""] : []),
    "## Use in Codex",
    "",
    "After adding the marketplace, install this plugin and start a new Codex conversation.",
    "",
    "~~~powershell",
    "codex plugin add '" + plugin + "@codex-plugin-ports'",
    "~~~",
    "",
    "Ask Codex to use the " + server.name + " language-server tools for your project. Every query tool takes a `file` (an absolute path works best) and starts " + server.command + " for that file's project on first use, then waits for it to initialize. There is no separate start step.",
    "",
    "- **Project root**: the outermost directory inside the file's Git repository that contains " + server.rootMarkers.map((marker) => "`" + marker + "`").join(", ") + "; otherwise the repository root. Pass `workspace` to choose the root yourself.",
    "- **Positions**: lines and columns are one-based. Instead of a column you can pass `symbol`, the name to target on that line.",
    "- **Tools**: `lsp_hover`, `lsp_definition`, `lsp_type_definition`, `lsp_implementation`, `lsp_references`, `lsp_document_symbols`, `lsp_workspace_symbols` and `lsp_diagnostics`. Results list relative paths, one-based positions and a preview of the source line. `lsp_status` shows running workspaces and indexing progress.",
    "- **Lifecycle**: up to three workspaces run at once; the least recently used one stops when a fourth starts. `lsp_stop` frees them early, `lsp_start` warms one up ahead of time.",
    "",
    "Queries read saved files. The available features and indexing behaviour depend on the native server.",
    "",
    "Use trusted projects: a native language server can run build or project tools while indexing. To require an explicit `lsp_start` before any server runs, set `LSP_BRIDGE_AUTO_START=0` in the MCP server's environment.",
    "",
    "## Upstream and changes",
    "",
    "Adapted from Anthropic's [" + plugin + "](" + upstreamRoot + plugin + ") under the [Apache License 2.0](LICENSE). This port keeps the upstream file mappings and uses a local MCP bridge to start the language server and query it from Codex.",
    "",
  ].join("\n"));
}

await output("plugins/project-lsp/skills/project-lsp/assets/languages.json", json(Object.fromEntries(
  profiles.map(({ plugin, server }) => [plugin, Object.keys(server.extensionToLanguage)]),
)));

const catalogPath = ".agents/plugins/marketplace.json";
const catalog = JSON.parse(await readFile(join(root, catalogPath), "utf8"));
const pluginNames = new Set(profiles.map(({ plugin }) => plugin));
catalog.plugins = [
  ...catalog.plugins.filter(({ name }) => !pluginNames.has(name)),
  ...profiles.map(({ plugin }) => ({
    name: plugin,
    source: { source: "local", path: "./plugins/" + plugin },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Developer Tools",
  })),
];
await output(catalogPath, json(catalog));

if (mismatches.length) {
  throw new Error("Run node scripts/sync-lsp-plugins.mjs to update:\n" + mismatches.join("\n"));
}
console.log((check ? "Verified " : "Generated ") + profiles.length + " LSP plugin packages.");

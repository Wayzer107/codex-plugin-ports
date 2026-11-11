#!/usr/bin/env node
// Builds one .mcpb bundle per LSP plugin from the generated packages in plugins/*-lsp.
// Usage: node scripts/build-mcpb.mjs [--stage-only] [plugin-name ...]
// Output: dist/mcpb/<name>.mcpb (committed). Staging happens in a temporary directory.
import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mcpbCli = "@anthropic-ai/mcpb@2.1.2";
const args = process.argv.slice(2);
const stageOnly = args.includes("--stage-only");
const requested = args.filter((arg) => !arg.startsWith("--"));

const pluginsDir = path.join(root, "plugins");
// An LSP server package is any plugin that ships a generated server/profile.json
// (this excludes skill-only plugins such as project-lsp).
const available = [];
for (const name of (await readdir(pluginsDir)).sort()) {
  try {
    await access(path.join(pluginsDir, name, "server", "profile.json"));
    available.push(name);
  } catch {}
}
const selected = requested.length ? requested : available;
for (const name of selected) {
  if (!available.includes(name)) throw new Error(`Unknown LSP plugin: ${name}`);
}

const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "mcpb-staging-"));
const outRoot = path.join(root, "dist", "mcpb");
await mkdir(outRoot, { recursive: true });

function manifestFor(plugin, profile) {
  const ui = plugin.extensions?.["com.openai"]?.interface ?? {};
  return {
    $schema: "https://raw.githubusercontent.com/anthropics/mcpb/main/schemas/mcpb-manifest-v0.4.schema.json",
    manifest_version: "0.4",
    name: plugin.name,
    display_name: ui.displayName ?? plugin.name,
    version: plugin.version,
    description: plugin.description,
    long_description: ui.longDescription ?? plugin.description,
    author: plugin.author,
    repository: { type: "git", url: plugin.repository },
    license: plugin.license,
    keywords: ["lsp", "language-server", profile.name, ...new Set(Object.values(profile.extensionToLanguage))],
    server: {
      type: "node",
      entry_point: "server/bridge.mjs",
      mcp_config: {
        command: "node",
        args: ["${__dirname}/server/bridge.mjs", "${__dirname}/server/profile.json"],
      },
    },
    compatibility: {
      platforms: ["darwin", "win32", "linux"],
      runtimes: { node: ">=22" },
    },
  };
}

const built = [];
for (const name of selected) {
  const source = path.join(pluginsDir, name);
  const plugin = JSON.parse(await readFile(path.join(source, "plugin.json"), "utf8"));
  const profile = JSON.parse(await readFile(path.join(source, "server", "profile.json"), "utf8"));
  const stage = path.join(stagingRoot, name);
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  await cp(path.join(source, "server"), path.join(stage, "server"), { recursive: true });
  for (const file of ["LICENSE", "README.md"]) await cp(path.join(source, file), path.join(stage, file));
  await writeFile(path.join(stage, "manifest.json"), JSON.stringify(manifestFor(plugin, profile), null, 2) + "\n");
  if (!stageOnly) {
    const output = path.join(outRoot, `${name}.mcpb`);
    execFileSync("npx", ["-y", mcpbCli, "validate", path.join(stage, "manifest.json")], { stdio: "inherit" });
    execFileSync("npx", ["-y", mcpbCli, "pack", stage, output], { stdio: "inherit" });
    built.push(output);
  }
}
if (!stageOnly) await rm(stagingRoot, { recursive: true, force: true });
console.log(stageOnly ? `Staged ${selected.length} bundles in ${stagingRoot}` : `Built ${built.length} bundles in ${outRoot}`);

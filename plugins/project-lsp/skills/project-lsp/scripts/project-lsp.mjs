import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs, promisify } from "node:util";

const exec = promisify(execFile);
const bundle = JSON.parse(await readFile(new URL("../assets/ports.json", import.meta.url), "utf8"));
const begin = "# >>> codex-project-lsp >>>";
const end = "# <<< codex-project-lsp <<<";
const excluded = new Set([".agents", ".codex", ".git", ".venv", "__pycache__", "build", "dist", "node_modules", "target", "third_party", "vendor"]);
const ports = new Map(Object.entries(bundle.plugins));
const languages = new Map();
for (const [name, files] of ports) {
  const profile = JSON.parse(files["server/profile.json"]);
  for (const extension of Object.keys(profile.extensionToLanguage)) {
    const matches = languages.get(extension) ?? [];
    languages.set(extension, [...matches, name]);
  }
}

function digest(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function contained(root, file) {
  const delta = relative(root, file);
  return delta !== ".." && !delta.startsWith(".." + sep) && !isAbsolute(delta);
}

async function git(cwd, ...args) {
  return (await exec("git", args, { cwd, windowsHide: true, timeout: 12_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
}

async function info(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

async function directory(root, name, create = false) {
  let path = root;
  for (const part of name.split("/")) {
    path = join(path, part);
    let entry = await info(path);
    if (!entry && create) {
      await mkdir(path).catch((error) => { if (error.code !== "EEXIST") throw error; });
      entry = await info(path);
    }
    if (entry && !entry.isDirectory()) throw new Error("Expected an ordinary project directory at " + relative(root, path));
  }
  return path;
}

async function textFile(path) {
  const entry = await info(path);
  if (!entry) return null;
  if (!entry.isFile()) throw new Error("Expected an ordinary file at " + path);
  return readFile(path, "utf8");
}

async function replace(path, before, next) {
  if (next === before) return;
  const temporary = join(dirname(path), "." + basename(path) + "." + randomUUID() + ".tmp");
  await writeFile(temporary, next, { flag: "wx" });
  try {
    if (await textFile(path) !== before) throw new Error("Project settings changed during setup. Retry the check.");
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}

async function detect(root, hints) {
  const hinted = new Set();
  for (const hint of hints) {
    const file = resolve(root, hint);
    if (!contained(root, file)) throw new Error("Source hint is outside the project: " + hint);
    hinted.add(relative(root, file).split(sep).join("/"));
  }
  const files = (await git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z")).split("\0");
  const found = new Set();
  for (const file of new Set([...hinted, ...files])) {
    if (!file || file.split("/").some((part) => excluded.has(part.toLowerCase()))) continue;
    const extension = extname(file);
    const matches = languages.get(extension) ?? languages.get(extension.toLowerCase());
    if (!matches || matches.every((name) => found.has(name))) continue;
    const absolute = resolve(root, file);
    if (!contained(root, absolute)) continue;
    if (!hinted.has(file)) {
      const entry = await info(absolute);
      if (!entry?.isFile()) continue;
    }
    for (const name of matches) found.add(name);
    if (found.size === ports.size) break;
  }
  return [...found].sort();
}

function unpackConfig(original) {
  const text = original ?? "";
  const escape = (value) => value.replace(/[.*+?^\x24{}()|[\]\\]/g, "\\$&");
  const start = [...text.matchAll(new RegExp("^" + escape(begin) + "\\r?$", "gm"))];
  const finish = [...text.matchAll(new RegExp("^" + escape(end) + "(?:\\r?\\n|$)", "gm"))];
  if (!start.length && !finish.length) return { before: text, after: "", managed: false };
  if (start.length !== 1 || finish.length !== 1 || start[0].index >= finish[0].index) {
    throw new Error("The managed project LSP section in .codex/config.toml is malformed.");
  }
  return {
    before: text.slice(0, start[0].index),
    after: text.slice(finish[0].index + finish[0][0].length),
    managed: true,
  };
}

function configuration(original, parts, registrations) {
  if (!registrations.length) {
    if (!parts.managed) return original;
    return parts.before + parts.after;
  }
  const newline = original?.includes("\r\n") ? "\r\n" : "\n";
  const base = parts.before && !parts.before.endsWith("\n") ? parts.before + newline : parts.before;
  const lines = registrations.flatMap(({ name, cwd, command, args }) => [
    '[mcp_servers.' + JSON.stringify(name) + ']',
    "command = " + JSON.stringify(command),
    "args = " + JSON.stringify(args),
    "cwd = " + JSON.stringify(cwd),
    "",
  ]);
  return base + [begin, ...lines, end, ""].join(newline) + parts.after;
}

function ourEntry(entry) {
  return ports.has(entry.name) && entry.source?.source === "local" &&
    typeof entry.source.path === "string" &&
    entry.source.path.startsWith("./.codex/lsp-plugins/" + entry.name + "/") &&
    /^[0-9a-f]{16}$/.test(basename(entry.source.path)) &&
    entry.source.path.split("/").length === 5;
}

async function plan(root, detected, codex, agents) {
  const catalogPath = join(agents, "marketplace.json");
  const configPath = join(codex, "config.toml");
  const existingCatalog = await textFile(catalogPath);
  const existingConfig = await textFile(configPath);
  const projectName = "project-lsp-" + digest(process.platform === "win32" ? root.toLowerCase() : root);
  const catalog = existingCatalog === null ? { name: projectName, plugins: [] } :
    JSON.parse(existingCatalog.replace(/^\uFEFF/, ""));
  if (typeof catalog?.name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(catalog.name) || !Array.isArray(catalog.plugins) ||
      catalog.plugins.some((entry) => !entry || typeof entry.name !== "string")) {
    throw new Error("The project marketplace has an unsupported name or catalog structure.");
  }
  const parts = unpackConfig(existingConfig);
  const outside = parts.before + parts.after;
  const manualEntries = catalog.plugins.filter((entry) => !ourEntry(entry));
  const manualNames = new Set(manualEntries.map((entry) => entry.name));
  const idFor = (name) => name + "@" + catalog.name;
  const serverFor = (name) => "project_lsp_" + name.replace(/-/g, "_");
  const manuallyConfigured = (name) => outside.includes(idFor(name)) || outside.includes(serverFor(name));
  const packages = [];
  const registrations = [];
  const managed = [];
  const skipped = [];
  const entries = [...manualEntries, ...catalog.plugins.filter((entry) =>
    ourEntry(entry) && !detected.includes(entry.name) && manuallyConfigured(entry.name))];

  for (const name of detected) {
    if (manualNames.has(name)) {
      skipped.push(name);
      continue;
    }
    const files = { ...bundle.common, ...ports.get(name) };
    const folder = ".codex/lsp-plugins/" + name + "/" + digest(JSON.stringify(files));
    entries.push({
      name,
      source: { source: "local", path: "./" + folder },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Developer Tools",
    });
    packages.push({ folder, files });
    if (manuallyConfigured(name)) skipped.push(name);
    else {
      const [launch] = Object.values(JSON.parse(files["mcp.json"]).mcpServers);
      registrations.push({ name: serverFor(name), cwd: join(root, folder), command: launch.command, args: launch.args });
      managed.push(name);
    }
  }

  // An inline TOML table cannot be extended with separate table headers.
  if (managed.length && /^\s*["']?mcp_servers["']?\s*=\s*\{/m.test(outside)) {
    throw new Error("The existing inline mcp_servers table must be expanded before project LSP entries can be added.");
  }

  const catalogChanged = JSON.stringify(entries) !== JSON.stringify(catalog.plugins);
  const newline = existingCatalog?.includes("\r\n") ? "\r\n" : "\n";
  const nextCatalog = catalogChanged
    ? (JSON.stringify({ ...catalog, plugins: entries }, null, 2) + "\n").replace(/\n/g, newline)
    : existingCatalog;
  const nextConfig = configuration(existingConfig, parts, registrations);
  let payloadChanged = false;
  for (const pkg of packages) {
    for (const [file, contents] of Object.entries(pkg.files)) {
      const path = join(root, pkg.folder, file);
      await directory(root, relative(root, dirname(path)).split(sep).join("/"));
      const old = await textFile(path);
      if (old === null) payloadChanged = true;
      else if (old.replace(/\r\n/g, "\n") !== contents.replace(/\r\n/g, "\n")) {
        throw new Error("A generated plugin file has been modified: " + relative(root, path));
      }
    }
  }
  return {
    catalog: catalog.name, detected, managed, skipped,
    changed: payloadChanged || nextCatalog !== existingCatalog || nextConfig !== existingConfig,
    async apply() {
      for (const { folder, files } of packages) {
        for (const [file, contents] of Object.entries(files)) {
          const path = join(root, folder, file);
          await directory(root, relative(root, dirname(path)).split(sep).join("/"), true);
          if (await textFile(path) === null) await replace(path, null, contents);
        }
      }
      if (nextCatalog !== existingCatalog) {
        await directory(root, ".agents/plugins", true);
        await replace(catalogPath, existingCatalog, nextCatalog);
      }
      if (nextConfig !== existingConfig) await replace(configPath, existingConfig, nextConfig);
    },
  };
}

async function lock(codex) {
  const path = join(codex, ".project-lsp.lock");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let handle;
    try {
      handle = await open(path, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const owner = Number(await textFile(path));
      if (!Number.isSafeInteger(owner) || owner < 1) throw new Error("Another project LSP check is writing settings. Retry shortly.");
      try {
        process.kill(owner, 0);
        throw new Error("Another project LSP check is writing settings. Retry shortly.");
      } catch (failure) {
        if (failure.code !== "ESRCH") throw failure;
      }
      if (Number(await textFile(path)) === owner) {
        await unlink(path).catch((failure) => { if (failure.code !== "ENOENT") throw failure; });
      }
      continue;
    }
    try {
      await handle.writeFile(String(process.pid));
    } catch (error) {
      await handle.close();
      await unlink(path);
      throw error;
    }
    return async () => { await handle.close(); await unlink(path); };
  }
  throw new Error("Another project LSP check is writing settings. Retry shortly.");
}

async function main() {
  const { values } = parseArgs({ options: { cwd: { type: "string" }, file: { type: "string", multiple: true }, check: { type: "boolean" } } });
  const cwd = await realpath(resolve(values.cwd ?? process.cwd()));
  const root = await realpath((await git(cwd, "rev-parse", "--show-toplevel")).trim());
  if (!contained(root, cwd)) throw new Error("Git root is outside the requested project.");
  const detected = await detect(root, values.file ?? []);
  const codex = await directory(root, ".codex");
  const agents = await directory(root, ".agents/plugins");
  let result = await plan(root, detected, codex, agents);
  if (result.changed && !values.check) {
    await directory(root, ".codex", true);
    const unlock = await lock(codex);
    try {
      result = await plan(root, detected, codex, agents);
      await result.apply();
    } finally {
      await unlock();
    }
  }
  const { catalog, managed, skipped, changed } = result;
  console.log(JSON.stringify({ project: root, catalog, detected, managed, skipped, changed, check: Boolean(values.check) }));
}

try {
  await main();
} catch (error) {
  console.error("Project LSP: " + error.message);
  process.exitCode = 1;
}

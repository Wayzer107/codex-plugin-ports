// Detect a Git project's source languages and enable the matching *-lsp plugins
// from claude-plugins-official in the project's .claude/settings.json.
// Plugins this script enabled are recorded in .claude/project-lsp.json and are
// removed again when their language disappears; entries set by hand are kept.
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs, promisify } from "node:util";

const exec = promisify(execFile);
const marketplace = "claude-plugins-official";
const marketplaceSource = { source: { source: "github", repo: "anthropics/claude-plugins-official" } };
const excluded = new Set([".agents", ".claude", ".codex", ".git", ".venv", "__pycache__", "build", "dist", "node_modules", "target", "third_party", "vendor"]);

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

// Walk to a project directory without following links; optionally create it.
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

// Atomic write that refuses to overwrite a file changed since it was read.
async function replace(path, before, next) {
  if (next === before) return;
  const temporary = join(dirname(path), "." + basename(path) + "." + randomUUID() + ".tmp");
  await writeFile(temporary, next, { flag: "wx" });
  try {
    if (await textFile(path) !== before) throw new Error("Project settings changed during the check. Retry it.");
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}

function parse(text, path) {
  if (text === null || text.trim() === "") return {};
  try {
    const value = JSON.parse(text);
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  } catch {}
  throw new Error("Expected a JSON object in " + path);
}

// Extension map: plugin name -> extensions. Prefer the installed marketplace
// catalog (lspServers.extensionToLanguage), fall back to the bundled map.
async function extensionMap() {
  const catalogPath = join(homedir(), ".claude", "plugins", "marketplaces", marketplace, ".claude-plugin", "marketplace.json");
  try {
    const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
    const map = new Map();
    for (const plugin of catalog.plugins ?? []) {
      if (!plugin?.name?.endsWith("-lsp") || !plugin.lspServers) continue;
      const extensions = Object.values(plugin.lspServers).flatMap((server) => Object.keys(server?.extensionToLanguage ?? {}));
      if (extensions.length) map.set(plugin.name, extensions);
    }
    if (map.size) return { source: "catalog", map };
  } catch {}
  const bundled = JSON.parse(await readFile(new URL("../assets/languages.json", import.meta.url), "utf8"));
  return { source: "bundled", map: new Map(Object.entries(bundled)) };
}

async function detect(root, hints, ports) {
  const languages = new Map();
  for (const [name, extensions] of ports) {
    for (const extension of extensions) languages.set(extension, [...(languages.get(extension) ?? []), name]);
  }
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

function plan(settings, state, detected) {
  const current = settings.enabledPlugins;
  if (current !== undefined && (typeof current !== "object" || current === null || Array.isArray(current))) {
    throw new Error("enabledPlugins in .claude/settings.json must be a JSON object.");
  }
  const enabled = { ...(settings.enabledPlugins ?? {}) };
  const previous = new Set(Array.isArray(state.managed) ? state.managed : []);
  const wanted = new Set(detected.map((name) => name + "@" + marketplace));
  const managed = [];
  const skipped = [];
  const added = [];
  const removed = [];
  for (const id of [...wanted].sort()) {
    if (previous.has(id)) {
      if (enabled[id] === true) managed.push(id);
      else skipped.push(id); // changed by hand since we enabled it
    } else if (id in enabled) {
      skipped.push(id); // set by hand
    } else {
      enabled[id] = true;
      managed.push(id);
      added.push(id);
    }
  }
  for (const id of [...previous].sort()) {
    if (wanted.has(id)) continue;
    if (enabled[id] === true) {
      delete enabled[id];
      removed.push(id);
    }
  }
  const next = { ...settings };
  if (Object.keys(enabled).length) next.enabledPlugins = enabled;
  else delete next.enabledPlugins;
  if (managed.length && !next.extraKnownMarketplaces?.[marketplace]) {
    next.extraKnownMarketplaces = { ...(next.extraKnownMarketplaces ?? {}), [marketplace]: marketplaceSource };
  }
  return { next, managed, skipped, added, removed };
}

function serialize(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

async function main() {
  const { values } = parseArgs({
    options: {
      cwd: { type: "string" },
      file: { type: "string", multiple: true, default: [] },
      check: { type: "boolean", default: false },
      hook: { type: "boolean", default: false },
    },
  });
  const cwd = values.cwd ?? (values.hook ? process.env.CLAUDE_PROJECT_DIR : undefined) ?? process.cwd();
  if (!isAbsolute(cwd)) throw new Error("--cwd must be an absolute path.");
  let root;
  try {
    root = await realpath((await git(cwd, "rev-parse", "--show-toplevel")).trim());
  } catch {
    if (values.hook) return; // not a Git project: nothing to do at session start
    throw new Error("The directory is not inside a Git project: " + cwd);
  }

  const ports = await extensionMap();
  const detected = await detect(root, values.file, ports.map);
  // Look up .claude without creating it; it is created only when writing.
  const claude = await directory(root, ".claude");
  const exists = Boolean(await info(claude));
  const settingsPath = join(claude, "settings.json");
  const statePath = join(claude, "project-lsp.json");
  const settingsText = exists ? await textFile(settingsPath) : null;
  const stateText = exists ? await textFile(statePath) : null;
  const settings = parse(settingsText, settingsPath);
  const state = parse(stateText, statePath);
  const { next, managed, skipped, added, removed } = plan(settings, state, detected);

  const nextSettings = serialize(next);
  const nextState = managed.length || stateText !== null ? serialize({ managed }) : null;
  // Compare content, not text, so a file is never rewritten just for formatting.
  const settingsChanged = JSON.stringify(next) !== JSON.stringify(settings);
  const stateChanged = nextState !== null && nextState !== stateText;
  const changed = settingsChanged || stateChanged;
  if (changed && !values.check) {
    await directory(root, ".claude", true);
    if (settingsChanged) await replace(settingsPath, settingsText, nextSettings);
    if (stateChanged) await replace(statePath, stateText, nextState);
  }

  const result = { project: root, extensions: ports.source, detected, managed, skipped, added, removed, changed, check: values.check };
  if (!values.hook) {
    console.log(JSON.stringify(result));
    return;
  }
  if (!added.length && !removed.length) return;
  const parts = [];
  if (added.length) parts.push("enabled " + added.join(", "));
  if (removed.length) parts.push("removed " + removed.join(", "));
  const message = "project-lsp " + parts.join("; ") + " in .claude/settings.json. Plugin changes take effect in the next session.";
  console.log(JSON.stringify({ systemMessage: message, hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: message } }));
}

main().catch((error) => {
  const hook = process.argv.includes("--hook");
  console.error("project-lsp: " + error.message);
  process.exitCode = hook ? 0 : 1;
});

import { constants } from "node:fs";
import { open, readFile, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startLsp } from "./lsp-client.mjs";

const bridgeVersion = "0.2.0";
const profile = JSON.parse(await readFile(process.argv[2], "utf8"));
// The plugin package (the directory above server/). Codex starts the bridge
// there, so that directory never counts as the user's project.
const packageRoot = await realpath(dirname(dirname(fileURLToPath(import.meta.url))));
const home = await realpath(homedir()).catch(() => homedir());
const autoStart = process.env.LSP_BRIDGE_AUTO_START !== "0";
const maxFileBytes = 2 * 1024 * 1024;
const maxDocuments = 32;
const maxWorkspaces = 3;
const maxResultBytes = 96 * 1024;
const maxPreviewFiles = 40;
const maxPreviewItems = 100;
const startupWaitMs = profile.startupWait ?? 45_000;
const diagnosticsWaitMs = profile.diagnosticsTimeout ?? 4_000;
const symbolKinds = [undefined, "File", "Module", "Namespace", "Package", "Class", "Method", "Property", "Field",
  "Constructor", "Enum", "Interface", "Function", "Variable", "Constant", "String", "Number", "Boolean", "Array",
  "Object", "Key", "Null", "EnumMember", "Struct", "Event", "Operator", "TypeParameter"];
const severities = [undefined, "error", "warning", "information", "hint"];

const fileField = {
  type: "string", minLength: 1,
  description: "Saved source file. Prefer an absolute path; a relative path resolves against `workspace` or the client's project directory. The language server for the file's project starts automatically.",
};
const workspaceField = {
  type: "string", minLength: 1,
  description: "Optional absolute project root. By default it is inferred from the file: the outermost project marker inside its Git repository, else the repository root.",
};
const lineField = { type: "integer", minimum: 1, description: "One-based line number, as shown by editors and `cat -n`. Optional when `symbol` is given." };
const characterField = { type: "integer", minimum: 1, description: "One-based column in UTF-16 code units. Omit it and pass `symbol` to target a name instead." };
const symbolField = {
  type: "string", minLength: 1,
  description: "Name to target, for example a function or variable. Its first whole-word match on `line` (or in the file when `line` is omitted) sets the column.",
};
const positionFields = { file: fileField, line: lineField, character: characterField, symbol: symbolField, workspace: workspaceField };

function tool(name, title, description, properties = {}, required = [], readOnly = true) {
  return {
    name: "lsp_" + name,
    title,
    description,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    annotations: { title, readOnlyHint: readOnly, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  };
}

const position = "Pass `file` and either `line` with `character` or `symbol`. Lines and columns are one-based.";
const tools = [
  tool("hover", "Hover information", "Show the type signature and documentation at a position. " + position, positionFields, ["file"]),
  tool("definition", "Go to definition", "Find where the symbol at a position is defined. Returns file, line, column and a preview of each location. " + position, positionFields, ["file"]),
  tool("type_definition", "Go to type definition", "Find the definition of the type of the symbol at a position. " + position, positionFields, ["file"]),
  tool("implementation", "Find implementations", "Find implementations of the interface, abstract member or method at a position. " + position, positionFields, ["file"]),
  tool("references", "Find references", "Find all references to the symbol at a position, including its declaration. " + position, positionFields, ["file"]),
  tool("document_symbols", "File outline", "List the classes, functions and other symbols in a file with their line ranges.", { file: fileField, workspace: workspaceField }, ["file"]),
  tool("workspace_symbols", "Search symbols", "Search the project for symbols by name. Uses `workspace`, else the most recently used workspace, else the client's project directory.", {
    query: { type: "string", minLength: 1, description: "Symbol name or prefix, for example `parseConfig`." },
    workspace: workspaceField,
  }, ["query"]),
  tool("diagnostics", "File diagnostics", "Report errors and warnings for a saved file. Waits briefly for the server; `pending` means it has not reported yet, so retry shortly.", { file: fileField, workspace: workspaceField }, ["file"]),
  tool("status", "Language-server status", "List running workspaces, their state, indexing progress and supported tools. Never starts a server."),
  tool("start", "Start language server", "Optional: start " + profile.command + " for a project root ahead of the first query, or for a directory without project markers. The server may run project tooling while indexing; use trusted projects.", {
    workspace: { ...workspaceField, description: "Absolute path to the trusted project root." },
  }, ["workspace"], false),
  tool("stop", "Stop language server", "Stop the language server for one workspace, or all workspaces when `workspace` is omitted. Queries restart it automatically.", {
    workspace: { ...workspaceField, description: "Absolute project root to stop. Omit to stop all." },
  }, [], false),
];

const instructions = [
  "Code intelligence from " + profile.command + " for " + Object.keys(profile.extensionToLanguage).join(", ") + " files.",
  "Call the query tools directly with an absolute file path: the language server starts automatically for the file's project and the call waits for it to initialize. There is no need to call lsp_start first.",
  "Lines and columns are one-based. Instead of a column, pass `symbol` with the name to target on that line.",
  "Queries read saved files from disk. lsp_status shows running workspaces and indexing progress; results can be incomplete while indexing.",
].join(" ");

const documentOperations = {
  lsp_document_symbols: ["documentSymbolProvider", "textDocument/documentSymbol"],
  lsp_hover: ["hoverProvider", "textDocument/hover"],
  lsp_definition: ["definitionProvider", "textDocument/definition"],
  lsp_type_definition: ["typeDefinitionProvider", "textDocument/typeDefinition"],
  lsp_implementation: ["implementationProvider", "textDocument/implementation"],
  lsp_references: ["referencesProvider", "textDocument/references"],
};
const positionTools = new Set(["lsp_hover", "lsp_definition", "lsp_type_definition", "lsp_implementation", "lsp_references"]);
const featureTools = {
  ...Object.fromEntries(Object.entries(documentOperations).map(([name, [capability]]) => [name, capability])),
  lsp_workspace_symbols: "workspaceSymbolProvider",
};

// Workspaces by real root path. Map order doubles as least-recently-used order.
const workspaces = new Map();

function describe(workspace) {
  const summary = { workspace: workspace.root, state: "starting" };
  if (workspace.error || workspace.client?.alive === false) {
    return { ...summary, state: "failed", error: workspace.error ?? "The language server exited. The next query restarts it." };
  }
  const client = workspace.client;
  if (!client) return summary;
  summary.state = "ready";
  summary.openDocuments = workspace.documents.size;
  summary.tools = ["lsp_diagnostics", ...Object.entries(featureTools)
    .filter(([, capability]) => client.capabilities[capability])
    .map(([name]) => name)];
  const progress = indexing(client);
  if (progress) summary.indexing = progress;
  return summary;
}

function indexing(client) {
  const tasks = [...client.progress.values()].map(({ title, message, percentage }) =>
    [title, message, percentage === undefined ? undefined : percentage + "%"].filter(Boolean).join(": "));
  return tasks.length ? tasks : undefined;
}

function status() {
  return {
    server: profile.name,
    command: profile.command,
    state: workspaces.size ? "active" : "idle",
    autoStart,
    workspaces: [...workspaces.values()].reverse().map(describe),
  };
}

async function stopWorkspace(workspace) {
  if (workspaces.get(workspace.root) === workspace) workspaces.delete(workspace.root);
  const openUris = [...workspace.documents.keys()];
  workspace.documents.clear();
  if (!workspace.client) workspace.controller.abort();
  await workspace.startup;
  const client = workspace.client;
  try {
    if (client?.alive && canOpenDocuments(client)) {
      for (const uri of openUris) client.notify("textDocument/didClose", { textDocument: { uri } });
    }
  } finally {
    await client?.close();
  }
}

async function stopAll() {
  await Promise.all([...workspaces.values()].map(stopWorkspace));
}

function startupError(error) {
  const message = String(error?.message ?? error);
  return error?.code === "ENOENT" && profile.install ? message + " " + profile.install : message;
}

async function ensureWorkspace(root) {
  let workspace = workspaces.get(root);
  if (workspace && describe(workspace).state === "failed") {
    await stopWorkspace(workspace);
    workspace = undefined;
  }
  if (!workspace) {
    while (workspaces.size >= maxWorkspaces) await stopWorkspace(workspaces.values().next().value);
    if (closing) throw new Error("The LSP bridge is shutting down.");
    const controller = new AbortController();
    const candidate = { root, controller, documents: new Map() };
    candidate.startup = startLsp(profile, root, controller.signal).then(
      (client) => { candidate.client = client; },
      (error) => { candidate.error = startupError(error); },
    );
    workspace = candidate;
  }
  workspaces.delete(root);
  workspaces.set(root, workspace);
  return workspace;
}

async function readyClient(workspace, waitMs = startupWaitMs) {
  if (!workspace.client && !workspace.error) {
    let timer;
    try {
      await Promise.race([workspace.startup, new Promise((done) => { timer = setTimeout(done, waitMs); })]);
    } finally {
      clearTimeout(timer);
    }
  }
  const current = describe(workspace);
  if (current.state === "ready") return workspace.client;
  if (current.state === "starting") {
    throw new Error(profile.command + " is still initializing " + workspace.root + ". Retry in a moment; lsp_status shows its progress.");
  }
  throw new Error(current.error);
}

function requireCapability(client, capability, name) {
  if (!client.capabilities[capability]) {
    throw new Error(profile.command + " does not support " + name + " in this workspace (no " + capability + ").");
  }
}

function isContained(root, file) {
  const fromRoot = relative(root, file);
  return fromRoot !== ".." && !fromRoot.startsWith(".." + sep) && !isAbsolute(fromRoot);
}

function unsafeRoot(directory) {
  return directory === parse(directory).root || directory === home;
}

async function exists(path) {
  return Boolean(await stat(path).catch(() => null));
}

async function directory(path, label) {
  if (!isAbsolute(path)) throw new Error(label + " must be an absolute directory path.");
  const real = await realpath(path).catch((error) => {
    throw new Error(label + " " + path + (error.code === "ENOENT" ? " does not exist." : " cannot be opened (" + error.code + ")."));
  });
  if (!(await stat(real)).isDirectory()) throw new Error(label + " must be a directory.");
  return real;
}

async function explicitRoot(workspace) {
  const root = await directory(workspace, "workspace");
  if (unsafeRoot(root)) throw new Error("Refusing to use the home directory or a filesystem root as a workspace. Pass the project directory.");
  return root;
}

async function hasMarker(directory) {
  const markers = profile.rootMarkers ?? [];
  for (const marker of markers) {
    if (!marker.startsWith("*") && await exists(join(directory, marker))) return true;
  }
  const suffixes = markers.filter((marker) => marker.startsWith("*")).map((marker) => marker.slice(1));
  if (!suffixes.length) return false;
  const names = await readdir(directory).catch(() => []);
  return names.some((name) => suffixes.some((suffix) => name.endsWith(suffix)));
}

// Walk up from a directory to its Git root (never to the home directory or a
// filesystem root). Prefer the outermost directory with a project marker for
// this language, so monorepo roots win over nested packages, then the Git root.
async function inferRoot(start, fallback) {
  const chain = [];
  let gitRoot;
  for (let current = start; !unsafeRoot(current); current = dirname(current)) {
    chain.push(current);
    if (await exists(join(current, ".git"))) {
      gitRoot = current;
      break;
    }
  }
  let outermost;
  for (const candidate of chain) {
    if (await hasMarker(candidate)) outermost = candidate;
  }
  const root = outermost ?? gitRoot ?? fallback;
  if (!root) {
    throw new Error("Could not find a project root (Git repository or " + (profile.rootMarkers ?? []).join(", ") +
      ") above " + start + ". Pass `workspace` with the absolute project root.");
  }
  return root;
}

let clientCapabilities = {};
let rootsCache;

async function clientRoots() {
  if (!clientCapabilities.roots) return [];
  rootsCache ??= clientRequest("roots/list", {}, 2_000).then(
    (result) => (Array.isArray(result?.roots) ? result.roots : []).map((root) => filePath(root?.uri)).filter(Boolean),
    () => [],
  );
  return rootsCache;
}

// Directories the MCP client points at: MCP roots, then explicit environment
// variables, then the working directory unless it is this plugin's package.
async function projectBases() {
  const candidates = [...await clientRoots(), process.env.LSP_WORKSPACE, process.env.CLAUDE_PROJECT_DIR, process.cwd(), process.env.PWD];
  const bases = [];
  for (const candidate of candidates) {
    if (!candidate || !isAbsolute(candidate)) continue;
    const real = await realpath(candidate).catch(() => null);
    if (!real || unsafeRoot(real) || isContained(packageRoot, real) || bases.includes(real)) continue;
    if ((await stat(real)).isDirectory()) bases.push(real);
  }
  return bases;
}

function recentWorkspace() {
  return [...workspaces.keys()].at(-1);
}

function containingWorkspace(file) {
  let best;
  for (const root of workspaces.keys()) {
    if (isContained(root, file) && (!best || root.length > best.length)) best = root;
  }
  return best;
}

function languageFor(file) {
  const extension = extname(file) || basename(file);
  const languages = profile.extensionToLanguage;
  const mapping = Object.hasOwn(languages, extension) ? extension : extension.toLowerCase();
  if (!Object.hasOwn(languages, mapping)) {
    throw new Error(profile.name + " handles " + Object.keys(languages).join(", ") + " files, not " + extension + ".");
  }
  return languages[mapping];
}

async function realFile(candidate) {
  return realpath(candidate).catch((error) => {
    throw new Error(error.code === "ENOENT" ? "File not found: " + candidate : "Cannot open " + candidate + " (" + error.code + ").");
  });
}

// Resolve a file argument to { root, absolute } without starting anything.
async function locate(file, workspaceArgument) {
  if (workspaceArgument !== undefined) {
    const root = await explicitRoot(workspaceArgument);
    const candidate = resolve(root, file);
    if (!isContained(root, candidate)) throw new Error("The source file must be inside the workspace " + root + ".");
    const absolute = await realFile(candidate);
    if (!isContained(root, absolute)) throw new Error("The source file resolves outside the workspace " + root + ".");
    languageFor(absolute);
    return { root, absolute };
  }

  let base;
  let candidate;
  if (isAbsolute(file)) {
    candidate = resolve(file);
    base = containingWorkspace(candidate);
  } else {
    base = (await projectBases())[0] ?? recentWorkspace();
    if (!base) throw new Error("Relative path " + file + " needs a project directory. Pass an absolute path or `workspace`.");
    candidate = resolve(base, file);
    if (!isContained(base, candidate)) throw new Error("The source file must be inside " + base + ". Pass an absolute path.");
  }
  const absolute = await realFile(candidate);
  if (base && !isContained(base, absolute)) throw new Error("The source file resolves outside the workspace " + base + ".");
  languageFor(absolute);
  const active = containingWorkspace(absolute);
  if (active) return { root: active, absolute };
  if (!autoStart) throw new Error("Automatic start is disabled (LSP_BRIDGE_AUTO_START=0). Call lsp_start with the project root first.");
  return { root: await inferRoot(dirname(absolute), base), absolute };
}

async function queryWorkspace(workspaceArgument) {
  if (workspaceArgument !== undefined) return ensureWorkspace(await explicitRoot(workspaceArgument));
  const recent = recentWorkspace();
  if (recent) return ensureWorkspace(recent);
  const base = (await projectBases())[0];
  if (!base || !autoStart) {
    throw new Error("No workspace is running yet. Pass `workspace` with the absolute project root, or query a file first.");
  }
  return ensureWorkspace(await inferRoot(base, base));
}

function splitLines(text) {
  return text.split(/\r\n|\n|\r/);
}

function endPosition(text) {
  const lines = splitLines(text);
  return { line: lines.length - 1, character: lines.at(-1).length };
}

function openDocument(client, uri, languageId, version, text) {
  client.notify("textDocument/didOpen", { textDocument: { uri, languageId, version, text } });
}

function canOpenDocuments(client) {
  const sync = client.capabilities.textDocumentSync;
  return sync !== 0 && sync?.openClose !== false;
}

async function readSource(root, file) {
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
  const handle = await open(file, flags);
  try {
    const info = await handle.stat({ bigint: true });
    if (!info.isFile() || info.size > BigInt(maxFileBytes)) {
      throw new Error("Use a regular source file no larger than 2 MiB.");
    }
    const current = await realpath(file);
    if (!isContained(root, current)) throw new Error("The source file resolves outside the active workspace.");
    const currentInfo = await stat(current, { bigint: true });
    if (currentInfo.dev !== info.dev || currentInfo.ino !== info.ino) {
      throw new Error("The source file changed while opening. Retry the query.");
    }
    const bytes = Buffer.allocUnsafe(Number(info.size) + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset !== Number(info.size)) throw new Error("The source file changed while reading. Retry the query.");
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, offset));
  } finally {
    await handle.close();
  }
}

async function syncDocument(workspace, client, absolute) {
  const { documents, root } = workspace;
  const languageId = languageFor(absolute);
  const text = await readSource(root, absolute);
  const uri = pathToFileURL(absolute).href;
  const previous = documents.get(uri);
  const sync = client.capabilities.textDocumentSync;
  const canOpen = canOpenDocuments(client);
  const change = typeof sync === "number" ? sync : sync?.change;
  let version = previous?.version ?? 1;
  if (!previous && documents.size >= maxDocuments) {
    const oldest = documents.keys().next().value;
    if (canOpen) client.notify("textDocument/didClose", { textDocument: { uri: oldest } });
    client.diagnostics.delete(oldest);
    documents.delete(oldest);
  }
  if (!previous) {
    if (canOpen) openDocument(client, uri, languageId, version, text);
  } else if (previous.text !== text) {
    version += 1;
    client.diagnostics.delete(uri);
    if (change === 1 || change === 2) {
      const contentChanges = change === 1 ? [{ text }] : [
        { range: { start: { line: 0, character: 0 }, end: endPosition(previous.text) }, text },
      ];
      client.notify("textDocument/didChange", { textDocument: { uri, version }, contentChanges });
    } else if (canOpen) {
      client.notify("textDocument/didClose", { textDocument: { uri } });
      openDocument(client, uri, languageId, version, text);
    }
  }
  const document = { uri, path: absolute, version, text };
  documents.delete(uri);
  documents.set(uri, document);
  return document;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSymbol(text, symbol) {
  const word = new RegExp("(?<![\\p{L}\\p{N}_$])" + escapeRegExp(symbol) + "(?![\\p{L}\\p{N}_$])", "u").exec(text);
  return word ? word.index : text.indexOf(symbol);
}

function checkPositionArguments({ line, character, symbol }) {
  if (symbol === undefined && (line === undefined || character === undefined)) {
    throw new Error("Pass `line` with `character`, or pass `symbol` (optionally with `line`).");
  }
}

// Converts one-based arguments to a zero-based LSP position.
function resolvePosition(document, { line, character, symbol }) {
  const lines = splitLines(document.text);
  if (line !== undefined && line > lines.length) {
    throw new Error("Line " + line + " is past the end of the file (" + lines.length + " lines).");
  }
  if (line !== undefined && character !== undefined) {
    const length = lines[line - 1].length;
    if (character > length + 1) {
      throw new Error("Column " + character + " is past the end of line " + line + " (" + length + " UTF-16 code units).");
    }
    return { line: line - 1, character: character - 1 };
  }
  const indexes = line !== undefined ? [line - 1] : lines.keys();
  for (const index of indexes) {
    const column = findSymbol(lines[index], symbol);
    if (column >= 0) return { line: index, character: column };
  }
  throw new Error(line !== undefined
    ? JSON.stringify(symbol) + " does not occur on line " + line + ": " + JSON.stringify(lines[line - 1].trim().slice(0, 200))
    : JSON.stringify(symbol) + " does not occur in the file.");
}

function filePath(uri) {
  if (typeof uri !== "string" || !uri.startsWith("file:")) return undefined;
  try {
    return fileURLToPath(uri);
  } catch {
    return undefined;
  }
}

function displayPath(workspace, path) {
  return isContained(workspace.root, path) ? relative(workspace.root, path) || "." : path;
}

// Reads source lines for result previews, limited to files in the workspace.
function previewer(workspace) {
  const cache = new Map();
  for (const document of workspace.documents.values()) cache.set(document.path, splitLines(document.text));
  let reads = 0;
  return async (path, line) => {
    if (!isContained(workspace.root, path)) return undefined;
    if (!cache.has(path)) {
      if (reads >= maxPreviewFiles) return undefined;
      reads += 1;
      cache.set(path, await readSource(workspace.root, path).then(splitLines, () => null));
    }
    const text = cache.get(path)?.[line]?.trim();
    return text ? text.slice(0, 200) : undefined;
  };
}

async function place(workspace, uri, range, preview) {
  const path = filePath(uri);
  const entry = { file: path ? displayPath(workspace, path) : uri };
  const start = range?.start;
  if (Number.isInteger(start?.line)) {
    entry.line = start.line + 1;
    entry.character = (Number.isInteger(start.character) ? start.character : 0) + 1;
    const text = path && preview ? await preview(path, start.line) : undefined;
    if (text) entry.preview = text;
  }
  return entry;
}

async function locations(workspace, value) {
  const items = value == null ? [] : Array.isArray(value) ? value : [value];
  const preview = previewer(workspace);
  const result = [];
  for (const item of items) {
    const uri = item?.targetUri ?? item?.uri;
    if (typeof uri !== "string") continue;
    const range = item.targetSelectionRange ?? item.targetRange ?? item.range;
    result.push(await place(workspace, uri, range, result.length < maxPreviewItems ? preview : undefined));
  }
  return result;
}

function kindName(kind) {
  return symbolKinds[kind] ?? "Unknown";
}

function outline(items) {
  const result = [];
  const visit = (symbol, container) => {
    if (!symbol || typeof symbol.name !== "string") return;
    const selection = symbol.selectionRange ?? symbol.location?.range ?? symbol.range;
    const full = symbol.range ?? symbol.location?.range;
    const entry = { name: symbol.name, kind: kindName(symbol.kind) };
    const parent = container ?? symbol.containerName;
    if (parent) entry.container = parent;
    if (typeof symbol.detail === "string" && symbol.detail) entry.detail = symbol.detail.slice(0, 200);
    if (Number.isInteger(selection?.start?.line)) entry.line = selection.start.line + 1;
    if (Number.isInteger(full?.end?.line)) entry.endLine = full.end.line + 1;
    result.push(entry);
    for (const child of Array.isArray(symbol.children) ? symbol.children : []) {
      visit(child, container ? container + "." + symbol.name : symbol.name);
    }
  };
  for (const symbol of Array.isArray(items) ? items : []) visit(symbol);
  return result;
}

async function workspaceSymbols(workspace, items) {
  const preview = previewer(workspace);
  const result = [];
  for (const symbol of Array.isArray(items) ? items : []) {
    if (typeof symbol?.name !== "string" || typeof symbol.location?.uri !== "string") continue;
    const entry = { name: symbol.name, kind: kindName(symbol.kind) };
    if (symbol.containerName) entry.container = symbol.containerName;
    Object.assign(entry, await place(workspace, symbol.location.uri, symbol.location.range,
      result.length < maxPreviewItems ? preview : undefined));
    result.push(entry);
  }
  return result;
}

function hoverText(contents) {
  if (contents == null) return null;
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) return contents.map(hoverText).filter(Boolean).join("\n\n") || null;
  if (typeof contents.value !== "string") return null;
  return contents.language ? "```" + contents.language + "\n" + contents.value + "\n```" : contents.value;
}

function diagnosticEntries(items) {
  return items.map((item) => {
    const start = item?.range?.start ?? {};
    const end = item?.range?.end ?? start;
    const entry = {
      severity: severities[item?.severity] ?? "error",
      line: (start.line ?? 0) + 1,
      character: (start.character ?? 0) + 1,
      endLine: (end.line ?? 0) + 1,
      endCharacter: (end.character ?? 0) + 1,
      message: String(item?.message ?? ""),
    };
    if (item?.source) entry.source = item.source;
    if (item?.code !== undefined) entry.code = item.code;
    return entry;
  });
}

function counts(entries) {
  const totals = {};
  for (const { severity } of entries) totals[severity] = (totals[severity] ?? 0) + 1;
  return totals;
}

function pushedDiagnostics(client, document) {
  const report = client.diagnostics.get(document.uri);
  const ready = Array.isArray(report?.diagnostics) &&
    (report.version === undefined || report.version >= document.version);
  return ready ? report.diagnostics : null;
}

function waitForDiagnostics(client, document) {
  const current = pushedDiagnostics(client, document);
  if (current || diagnosticsWaitMs <= 0) return Promise.resolve(current);
  return new Promise((done) => {
    const finish = () => {
      clearTimeout(timer);
      unsubscribe();
      done(pushedDiagnostics(client, document));
    };
    const timer = setTimeout(finish, diagnosticsWaitMs);
    const unsubscribe = client.onDiagnostics((uri) => {
      if (uri === document.uri && pushedDiagnostics(client, document)) finish();
    });
  });
}

async function diagnostics(workspace, client, document) {
  const file = displayPath(workspace, document.path);
  let items;
  if (client.capabilities.diagnosticProvider) {
    const report = await client.request("textDocument/diagnostic", { textDocument: { uri: document.uri } });
    if (!Array.isArray(report?.items)) {
      throw new Error("The language server did not return a full diagnostic report. Retry after indexing.");
    }
    items = report.items;
  } else {
    items = await waitForDiagnostics(client, document);
  }
  if (!items) {
    return withIndexing(client, { file, state: "pending", result: null, note: "The server has not reported diagnostics for this file yet. Retry shortly." });
  }
  const result = diagnosticEntries(items);
  return { file, state: "ready", counts: counts(result), result };
}

function withIndexing(client, payload) {
  const progress = indexing(client);
  if (!progress) return payload;
  const note = "The server is still indexing (" + progress.join("; ") + "); results may be incomplete.";
  return { ...payload, note: payload.note ? payload.note + " " + note : note };
}

function hasResult(payload) {
  return Array.isArray(payload.result) ? payload.result.length > 0 : payload.result != null;
}

async function call(name, args) {
  if (name === "lsp_status") return status();
  if (name === "lsp_start") {
    const workspace = await ensureWorkspace(await explicitRoot(args.workspace));
    try {
      await readyClient(workspace, 4_000);
    } catch (error) {
      if (describe(workspace).state === "failed") throw error;
    }
    return describe(workspace);
  }
  if (name === "lsp_stop") {
    if (args.workspace === undefined) {
      await stopAll();
    } else {
      const root = await directory(args.workspace, "workspace");
      const workspace = workspaces.get(root);
      if (!workspace) throw new Error("No language server is running for " + root + ".");
      await stopWorkspace(workspace);
    }
    return status();
  }
  if (name === "lsp_workspace_symbols") {
    const workspace = await queryWorkspace(args.workspace);
    const client = await readyClient(workspace);
    requireCapability(client, "workspaceSymbolProvider", "workspace symbol search");
    const raw = await client.request("workspace/symbol", { query: args.query });
    const payload = { workspace: workspace.root, query: args.query, result: await workspaceSymbols(workspace, raw) };
    return hasResult(payload) ? payload : withIndexing(client, payload);
  }

  if (positionTools.has(name)) checkPositionArguments(args);
  const { root, absolute } = await locate(args.file, args.workspace);
  const workspace = await ensureWorkspace(root);
  const client = await readyClient(workspace);
  if (name === "lsp_diagnostics") return diagnostics(workspace, client, await syncDocument(workspace, client, absolute));

  const [capability, method] = documentOperations[name];
  requireCapability(client, capability, tools.find((entry) => entry.name === name).title.toLowerCase());
  const document = await syncDocument(workspace, client, absolute);
  const params = { textDocument: { uri: document.uri } };
  const payload = { file: displayPath(workspace, absolute) };
  if (name !== "lsp_document_symbols") {
    params.position = resolvePosition(document, args);
    payload.line = params.position.line + 1;
    payload.character = params.position.character + 1;
  }
  if (name === "lsp_references") params.context = { includeDeclaration: true };
  const raw = await client.request(method, params);
  if (name === "lsp_hover") {
    payload.result = hoverText(raw?.contents);
  } else if (name === "lsp_document_symbols") {
    payload.result = outline(raw);
  } else {
    payload.result = await locations(workspace, raw);
  }
  return hasResult(payload) ? payload : withIndexing(client, payload);
}

function validateArguments(schema, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Tool arguments must be an object.");
  for (const name of Object.keys(args)) {
    if (!Object.hasOwn(schema.properties, name)) throw new Error("Unexpected argument: " + name);
  }
  for (const [name, field] of Object.entries(schema.properties)) {
    const value = args[name];
    if (value === undefined) {
      if (schema.required.includes(name)) throw new Error("Missing argument: " + name);
      continue;
    }
    const valid = field.type === "string"
      ? typeof value === "string" && value.trim().length >= field.minLength
      : Number.isSafeInteger(value) && value >= field.minimum;
    if (!valid) {
      throw new Error("Invalid argument " + name + ": expected " +
        (field.type === "string" ? "a non-empty string." : "an integer of at least " + field.minimum + "."));
    }
  }
}

function toolResult(payload) {
  let text = JSON.stringify(payload);
  if (Buffer.byteLength(text) > maxResultBytes && Array.isArray(payload.result)) {
    const result = [];
    let size = 0;
    for (const item of payload.result) {
      size += Buffer.byteLength(JSON.stringify(item)) + 1;
      if (size > maxResultBytes / 2) break;
      result.push(item);
    }
    payload = { ...payload, result, truncated: true, total: payload.result.length };
    text = JSON.stringify(payload);
  }
  if (Buffer.byteLength(text) > maxResultBytes) throw new Error("The language server returned an oversized result. Use a narrower query.");
  return { content: [{ type: "text", text }], structuredContent: payload };
}

const supportedVersions = new Set(["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"]);
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
const outgoing = new Map();
let nextOutgoingId = 0;
let queue = Promise.resolve();
let closing = false;

function write(message) {
  if (!closing) process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
}

function respond(id, body) {
  write({ id, ...body });
}

function rpcError(id, code, message) {
  respond(id, { error: { code, message } });
}

function clientRequest(method, params, timeoutMs) {
  const id = "lsp-bridge-" + ++nextOutgoingId;
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      outgoing.delete(id);
      reject(new Error("The MCP client did not answer " + method + "."));
    }, timeoutMs);
    outgoing.set(id, { timer, resolve: resolvePromise, reject });
    write({ id, method, params });
  });
}

function settle({ id, result, error }) {
  const waiter = outgoing.get(id);
  if (!waiter) return;
  outgoing.delete(id);
  clearTimeout(waiter.timer);
  if (error) waiter.reject(new Error(String(error.message ?? "MCP client error")));
  else waiter.resolve(result);
}

async function handle({ id, method, params }) {
  switch (method) {
    case "initialize":
      clientCapabilities = params?.capabilities && typeof params.capabilities === "object" ? params.capabilities : {};
      return respond(id, { result: {
        protocolVersion: supportedVersions.has(params?.protocolVersion) ? params.protocolVersion : "2025-11-25",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: profile.name, title: profile.name + " language server", version: bridgeVersion },
        instructions,
      } });
    case "ping":
      return respond(id, { result: {} });
    case "tools/list":
      return respond(id, { result: { tools } });
    case "tools/call": {
      const descriptor = tools.find(({ name }) => name === params?.name);
      if (!descriptor) return rpcError(id, -32602, "Unknown tool: " + params?.name);
      try {
        const args = params.arguments ?? {};
        validateArguments(descriptor.inputSchema, args);
        respond(id, { result: toolResult(await call(descriptor.name, args)) });
      } catch (error) {
        respond(id, { result: { isError: true, content: [{ type: "text", text: String(error.message).slice(0, 2_000) }] } });
      }
      return;
    }
    default:
      return rpcError(id, -32601, "Method not found.");
  }
}

input.on("line", (line) => {
  if (closing) return;
  let message;
  try {
    if (line.length > 64 * 1024) throw new Error("MCP request exceeds the size limit.");
    message = JSON.parse(line);
  } catch {
    return rpcError(null, -32700, "Invalid JSON or oversized message.");
  }
  if (message?.jsonrpc === "2.0" && message.method === undefined && message.id !== undefined &&
      (Object.hasOwn(message, "result") || Object.hasOwn(message, "error"))) {
    return settle(message);
  }
  if (message?.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message?.id ?? null, -32600, "Invalid JSON-RPC request.");
  }
  if (message.id === undefined) {
    if (message.method === "notifications/roots/list_changed") rootsCache = undefined;
    return;
  }

  if (message.method !== "tools/call" || message.params?.name === "lsp_status") {
    void handle(message);
  } else {
    queue = queue.then(() => closing ? undefined : handle(message));
  }
});

function close() {
  if (closing) return;
  closing = true;
  input.close();
  for (const { timer, reject } of outgoing.values()) {
    clearTimeout(timer);
    reject(new Error("The LSP bridge is shutting down."));
  }
  outgoing.clear();
  void stopAll()
    .catch(() => { process.stderr.write("The LSP bridge could not close the native server cleanly.\n"); })
    .finally(() => process.stdin.pause());
}

input.on("close", close);
process.stdout.on("error", close);
process.on("SIGINT", close);
process.on("SIGTERM", close);

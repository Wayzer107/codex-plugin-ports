import { constants } from "node:fs";
import { open, readFile, realpath, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { startLsp } from "./lsp-client.mjs";

const profile = JSON.parse(await readFile(process.argv[2], "utf8"));
const maxFileBytes = 2 * 1024 * 1024;
const maxDocuments = 32;
const maxResultBytes = 96 * 1024;
const fileField = { type: "string", minLength: 1, description: "Path to a saved source file inside the active workspace, relative to its root or absolute." };
const lineField = { type: "integer", minimum: 0, description: "Zero-based source line." };
const characterField = { type: "integer", minimum: 0, description: "Zero-based UTF-16 code unit offset on the line." };
const workspaceField = { type: "string", minLength: 1, description: "Absolute path to the trusted project root containing the source and build configuration." };
const positionFields = { file: fileField, line: lineField, character: characterField };

function tool(name, description, properties = {}, readOnly = true) {
  return {
    name: "lsp_" + name,
    description,
    inputSchema: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
    annotations: { readOnlyHint: readOnly, destructiveHint: false, idempotentHint: true, openWorldHint: !readOnly },
  };
}

const tools = [
  tool("start", "Start " + profile.command + " in a trusted workspace. The language server may run project tooling while indexing. Poll lsp_status if initialization is still in progress.", { workspace: workspaceField }, false),
  tool("status", "Check the active workspace, initialization state, and advertised language-server capabilities."),
  tool("stop", "Stop the active language-server process and clear its workspace.", {}, false),
  tool("document_symbols", "List symbols in a saved source file.", { file: fileField }),
  tool("workspace_symbols", "Search the active workspace for named symbols. Use a specific query.", { query: { type: "string", minLength: 1 } }),
  tool("hover", "Read type or documentation information at a position in a saved source file.", positionFields),
  tool("definition", "Find the definition at a position in a saved source file.", positionFields),
  tool("references", "Find references to the symbol at a position in a saved source file, including its declaration.", positionFields),
  tool("diagnostics", "Read language-server diagnostics for a saved source file. Pending means the server has not reported a result yet.", { file: fileField }),
];

const documentOperations = {
  lsp_document_symbols: ["documentSymbolProvider", "textDocument/documentSymbol"],
  lsp_hover: ["hoverProvider", "textDocument/hover"],
  lsp_definition: ["definitionProvider", "textDocument/definition"],
  lsp_references: ["referencesProvider", "textDocument/references"],
};

let active;
const documents = new Map();

function status() {
  const server = { name: profile.name, command: profile.command, state: "idle" };
  if (!active) return server;
  server.workspace = active.root;
  if (active.error || active.client?.alive === false) {
    return { ...server, state: "failed", error: active.error ?? "The language server exited. Start the workspace again." };
  }
  if (!active.client) return { ...server, state: "starting" };
  return { ...server, state: "ready", capabilities: active.client.capabilities };
}

async function stopWorkspace() {
  const previous = active;
  active = undefined;
  if (!previous) return status();
  const openUris = [...documents.keys()];
  documents.clear();
  if (!previous.client) previous.controller.abort();
  await previous.startup;
  const client = previous.client;
  try {
    if (client?.alive && canOpenDocuments(client)) {
      for (const uri of openUris) {
        client.notify("textDocument/didClose", { textDocument: { uri } });
      }
    }
  } finally {
    await client?.close();
  }
  return status();
}

async function startWorkspace(workspace) {
  if (!isAbsolute(workspace)) throw new Error("workspace must be an absolute directory path.");
  const root = await realpath(workspace);
  if (!(await stat(root)).isDirectory()) throw new Error("workspace must be a directory.");
  if (active?.root !== root || status().state === "failed") {
    await stopWorkspace();
    if (closing) return status();
    const controller = new AbortController();
    const candidate = { root, controller };
    active = candidate;
    candidate.startup = startLsp(profile, root, controller.signal).then(
      (client) => { candidate.client = client; },
      (error) => { candidate.error = error.message; },
    );
  }
  let timer;
  try {
    await Promise.race([active.startup, new Promise((done) => { timer = setTimeout(done, 4_000); })]);
  } finally {
    clearTimeout(timer);
  }
  const current = status();
  if (current.state === "failed") throw new Error(current.error);
  return current;
}

function readyClient() {
  const current = status();
  if (current.state === "ready") return active.client;
  if (current.state === "starting") throw new Error("The language server is initializing. Poll lsp_status and retry.");
  throw new Error(current.error ?? "Call lsp_start with the absolute workspace path first.");
}

function requireCapability(client, capability) {
  if (!client.capabilities[capability]) {
    throw new Error(profile.command + " does not advertise " + capability + " for this workspace.");
  }
}

function isContained(root, file) {
  const fromRoot = relative(root, file);
  return fromRoot !== ".." && !fromRoot.startsWith(".." + sep) && !isAbsolute(fromRoot);
}

function endPosition(text) {
  const lines = text.split(/\r\n|\n|\r/);
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

async function syncDocument(client, file) {
  const candidate = resolve(active.root, file);
  if (!isContained(active.root, candidate)) throw new Error("The source file must be inside the active workspace.");
  const absolute = await realpath(candidate);
  if (!isContained(active.root, absolute)) throw new Error("The source file resolves outside the active workspace.");
  const extension = extname(absolute) || basename(absolute);
  const languages = profile.extensionToLanguage;
  const mapping = Object.hasOwn(languages, extension) ? extension : extension.toLowerCase();
  if (!Object.hasOwn(languages, mapping)) throw new Error("Unsupported source extension for " + profile.name + ": " + extension);
  const languageId = languages[mapping];
  const text = await readSource(active.root, absolute);
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
  const document = { uri, version, text };
  documents.delete(uri);
  documents.set(uri, document);
  return document;
}

function validatePosition(document, { line, character }) {
  const lines = document.text.split(/\r\n|\n|\r/);
  if (line >= lines.length || character > lines[line].length) {
    throw new Error("The requested position is outside the saved file.");
  }
  return { line, character };
}

async function diagnostics(client, document, file) {
  if (client.capabilities.diagnosticProvider) {
    const report = await client.request("textDocument/diagnostic", { textDocument: { uri: document.uri } });
    if (!Array.isArray(report?.items)) {
      throw new Error("The language server did not return a full diagnostic report. Retry after indexing.");
    }
    return { file, state: "ready", result: report.items };
  }
  const report = client.diagnostics.get(document.uri);
  const ready = Array.isArray(report?.diagnostics) &&
    (report.version === undefined || report.version >= document.version);
  return { file, state: ready ? "ready" : "pending", result: ready ? report.diagnostics : null };
}

async function call(name, args) {
  if (name === "lsp_start") return startWorkspace(args.workspace);
  if (name === "lsp_status") return status();
  if (name === "lsp_stop") return stopWorkspace();

  const client = readyClient();
  if (name === "lsp_workspace_symbols") {
    requireCapability(client, "workspaceSymbolProvider");
    return { result: await client.request("workspace/symbol", { query: args.query }) };
  }
  if (name === "lsp_diagnostics") return diagnostics(client, await syncDocument(client, args.file), args.file);

  const [capability, method] = documentOperations[name];
  requireCapability(client, capability);
  const document = await syncDocument(client, args.file);
  const params = { textDocument: { uri: document.uri } };
  if (name !== "lsp_document_symbols") params.position = validatePosition(document, args);
  if (name === "lsp_references") params.context = { includeDeclaration: true };
  return { file: args.file, result: await client.request(method, params) };
}

function validateArguments(schema, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Tool arguments must be an object.");
  for (const name of Object.keys(args)) {
    if (!Object.hasOwn(schema.properties, name)) throw new Error("Unexpected argument: " + name);
  }
  for (const [name, field] of Object.entries(schema.properties)) {
    const value = args[name];
    const valid = field.type === "string"
      ? typeof value === "string" && value.trim().length >= field.minLength
      : Number.isSafeInteger(value) && value >= field.minimum;
    if (!valid) throw new Error("Invalid or missing argument: " + name);
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
let queue = Promise.resolve();
let closing = false;

function respond(id, body) {
  if (!closing) process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, ...body }) + "\n");
}

function rpcError(id, code, message) {
  respond(id, { error: { code, message } });
}

async function handle({ id, method, params }) {
  switch (method) {
    case "initialize":
      return respond(id, { result: {
        protocolVersion: supportedVersions.has(params?.protocolVersion) ? params.protocolVersion : "2025-11-25",
        capabilities: { tools: {} },
        serverInfo: { name: profile.name, version: "0.1.0" },
      } });
    case "ping":
      return respond(id, { result: {} });
    case "tools/list":
      return respond(id, { result: { tools } });
    case "tools/call": {
      const descriptor = tools.find(({ name }) => name === params?.name);
      if (!descriptor) return rpcError(id, -32602, "Unknown tool.");
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
  let request;
  try {
    if (line.length > 64 * 1024) throw new Error("MCP request exceeds the size limit.");
    request = JSON.parse(line);
  } catch {
    return rpcError(null, -32700, "Invalid JSON or oversized message.");
  }
  if (request?.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return rpcError(request?.id ?? null, -32600, "Invalid JSON-RPC request.");
  }
  if (request.id === undefined) return;

  if (request.method !== "tools/call" || request.params?.name === "lsp_status") {
    void handle(request);
  } else {
    queue = queue.then(() => closing ? undefined : handle(request));
  }
});

function close() {
  if (closing) return;
  closing = true;
  input.close();
  void stopWorkspace()
    .catch(() => { process.stderr.write("The LSP bridge could not close the native server cleanly.\n"); })
    .finally(() => process.stdin.pause());
}

input.on("close", close);
process.stdout.on("error", close);
process.on("SIGINT", close);
process.on("SIGTERM", close);

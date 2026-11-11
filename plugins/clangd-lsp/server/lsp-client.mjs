import { execFile, spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { ensureClangdInstalled } from "./clangd-installer.mjs";

const onWindows = process.platform === "win32";
const execFileAsync = promisify(execFile);
const maxHeaderBytes = 8 * 1024;
const maxFrameBytes = 16 * 1024 * 1024;
const maxPendingRequests = 128;
const maxDiagnosticDocuments = 256;
const headerEnd = Buffer.from("\r\n\r\n");
const pathDirectories = (process.env.PATH ?? (onWindows ? "" : "/usr/bin:/bin"))
  .split(path.delimiter)
  .map((entry) => onWindows ? entry.replace(/^"(.*)"$/, "$1") : entry)
  .filter((entry) => path.isAbsolute(entry));

function spawnError(command, code, fallbackCommand) {
  const executable = fallbackCommand ? `"${command}" or "${fallbackCommand}"` : `"${command}"`;
  const message = code === "ENOENT"
    ? `LSP executable ${executable} not found. Install it and make it available on PATH.`
    : `Could not start LSP executable ${executable} (${code ?? "spawn failed"}).`;
  return Object.assign(new Error(message), { code });
}

async function windowsExecutable(command) {
  const isPath = path.isAbsolute(command) || /[\\/:]/.test(command);
  const bases = isPath ? [path.resolve(command)] : pathDirectories.map((entry) => path.join(entry, command));
  const suffix = path.extname(command).toLowerCase();
  const supportedExtensions = [".exe", ".com", ".cmd", ".bat"];
  const extensions = supportedExtensions.includes(suffix) ? [""] : (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter((extension) => supportedExtensions.includes(extension.toLowerCase()));

  for (const base of bases) {
    for (const extension of extensions) {
      const candidate = base + extension;
      if ((await stat(candidate).catch(() => null))?.isFile()) return candidate;
    }
  }
  throw spawnError(command, "ENOENT");
}

async function serverLaunch(profile) {
  const args = profile.args ?? [];
  if (!onWindows) return { command: profile.command, args, options: { detached: true } };

  const command = await windowsExecutable(profile.command);
  if (!/\.(cmd|bat)$/i.test(command)) return { command, args, options: {} };

  // cmd.exe receives only the resolved executable and fixed profile arguments.
  // Quoting protects spaces and metacharacters in the path. Reject characters
  // that can expand or escape quotes. Batch scripts can reparse their arguments.
  if (/["%!?^\x00-\x1f]/.test(command) ||
      args.some((arg) => /["%!?^&|<>()\x00-\x1f]/.test(arg))) {
    throw new Error("The LSP batch launcher path or fixed arguments contain unsupported shell characters.");
  }
  const commandLine = [command, ...args].map((arg) => `"${arg}"`).join(" ");
  return {
    command: path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe"),
    args: ["/d", "/s", "/v:off", "/c", `"${commandLine}"`],
    options: { windowsVerbatimArguments: true },
  };
}

function consumeFrames(onMessage) {
  let header = Buffer.alloc(0);
  let body;
  let received = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });

  return (chunk) => {
    while (chunk.length > 0) {
      if (!body) {
        const remaining = maxHeaderBytes + headerEnd.length - header.length;
        const combined = Buffer.concat([header, chunk.subarray(0, remaining)]);
        const end = combined.indexOf(headerEnd);
        if (end < 0) {
          if (combined.length >= maxHeaderBytes + headerEnd.length) throw new Error("LSP frame header is too large.");
          header = combined;
          return;
        }

        const fields = combined.subarray(0, end).toString("ascii").split("\r\n");
        const lengths = fields.filter((field) => /^Content-Length:/i.test(field));
        const rawLength = lengths[0]?.slice("Content-Length:".length).trim();
        const length = /^\d+$/.test(rawLength ?? "") ? Number(rawLength) : 0;
        if (lengths.length !== 1 || length < 1 || length > maxFrameBytes) {
          throw new Error("LSP frame has an invalid Content-Length.");
        }
        chunk = chunk.subarray(end + headerEnd.length - header.length);
        header = Buffer.alloc(0);
        body = Buffer.allocUnsafe(length);
      }

      const count = Math.min(chunk.length, body.length - received);
      chunk.copy(body, received, 0, count);
      chunk = chunk.subarray(count);
      received += count;
      if (received === body.length) {
        let message;
        try {
          message = JSON.parse(decoder.decode(body));
        } catch {
          throw new Error("LSP frame contains invalid UTF-8 or JSON.");
        }
        body = undefined;
        received = 0;
        if (!message || message.jsonrpc !== "2.0" || Array.isArray(message)) {
          throw new Error("LSP frame is not a JSON-RPC 2.0 message.");
        }
        onMessage(message);
      }
    }
  };
}

function sectionValue(settings, section) {
  if (typeof section !== "string" || !section) return settings;
  if (Object.hasOwn(settings, section)) return settings[section] ?? null;

  let value = settings;
  for (const key of section.split(".")) {
    if (value == null || typeof value !== "object" || !Object.hasOwn(value, key)) return null;
    value = value[key];
  }
  return value ?? null;
}

function clientReply(method, params, settings, folders) {
  switch (method) {
    case "workspace/configuration":
      return {
        result: Array.isArray(params?.items)
          ? params.items.map((item) => sectionValue(settings, item?.section))
          : [],
      };
    case "workspace/workspaceFolders":
      return { result: folders };
    case "client/registerCapability":
    case "client/unregisterCapability":
    case "window/workDoneProgress/create":
      return { result: null };
    case "workspace/applyEdit":
      return { result: { applied: false, failureReason: "The LSP bridge does not apply workspace edits." } };
    default:
      return { error: { code: -32601, message: "Method not found" } };
  }
}

export async function startLsp(profile, root, signal) {
  let missingError;
  try {
    return await startCandidate(profile, root, signal);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    missingError = error;
  }

  if (profile.fallbackCommand) {
    try {
      return await startCandidate({ ...profile, command: profile.fallbackCommand }, root, signal);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      missingError = error;
    }
  }

  if (profile.autoInstall === true) {
    signal?.throwIfAborted();
    const command = await ensureClangdInstalled(signal);
    signal?.throwIfAborted();
    return startCandidate({ ...profile, command }, root, signal);
  }

  if (profile.fallbackCommand) {
    throw spawnError(profile.command, "ENOENT", profile.fallbackCommand);
  }
  throw missingError;
}

async function startCandidate(profile, root, signal) {
  signal?.throwIfAborted();
  const launch = await serverLaunch(profile);
  signal?.throwIfAborted();

  const rootUri = pathToFileURL(root).href;
  const folders = [{ uri: rootUri, name: path.basename(root) || root }];
  const settings = profile.settings ?? {};
  const env = { ...process.env };
  if (onWindows) {
    for (const key of Object.keys(env)) {
      if (key.toUpperCase() === "PATH") delete env[key];
    }
    env.NoDefaultCurrentDirectoryInExePath = "1";
  }
  env.PATH = pathDirectories.join(path.delimiter);
  const diagnostics = new Map();
  const pending = new Map();
  let child;
  try {
    child = spawn(launch.command, launch.args, {
      ...launch.options,
      cwd: root,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    throw spawnError(profile.command, error.code);
  }

  let nextId = 0;
  let failure;
  let closing;
  let termination;
  let exited = false;
  let markExited;
  const exit = new Promise((resolve) => { markExited = resolve; });

  function rejectPending(error) {
    for (const { timer, reject } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  }

  function fail(error) {
    if (failure) return;
    failure = error;
    rejectPending(error);
  }

  function recordExit() {
    exited = true;
    markExited();
  }

  async function waitForExit(timeoutMs) {
    if (exited) return true;
    let timer;
    try {
      return await Promise.race([
        exit.then(() => true),
        new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  function terminate() {
    termination ??= (async () => {
      try {
        if (!child.pid) return;
        if (onWindows) {
          if (!exited) {
            const taskkill = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
            try {
              await execFileAsync(taskkill, ["/pid", String(child.pid), "/t", "/f"], {
                windowsHide: true,
                timeout: 2000,
              });
            } catch {
              child.kill("SIGKILL");
            }
          }
        } else {
          // A launcher can exit while other members of its process group remain.
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch (error) {
            if (error.code !== "ESRCH") throw error;
            if (!exited) child.kill("SIGKILL");
          }
        }
        if (!(await waitForExit(1000))) throw new Error("The LSP server process did not exit.");
      } finally {
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
      }
    })();
    return termination;
  }

  function send(message) {
    if (failure) throw failure;
    const body = JSON.stringify({ jsonrpc: "2.0", ...message });
    const bytes = Buffer.byteLength(body);
    if (bytes > maxFrameBytes) throw new Error("LSP message is too large.");
    const prefix = `Content-Length: ${bytes}\r\n\r\n`;
    if (child.stdin.writableLength + prefix.length + bytes > maxFrameBytes + maxHeaderBytes) {
      throw new Error("The LSP server is not reading requests quickly enough.");
    }
    child.stdin.write(prefix + body);
  }

  function request(method, params, timeoutMs = 15_000) {
    if (pending.size >= maxPendingRequests) return Promise.reject(new Error("Too many pending LSP requests."));
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`LSP request "${method}" timed out after ${timeoutMs} ms.`));
        try {
          send({ method: "$/cancelRequest", params: { id } });
        } catch {
          // The request has already timed out, even if cancellation cannot be sent.
        }
      }, timeoutMs);
      pending.set(id, { timer, resolve, reject, method });
      try {
        send({ id, method, params });
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }

  const receive = consumeFrames((message) => {
    if (typeof message.method === "string") {
      if (Object.hasOwn(message, "id")) {
        send({ id: message.id, ...clientReply(message.method, message.params, settings, folders) });
      } else if (message.method === "textDocument/publishDiagnostics" && typeof message.params?.uri === "string") {
        diagnostics.delete(message.params.uri);
        diagnostics.set(message.params.uri, message.params);
        if (diagnostics.size > maxDiagnosticDocuments) diagnostics.delete(diagnostics.keys().next().value);
      }
      return;
    }

    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    clearTimeout(waiter.timer);
    if (message.error) {
      const code = Number.isInteger(message.error.code) ? message.error.code : -32603;
      waiter.reject(Object.assign(new Error(`LSP request "${waiter.method}" failed (error ${code}).`), { code }));
    } else {
      waiter.resolve(message.result);
    }
  });

  child.on("error", (error) => {
    if (!child.pid) recordExit();
    fail(spawnError(profile.command, error.code));
  });
  child.once("exit", (code, signalName) => {
    recordExit();
    fail(new Error(`The LSP server exited (${signalName ?? `code ${code}`}).`));
    void terminate().catch(() => {});
  });

  function breakTransport(error) {
    fail(error);
    void terminate().catch(() => {});
  }

  child.stdin.on("error", () => breakTransport(new Error("The LSP server input pipe closed.")));
  child.stdout.on("error", () => breakTransport(new Error("The LSP server output pipe closed.")));
  child.stdout.on("end", () => {
    if (!closing && !failure) breakTransport(new Error("The LSP server output pipe closed."));
  });
  child.stdout.on("data", (chunk) => {
    if (failure) return;
    try {
      receive(chunk);
    } catch (error) {
      breakTransport(error);
    }
  });
  // Drain server logs without collecting private workspace data in MCP errors.
  child.stderr.resume();

  const abortStartup = () => fail(signal.reason instanceof Error ? signal.reason : new Error("LSP startup was aborted."));
  signal?.addEventListener("abort", abortStartup, { once: true });
  let capabilities;
  try {
    const result = await request("initialize", {
      processId: process.pid,
      rootPath: root,
      rootUri,
      workspaceFolders: folders,
      capabilities: {
        general: { positionEncodings: ["utf-16"] },
        textDocument: {
          synchronization: { dynamicRegistration: false },
          publishDiagnostics: { versionSupport: true },
          diagnostic: { dynamicRegistration: false, relatedDocumentSupport: false },
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
        },
        workspace: { applyEdit: false, configuration: true, workspaceFolders: true },
        window: { workDoneProgress: true },
      },
      initializationOptions: profile.initializationOptions,
    }, profile.startupTimeout ?? 20_000);
    signal?.throwIfAborted();

    capabilities = result?.capabilities;
    if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
      throw new Error("The LSP server returned invalid capabilities.");
    }
    const encoding = capabilities.positionEncoding;
    if (encoding !== undefined && encoding !== "utf-16") {
      throw new Error("The LSP server selected an unsupported position encoding. The bridge requires UTF-16.");
    }
    send({ method: "initialized", params: {} });
    if (profile.settings !== undefined) {
      send({ method: "workspace/didChangeConfiguration", params: { settings } });
    }
  } catch (error) {
    fail(error);
    await terminate();
    throw error;
  } finally {
    signal?.removeEventListener("abort", abortStartup);
  }

  return {
    capabilities,
    diagnostics,
    get alive() { return !failure && !closing && !exited; },
    request(method, params, timeoutMs) {
      if (closing) return Promise.reject(new Error("The LSP connection is closed."));
      return request(method, params, timeoutMs);
    },
    notify(method, params) {
      if (closing) throw new Error("The LSP connection is closed.");
      send({ method, params });
    },
    close() {
      closing ??= (async () => {
        const closed = new Error("The LSP connection is closed.");
        rejectPending(closed);
        if (!failure) {
          try {
            await request("shutdown", undefined, 1500);
            send({ method: "exit" });
            child.stdin.end();
            if (await waitForExit(1000)) return terminate();
          } catch {
            // Unresponsive servers are stopped below.
          }
        }
        fail(closed);
        await terminate();
      })();
      return closing;
    },
  };
}

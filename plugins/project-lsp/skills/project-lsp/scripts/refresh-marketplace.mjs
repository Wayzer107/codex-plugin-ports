import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";

export async function refreshMarketplace(root, marketplace, plugins) {
  const home = process.env.CODEX_HOME || join(homedir(), ".codex");
  const cached = async () => (await Promise.all(plugins.map((name) =>
    access(join(home, "plugins", "cache", marketplace, name, "0.1.0", "plugin.json"))
      .then(() => true, () => false),
  ))).every(Boolean);
  if (await cached()) return;

  const app = spawn("codex", ["app-server", "--stdio"], {
    cwd: root, stdio: ["pipe", "pipe", "ignore"], windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  let failure;
  app.on("error", (error) => { failure = error; });
  app.stdin.on("error", (error) => { failure ??= error; });
  const output = createInterface({ input: app.stdout });
  const replies = output[Symbol.asyncIterator]();
  const deadline = AbortSignal.timeout(25_000);
  deadline.addEventListener("abort", () => app.kill(), { once: true });
  let id = 0;

  async function request(method, params, notify = false) {
    const message = { method, params, ...(notify ? {} : { id: ++id }) };
    app.stdin.write(JSON.stringify(message) + "\n");
    if (notify) return;
    for (;;) {
      const line = await replies.next();
      if (line.done) throw failure ?? new Error("Codex app-server closed before the marketplace refresh finished.");
      const reply = JSON.parse(line.value);
      if (reply.id !== id) continue;
      if (reply.error) throw new Error(method + ": " + reply.error.message);
      return reply.result;
    }
  }

  try {
    await request("initialize", {
      clientInfo: { name: "project-lsp", version: "0.2.0" },
      capabilities: { experimentalApi: true },
    });
    await request("initialized", undefined, true);
    await request("plugin/list", { cwds: [root], marketplaceKinds: ["local"] });
    await request("plugin/installed", { cwds: [root] });
    await request("config/mcpServer/reload");
    while (!(await cached())) await delay(250, undefined, { signal: deadline });
  } catch (error) {
    if (deadline.aborted) throw new Error("Codex did not cache the project plugins within 25 seconds. Retry the refresh in the trusted project.");
    throw error;
  } finally {
    app.stdin.end();
    output.close();
    const stop = setTimeout(() => app.kill(), 2_000);
    stop.unref();
    app.once("close", () => clearTimeout(stop));
  }
}

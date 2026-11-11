import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const bridge = fileURLToPath(new URL('../src/bridge.mjs', import.meta.url));
const fakeServer = fileURLToPath(new URL('./fixtures/fake-lsp.mjs', import.meta.url));

// The bridge runs from src/, inside its own package, so its working directory
// never counts as a project. Project hints come only from what a test passes.
function bridgeEnvironment(extra) {
  const env = { ...process.env, ...extra };
  for (const name of ['PWD', 'LSP_WORKSPACE', 'CLAUDE_PROJECT_DIR', 'LSP_BRIDGE_AUTO_START']) {
    if (!(name in extra)) delete env[name];
  }
  return env;
}

function connect(profile, { env = {}, onRequest } = {}) {
  const child = spawn(process.execPath, [bridge, profile], {
    cwd: dirname(bridge),
    env: bridgeEnvironment(env),
    windowsHide: true,
  });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  let nextId = 1;
  let stderr = '';
  let failure;
  let closing;

  function fail(error) {
    failure = error;
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  }

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', fail);
  child.stdin.on('error', fail);
  const closed = new Promise(resolve => {
    child.once('close', (code, signal) => {
      fail(new Error('Bridge exited (' + (code ?? signal) + '): ' + stderr.trim()));
      resolve(code);
    });
  });

  function send(message) {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
  }

  lines.on('line', line => {
    try {
      const message = JSON.parse(line);
      if (typeof message.method === 'string') {
        const handler = onRequest ?? (() => ({ error: { code: -32601, message: 'Method not found' } }));
        send({ id: message.id, ...handler(message) });
        return;
      }
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    } catch (error) {
      fail(error);
    }
  });

  async function request(method, params) {
    if (failure) throw failure;
    const id = nextId++;
    let timer;
    try {
      return await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        timer = setTimeout(() => reject(new Error('Timed out waiting for ' + method + ': ' + stderr)), 5000);
        send({ id, method, params });
      });
    } finally {
      clearTimeout(timer);
      pending.delete(id);
    }
  }

  return {
    request,
    notify: send,
    tool(name, args = {}) {
      return request('tools/call', { name, arguments: args });
    },
    disconnectOutput() {
      child.stdout.destroy();
      send({ id: nextId++, method: 'ping' });
      return closed;
    },
    close() {
      closing ??= (async () => {
        child.stdin.end();
        const timer = setTimeout(() => child.kill(), 2000);
        try {
          return await closed;
        } finally {
          clearTimeout(timer);
          lines.close();
        }
      })();
      return closing;
    },
  };
}

async function fixture(t, { mode = 'pull', env = {}, capabilities = {}, onRequest, ...profileOverrides } = {}) {
  const temp = await realpath(tmpdir());
  const directory = await mkdtemp(join(temp, 'codex-lsp-test-'));
  const workspace = join(directory, 'workspace # test');
  const profile = join(directory, 'profile.json');
  const log = join(directory, 'events.ndjson');
  let client;
  t.after(async () => {
    await client?.close();
    assert.equal(dirname(await realpath(directory)), temp);
    await rm(directory, { recursive: true, force: true });
  });

  await mkdir(workspace);
  await writeFile(join(workspace, '.fake-root'), '');
  await writeFile(profile, JSON.stringify({
    name: 'fake-lsp',
    command: process.execPath,
    args: [fakeServer, log, mode],
    extensionToLanguage: { '.txt': 'plaintext' },
    rootMarkers: ['.fake-root'],
    install: 'Install the fake language server.',
    diagnosticsTimeout: 1000,
    ...profileOverrides,
  }));
  client = connect(profile, { env: typeof env === 'function' ? env(workspace) : env, onRequest });
  const initialized = await client.request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities,
    clientInfo: { name: 'bridge-test', version: '1.0.0' },
  });
  client.notify({ method: 'notifications/initialized' });
  return { client, initialized, directory, workspace, log };
}

function expectSuccess(result) {
  assert.equal(Boolean(result.isError), false, JSON.stringify(result));
  assert.ok(result.structuredContent);
  return result.structuredContent;
}

function expectError(result, pattern) {
  assert.equal(result.isError, true, JSON.stringify(result));
  if (pattern) assert.match(result.content[0].text, pattern);
  return result.content[0].text;
}

async function start(client, workspace) {
  expectSuccess(await client.tool('lsp_start', { workspace }));
  const status = await waitFor(
    () => client.tool('lsp_status').then(expectSuccess),
    value => value.workspaces.every(entry => entry.state !== 'starting'),
  );
  const entry = status.workspaces.find(item => item.workspace === workspace);
  assert.equal(entry?.state, 'ready', JSON.stringify(status));
  return entry;
}

async function waitFor(read, condition) {
  const deadline = Date.now() + 2000;
  let result = await read();
  while (!condition(result) && Date.now() < deadline) {
    await delay(20);
    result = await read();
  }
  return result;
}

async function readEvents(log) {
  const events = await readFile(log, 'utf8').catch(() => '');
  return events.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

async function stop(client, log) {
  expectSuccess(await client.tool('lsp_stop'));
  assert.equal(expectSuccess(await client.tool('lsp_status')).state, 'idle');
  return waitFor(() => readEvents(log), events => events.some(event => event.method === 'processExit'));
}

test('advertises its MCP tools and instructions without starting a native language server', async t => {
  const { client, initialized } = await fixture(t, { command: 'missing-lsp-discovery-fixture' });
  assert.equal(initialized.serverInfo.name, 'fake-lsp');
  assert.ok(initialized.capabilities.tools);
  assert.equal(initialized.protocolVersion, '2025-06-18');
  assert.match(initialized.instructions, /starts automatically/);
  const { tools } = await client.request('tools/list');
  assert.deepEqual(tools.map(tool => tool.name).sort(), [
    'lsp_definition',
    'lsp_diagnostics',
    'lsp_document_symbols',
    'lsp_hover',
    'lsp_implementation',
    'lsp_references',
    'lsp_start',
    'lsp_status',
    'lsp_stop',
    'lsp_type_definition',
    'lsp_workspace_symbols',
  ]);
  for (const tool of tools) {
    assert.ok(tool.title && tool.annotations.title, tool.name);
    assert.ok(tool.inputSchema.required.every(name => name in tool.inputSchema.properties), tool.name);
  }
  const status = expectSuccess(await client.tool('lsp_status'));
  assert.equal(status.state, 'idle');
  assert.deepEqual(status.workspaces, []);
});

test('starts the language server on the first query and infers the project root', async t => {
  const { client, workspace, log } = await fixture(t);
  const nested = join(workspace, 'src', 'deep');
  await mkdir(nested, { recursive: true });
  const filename = join(nested, 'module.txt');
  await writeFile(filename, 'header\n😀one');

  const hover = expectSuccess(await client.tool('lsp_hover', { file: filename, line: 2, symbol: 'one' }));
  assert.equal(hover.file, join('src', 'deep', 'module.txt'));
  assert.equal(hover.result, '1:2 😀');

  const status = expectSuccess(await client.tool('lsp_status'));
  assert.equal(status.workspaces.length, 1);
  assert.equal(status.workspaces[0].workspace, workspace);
  assert.equal(status.workspaces[0].state, 'ready');
  assert.ok(status.workspaces[0].tools.includes('lsp_hover'));

  const events = await stop(client, log);
  assert.equal(events[0].method, 'initialize');
  assert.equal(events[0].params.rootUri, pathToFileURL(workspace).href);
});

test('reports a missing executable with install instructions', async t => {
  const command = 'missing-native-lsp-executable-fixture';
  const { client, workspace } = await fixture(t, { command });
  await writeFile(join(workspace, 'source.txt'), 'text');
  const message = expectError(await client.tool('lsp_document_symbols', { file: join(workspace, 'source.txt') }));
  assert.ok(message.includes(command), message);
  assert.match(message, /Install the fake language server/);
  const status = expectSuccess(await client.tool('lsp_status'));
  assert.equal(status.workspaces[0].state, 'failed');
  expectError(await client.tool('lsp_start', { workspace }), /not found/);
});

test('uses one-based positions, symbol targeting and normalized locations', async t => {
  const { client, workspace, log } = await fixture(t);
  const file = 'sample # ä.txt';
  const filename = join(workspace, file);
  await writeFile(filename, 'header\n😀one');
  await start(client, workspace);

  const position = { file, line: 2, character: 3 };
  const hover = expectSuccess(await client.tool('lsp_hover', position));
  assert.deepEqual(hover, { file, line: 2, character: 3, result: '1:2 😀' });

  const location = { file, line: 2, character: 3, preview: '😀one' };
  const definition = expectSuccess(await client.tool('lsp_definition', { file: filename, line: 2, symbol: 'one' }));
  assert.deepEqual(definition.result, [location]);
  const typeDefinition = expectSuccess(await client.tool('lsp_type_definition', { file, symbol: 'one' }));
  assert.deepEqual(typeDefinition.result, [location]);
  const implementation = expectSuccess(await client.tool('lsp_implementation', position));
  assert.deepEqual(implementation.result, []);
  const references = expectSuccess(await client.tool('lsp_references', position));
  assert.deepEqual(references.result, [location]);
  const workspaceSymbols = expectSuccess(await client.tool('lsp_workspace_symbols', { query: 'One' }));
  assert.equal(workspaceSymbols.workspace, workspace);
  assert.deepEqual(workspaceSymbols.result, [{ name: 'One', kind: 'Variable', ...location }]);

  const events = await stop(client, log);
  for (const method of ['textDocument/hover', 'textDocument/definition', 'textDocument/typeDefinition', 'textDocument/references']) {
    assert.deepEqual(events.find(event => event.method === method)?.params.position, {
      line: 1, character: 2,
    });
  }
});

test('synchronizes edits on disk before querying the file outline', async t => {
  const { client, workspace } = await fixture(t, { mode: 'incremental' });
  const file = join(workspace, 'source.txt');
  await writeFile(file, 'header\n😀one');
  const first = expectSuccess(await client.tool('lsp_document_symbols', { file }));
  assert.deepEqual(first.result, [{ name: '😀one', kind: 'Variable', line: 2, endLine: 2 }]);

  await writeFile(file, 'header\n😀changed');
  const edited = expectSuccess(await client.tool('lsp_document_symbols', { file }));
  assert.equal(edited.result[0].name, '😀changed');
});

test('uses the workspace URI and gracefully closes documents and the native server', async t => {
  const { client, workspace, log } = await fixture(t);
  const file = 'source.txt';
  await writeFile(join(workspace, file), 'header\n😀one');
  await start(client, workspace);
  expectSuccess(await client.tool('lsp_document_symbols', { file }));

  const events = await stop(client, log);
  assert.deepEqual(events.map(event => event.method), [
    'initialize', 'initialized', 'textDocument/didOpen', 'textDocument/documentSymbol',
    'textDocument/didClose', 'shutdown', 'exit', 'processExit',
  ]);
  const rootUri = pathToFileURL(workspace).href;
  assert.equal(events[0].params.rootUri, rootUri);
  assert.equal(events[2].params.textDocument.uri, pathToFileURL(join(workspace, file)).href);
  assert.equal(events[4].params.textDocument.uri, events[2].params.textDocument.uri);
  assert.equal(events.at(-1).params.code, 0);
});

test('rejects files outside the workspace, including directory links', async t => {
  const { client, directory, workspace, log } = await fixture(t);
  const outside = join(directory, 'outside');
  const outsideFile = join(outside, 'private.txt');
  await mkdir(outside);
  await writeFile(outsideFile, 'Outside the workspace');
  await symlink(outside, join(workspace, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  await start(client, workspace);

  for (const file of ['../outside/private.txt', outsideFile, 'escape/private.txt', join(workspace, 'escape', 'private.txt')]) {
    expectError(await client.tool('lsp_document_symbols', { file }));
  }
  expectError(await client.tool('lsp_document_symbols', { file: 'escape/private.txt', workspace }), /outside/);

  const events = await stop(client, log);
  assert.ok(events.every(event => event.method !== 'textDocument/didOpen'));
  assert.equal(events.filter(event => event.method === 'initialize').length, 1);
});

test('refuses the home directory as a workspace', async t => {
  const { client } = await fixture(t);
  expectError(await client.tool('lsp_start', { workspace: (await import('node:os')).homedir() }), /home directory/);
  expectError(await client.tool('lsp_start', { workspace: 'relative/path' }), /absolute/);
});

test('rejects an extensionless file named like an inherited JavaScript property', async t => {
  const { client, workspace, log } = await fixture(t);
  await writeFile(join(workspace, 'constructor'), 'Not a mapped source file');
  await start(client, workspace);

  expectError(await client.tool('lsp_document_symbols', { file: 'constructor' }), /handles \.txt files/);
  const events = await stop(client, log);
  assert.ok(events.every(event => event.method !== 'textDocument/didOpen'));
});

test('rejects unsupported capabilities and invalid cursor positions', async t => {
  const { client, workspace, log } = await fixture(t, { mode: 'limited' });
  const file = 'source.txt';
  await writeFile(join(workspace, file), 'header\n😀one');
  await start(client, workspace);
  expectError(await client.tool('lsp_hover', { file, line: 2, character: 3 }), /does not support hover/);

  for (const position of [
    { line: 0, character: 1 },
    { line: 1, character: 0 },
    { line: 1, character: 1.5 },
    { line: 2, character: 7 },
    { line: 3, character: 1 },
    { line: 2 },
    { character: 2 },
  ]) {
    expectError(await client.tool('lsp_definition', { file, ...position }));
  }
  expectError(await client.tool('lsp_definition', { file, line: 1, symbol: 'one' }), /does not occur on line 1: "header"/);
  expectError(await client.tool('lsp_definition', { file, symbol: 'missing' }), /does not occur in the file/);
  // The end of a line is a valid position.
  expectSuccess(await client.tool('lsp_definition', { file, line: 2, character: 6 }));

  const events = await stop(client, log);
  assert.ok(events.every(event => event.method !== 'textDocument/hover'));
  assert.equal(events.filter(event => event.method === 'textDocument/definition').length, 1);
});

test('distinguishes unpublished diagnostics from a published empty list', async t => {
  const pending = await fixture(t, { mode: 'limited', diagnosticsTimeout: 100 });
  const pushed = await fixture(t, { mode: 'push' });
  const file = 'source.txt';
  await writeFile(join(pending.workspace, file), 'header\n😀one');
  await writeFile(join(pushed.workspace, file), 'header\n😀clean');
  await Promise.all([start(pending.client, pending.workspace), start(pushed.client, pushed.workspace)]);

  const unpublished = expectSuccess(await pending.client.tool('lsp_diagnostics', { file }));
  assert.equal(unpublished.state, 'pending');
  assert.equal(unpublished.result, null);

  const published = expectSuccess(await pushed.client.tool('lsp_diagnostics', { file }));
  assert.equal(published.state, 'ready');
  assert.deepEqual(published.result, []);
});

test('waits for diagnostics that the server publishes after a delay', async t => {
  const { client, workspace } = await fixture(t, { mode: 'push-delayed' });
  const file = join(workspace, 'source.txt');
  await writeFile(file, 'header\n😀one');
  const report = expectSuccess(await client.tool('lsp_diagnostics', { file }));
  assert.equal(report.state, 'ready');
  assert.deepEqual(report.counts, { warning: 1 });
  assert.deepEqual(report.result, [{
    severity: 'warning', line: 2, character: 3, endLine: 2, endCharacter: 6, message: 'Fixture warning', source: 'fake-lsp',
  }]);
});

test('returns current pull diagnostics after edits on disk', async t => {
  const { client, workspace } = await fixture(t);
  const file = 'source.txt';
  const filename = join(workspace, file);
  await writeFile(filename, 'header\n😀one');
  await start(client, workspace);
  const diagnostics = expectSuccess(await client.tool('lsp_diagnostics', { file }));
  assert.equal(diagnostics.state, 'ready');
  assert.equal(diagnostics.result.length, 1);
  assert.equal(diagnostics.result[0].message, 'Fixture warning');

  await writeFile(filename, 'header\n😀clean');
  const afterEdit = expectSuccess(await client.tool('lsp_diagnostics', { file }));
  assert.equal(afterEdit.state, 'ready');
  assert.deepEqual(afterEdit.result, []);
});

test('resolves relative paths against the project directory from the environment', async t => {
  const { client, workspace } = await fixture(t, { env: dir => ({ LSP_WORKSPACE: dir }) });
  await writeFile(join(workspace, 'source.txt'), 'header\n😀one');
  const symbols = expectSuccess(await client.tool('lsp_document_symbols', { file: 'source.txt' }));
  assert.equal(symbols.file, 'source.txt');
  const search = expectSuccess(await client.tool('lsp_workspace_symbols', { query: 'One' }));
  assert.equal(search.workspace, workspace);
});

test('resolves relative paths against MCP client roots', async t => {
  let rootsRequests = 0;
  let workspacePath;
  const { client, workspace } = await fixture(t, {
    capabilities: { roots: { listChanged: true } },
    onRequest: ({ method }) => {
      if (method !== 'roots/list') return { error: { code: -32601, message: 'Method not found' } };
      rootsRequests += 1;
      return { result: { roots: [{ uri: pathToFileURL(workspacePath).href, name: 'workspace' }] } };
    },
  });
  workspacePath = workspace;
  await writeFile(join(workspace, 'source.txt'), 'header\n😀one');
  expectSuccess(await client.tool('lsp_document_symbols', { file: 'source.txt' }));
  expectSuccess(await client.tool('lsp_document_symbols', { file: 'source.txt' }));
  assert.equal(rootsRequests, 1);
});

test('explains how to fix a relative path without a project directory', async t => {
  const { client } = await fixture(t);
  expectError(await client.tool('lsp_document_symbols', { file: 'source.txt' }), /absolute path or `workspace`/);
  expectError(await client.tool('lsp_workspace_symbols', { query: 'x' }), /No workspace is running/);
});

test('runs several workspaces and stops the least recently used one', async t => {
  const { client, directory, log } = await fixture(t);
  const roots = [];
  for (const name of ['a', 'b', 'c', 'd']) {
    const root = join(directory, 'project-' + name);
    await mkdir(root);
    await writeFile(join(root, '.fake-root'), '');
    await writeFile(join(root, 'source.txt'), 'header\n😀' + name);
    roots.push(root);
    const outline = expectSuccess(await client.tool('lsp_document_symbols', { file: join(root, 'source.txt') }));
    assert.equal(outline.result[0].name, '😀' + name);
  }
  const status = expectSuccess(await client.tool('lsp_status'));
  assert.deepEqual(status.workspaces.map(entry => entry.workspace), [roots[3], roots[2], roots[1]]);
  const events = await waitFor(() => readEvents(log), items => items.some(event => event.method === 'processExit'));
  assert.equal(events.filter(event => event.method === 'processExit').length, 1);

  expectSuccess(await client.tool('lsp_stop', { workspace: roots[2] }));
  const remaining = expectSuccess(await client.tool('lsp_status'));
  assert.deepEqual(remaining.workspaces.map(entry => entry.workspace), [roots[3], roots[1]]);
});

test('reports indexing progress and explains empty results while indexing', async t => {
  const { client, workspace } = await fixture(t, { mode: 'indexing' });
  await start(client, workspace);
  const status = await waitFor(
    () => client.tool('lsp_status').then(expectSuccess),
    value => value.workspaces[0].indexing,
  );
  assert.deepEqual(status.workspaces[0].indexing, ['Indexing: 3/10 files: 30%']);
  const search = expectSuccess(await client.tool('lsp_workspace_symbols', { query: 'none' }));
  assert.deepEqual(search.result, []);
  assert.match(search.note, /still indexing/);
});

test('can require an explicit start', async t => {
  const { client, workspace } = await fixture(t, { env: { LSP_BRIDGE_AUTO_START: '0' } });
  const file = join(workspace, 'source.txt');
  await writeFile(file, 'header\n😀one');
  expectError(await client.tool('lsp_document_symbols', { file }), /LSP_BRIDGE_AUTO_START=0/);
  await start(client, workspace);
  expectSuccess(await client.tool('lsp_document_symbols', { file }));
});

test('shuts down the native server when MCP stdin closes', async t => {
  const { client, workspace, log } = await fixture(t);
  await start(client, workspace);

  assert.equal(await client.close(), 0);
  const events = await readEvents(log);
  assert.deepEqual(events.map(event => event.method), [
    'initialize', 'initialized', 'shutdown', 'exit', 'processExit',
  ]);
  assert.equal(events.at(-1).params.code, 0);
});

test('shuts down the native server if the MCP client disconnects its read pipe', { timeout: 4000 }, async t => {
  const { client, workspace, log } = await fixture(t);
  await start(client, workspace);

  assert.equal(await client.disconnectOutput(), 0);
  const events = await readEvents(log);
  assert.deepEqual(events.slice(-3).map(event => event.method), ['shutdown', 'exit', 'processExit']);
  assert.equal(events.at(-1).params.code, 0);
});

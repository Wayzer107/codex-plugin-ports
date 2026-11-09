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

function connect(profile) {
  const child = spawn(process.execPath, [bridge, profile], { windowsHide: true });
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

  lines.on('line', line => {
    try {
      const message = JSON.parse(line);
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    } catch (error) {
      fail(error);
    }
  });

  function send(message) {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
  }

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

async function fixture(t, { mode = 'pull', ...profileOverrides } = {}) {
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
  await writeFile(profile, JSON.stringify({
    name: 'fake-lsp',
    command: process.execPath,
    args: [fakeServer, log, mode],
    extensionToLanguage: { '.txt': 'plaintext' },
    ...profileOverrides,
  }));
  client = connect(profile);
  const initialized = await client.request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'bridge-test', version: '1.0.0' },
  });
  client.notify({ method: 'notifications/initialized' });
  return { client, initialized, directory, workspace, log };
}

test('advertises its MCP tools without starting a native language server', async t => {
  const { client, initialized } = await fixture(t, { command: 'missing-lsp-discovery-fixture' });
  assert.equal(initialized.serverInfo.name, 'fake-lsp');
  assert.ok(initialized.capabilities.tools);
  assert.equal(initialized.protocolVersion, '2025-06-18');
  const { tools } = await client.request('tools/list');
  assert.deepEqual(tools.map(tool => tool.name).sort(), [
    'lsp_definition',
    'lsp_diagnostics',
    'lsp_document_symbols',
    'lsp_hover',
    'lsp_references',
    'lsp_start',
    'lsp_status',
    'lsp_stop',
    'lsp_workspace_symbols',
  ]);
  assert.equal((await client.tool('lsp_status')).structuredContent.state, 'idle');
});

async function start(client, workspace) {
  expectSuccess(await client.tool('lsp_start', { workspace }));
  const status = await waitFor(
    () => client.tool('lsp_status').then(expectSuccess),
    value => value.state !== 'starting',
  );
  assert.equal(status.state, 'ready', status.error);
  return status;
}

function expectSuccess(result) {
  assert.equal(Boolean(result.isError), false, JSON.stringify(result));
  assert.ok(result.structuredContent);
  return result.structuredContent;
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
  const events = await readFile(log, 'utf8');
  return events.trim().split('\n').map(line => JSON.parse(line));
}

async function stop(client, log) {
  expectSuccess(await client.tool('lsp_stop'));
  assert.equal(expectSuccess(await client.tool('lsp_status')).state, 'idle');
  return waitFor(() => readEvents(log), events => events.some(event => event.method === 'processExit'));
}

test('reports the missing executable and how to correct it', async t => {
  const command = 'missing-native-lsp-executable-fixture';
  const { client, workspace } = await fixture(t, { command });
  const startup = await client.tool('lsp_start', { workspace });
  const status = await waitFor(
    () => client.tool('lsp_status').then(expectSuccess),
    value => value.state === 'failed',
  );
  assert.equal(status.state, 'failed');
  const message = [status.error, ...startup.content.map(item => item.text)].join(' ');
  assert.ok(message.includes(command), message);
  assert.match(message, /install|\bPATH\b|configure/i);
});

test('preserves split UTF-8 replies and passes zero-based UTF-16 positions', async t => {
  const { client, workspace, log } = await fixture(t);
  const file = 'sample # ä.txt';
  const filename = join(workspace, file);
  await writeFile(filename, 'header\n😀one');
  await start(client, workspace);

  const position = { file, line: 1, character: 2 };
  const hover = expectSuccess(await client.tool('lsp_hover', position));
  assert.deepEqual(hover.result, { contents: { kind: 'plaintext', value: '1:2 😀' } });

  const uri = pathToFileURL(filename).href;
  const range = { start: { line: 1, character: 2 }, end: { line: 1, character: 5 } };
  const location = { uri, range };
  const definition = expectSuccess(await client.tool('lsp_definition', { ...position, file: filename }));
  assert.deepEqual(definition.result, location);
  const references = expectSuccess(await client.tool('lsp_references', position));
  assert.deepEqual(references.result, [location]);
  const workspaceSymbols = expectSuccess(await client.tool('lsp_workspace_symbols', { query: 'One' }));
  assert.deepEqual(workspaceSymbols.result, [{ name: 'One', kind: 13, location }]);

  const events = await stop(client, log);
  for (const method of ['textDocument/hover', 'textDocument/definition', 'textDocument/references']) {
    assert.deepEqual(events.find(event => event.method === method)?.params.position, {
      line: 1, character: 2,
    });
  }
});

test('synchronizes edits on disk before querying document symbols', async t => {
  const { client, workspace } = await fixture(t, { mode: 'incremental' });
  const file = 'source.txt';
  const filename = join(workspace, file);
  await writeFile(filename, 'header\n😀one');
  await start(client, workspace);
  const first = expectSuccess(await client.tool('lsp_document_symbols', { file }));
  assert.equal(first.result[0].name, '😀one');

  await writeFile(filename, 'header\n😀changed');
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

  for (const file of ['../outside/private.txt', outsideFile, 'escape/private.txt']) {
    const result = await client.tool('lsp_document_symbols', { file });
    assert.equal(result.isError, true, file);
  }

  const events = await stop(client, log);
  assert.ok(events.every(event => event.method !== 'textDocument/didOpen'));
});

test('rejects an extensionless file named like an inherited JavaScript property', async t => {
  const { client, workspace, log } = await fixture(t);
  await writeFile(join(workspace, 'constructor'), 'Not a mapped source file');
  await start(client, workspace);

  const result = await client.tool('lsp_document_symbols', { file: 'constructor' });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /unsupported source extension/i);
  const events = await stop(client, log);
  assert.ok(events.every(event => event.method !== 'textDocument/didOpen'));
});

test('rejects unsupported capabilities and invalid cursor positions', async t => {
  const { client, workspace, log } = await fixture(t, { mode: 'limited' });
  const file = 'source.txt';
  await writeFile(join(workspace, file), 'header\n😀one');
  await start(client, workspace);
  const unsupported = await client.tool('lsp_hover', { file, line: 1, character: 2 });
  assert.equal(unsupported.isError, true);

  for (const position of [
    { line: -1, character: 0 },
    { line: 0, character: -1 },
    { line: 0, character: 1.5 },
    { line: 1, character: 6 },
  ]) {
    const invalid = await client.tool('lsp_definition', { file, ...position });
    assert.equal(invalid.isError, true, JSON.stringify(position));
  }

  const events = await stop(client, log);
  assert.ok(events.every(event => !['textDocument/hover', 'textDocument/definition'].includes(event.method)));
});

test('distinguishes unpublished diagnostics from a published empty list', async t => {
  const pending = await fixture(t, { mode: 'limited' });
  const pushed = await fixture(t, { mode: 'push' });
  const file = 'source.txt';
  await writeFile(join(pending.workspace, file), 'header\n😀one');
  await writeFile(join(pushed.workspace, file), 'header\n😀clean');
  await Promise.all([start(pending.client, pending.workspace), start(pushed.client, pushed.workspace)]);

  const unpublished = expectSuccess(await pending.client.tool('lsp_diagnostics', { file }));
  assert.equal(unpublished.state, 'pending');
  assert.equal(unpublished.result, null);

  const published = await waitFor(
    () => pushed.client.tool('lsp_diagnostics', { file }).then(expectSuccess),
    value => value.state === 'ready',
  );
  assert.equal(published.state, 'ready');
  assert.deepEqual(published.result, []);
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

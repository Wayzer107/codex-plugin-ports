import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const [, , log, mode = 'pull'] = process.argv;
const documents = new Map();
const range = { start: { line: 1, character: 2 }, end: { line: 1, character: 5 } };
const diagnostic = { range, severity: 2, source: 'fake-lsp', message: 'Fixture warning' };
let initialized = false;
let shuttingDown = false;
let buffer = Buffer.alloc(0);
let output = Promise.resolve();

function frame(message) {
  const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...message }));
  return Buffer.concat([Buffer.from('Content-Length: ' + body.length + '\r\n\r\n'), body]);
}

function reply(id, result, { split = false } = {}) {
  const response = frame({ id, result });
  output = output.then(async () => {
    if (split) {
      const marker = response.indexOf(Buffer.from('😀'));
      assert.ok(marker > 9, 'The split response must contain a multibyte character');
      const notification = frame({ method: 'window/logMessage', params: { type: 3, message: 'fixture' } });
      process.stdout.write(response.subarray(0, 9));
      await delay(12);
      process.stdout.write(response.subarray(9, marker + 2));
      await delay(12);
      process.stdout.write(Buffer.concat([response.subarray(marker + 2), notification]));
    } else {
      process.stdout.write(response);
    }
  });
}

function publish(uri, version, text) {
  if (mode !== 'push') return;
  const diagnostics = text.includes('clean') ? [] : [diagnostic];
  output = output.then(() => process.stdout.write(frame({
    method: 'textDocument/publishDiagnostics',
    params: { uri, version, diagnostics },
  })));
}

function handle({ method, id, params }) {
  appendFileSync(log, JSON.stringify({ method, params }) + '\n');
  if (method === 'initialize') {
    assert.equal(initialized, false);
    const capabilities = {
      textDocumentSync: { openClose: true, change: mode === 'incremental' ? 2 : 1 },
      hoverProvider: mode !== 'limited',
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
    };
    if (mode === 'pull') {
      capabilities.diagnosticProvider = { interFileDependencies: false, workspaceDiagnostics: false };
    }
    reply(id, { capabilities, serverInfo: { name: 'fake native 😀' } }, { split: true });
    return;
  }
  if (method === 'initialized') {
    initialized = true;
    return;
  }
  assert.equal(initialized, true, 'LSP request arrived before initialized');

  switch (method) {
    case 'textDocument/didOpen': {
      const { uri, text, version, languageId } = params.textDocument;
      assert.equal(languageId, 'plaintext');
      assert.ok(!documents.has(uri));
      documents.set(uri, { text, version });
      publish(uri, version, text);
      break;
    }
    case 'textDocument/didChange': {
      const { uri, version } = params.textDocument;
      const previous = documents.get(uri);
      assert.ok(previous);
      assert.ok(version > previous.version);
      const [change] = params.contentChanges;
      assert.equal(params.contentChanges.length, 1);
      if (mode === 'incremental') {
        const lines = previous.text.split('\n');
        assert.deepEqual(change.range, {
          start: { line: 0, character: 0 },
          end: { line: lines.length - 1, character: lines.at(-1).length },
        });
      } else {
        assert.equal(change.range, undefined);
      }
      documents.set(uri, { text: change.text, version });
      publish(uri, version, change.text);
      break;
    }
    case 'textDocument/didClose':
      assert.ok(documents.delete(params.textDocument.uri));
      break;
    case 'textDocument/documentSymbol': {
      const { text } = documents.get(params.textDocument.uri);
      reply(id, [{ name: text.split('\n').at(-1), kind: 13, range, selectionRange: range }]);
      break;
    }
    case 'textDocument/hover': {
      assert.notEqual(mode, 'limited');
      assert.ok(documents.has(params.textDocument.uri));
      const { line, character } = params.position;
      reply(id, { contents: { kind: 'plaintext', value: line + ':' + character + ' 😀' } }, { split: true });
      break;
    }
    case 'textDocument/definition':
      assert.ok(documents.has(params.textDocument.uri));
      reply(id, { uri: params.textDocument.uri, range });
      break;
    case 'textDocument/references':
      assert.ok(documents.has(params.textDocument.uri));
      reply(id, [{ uri: params.textDocument.uri, range }]);
      break;
    case 'workspace/symbol':
      reply(id, [...documents.keys()].map(uri => ({
        name: params.query,
        kind: 13,
        location: { uri, range },
      })));
      break;
    case 'textDocument/diagnostic': {
      assert.equal(mode, 'pull');
      const { text } = documents.get(params.textDocument.uri);
      reply(id, { kind: 'full', items: text.includes('clean') ? [] : [diagnostic] });
      break;
    }
    case 'shutdown':
      shuttingDown = true;
      reply(id, null);
      break;
    case 'exit':
      process.exit(shuttingDown ? 0 : 1);
      break;
    default:
      assert.fail('Unexpected method ' + method);
  }
}

process.stdin.on('data', chunk => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;
    const header = buffer.subarray(0, headerEnd).toString('ascii');
    const match = /^Content-Length:\s*(\d+)\s*$/im.exec(header);
    assert.ok(match, 'Missing Content-Length');
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + Number(match[1]);
    if (buffer.length < bodyEnd) return;
    const message = JSON.parse(buffer.subarray(bodyStart, bodyEnd).toString('utf8'));
    buffer = buffer.subarray(bodyEnd);
    handle(message);
  }
});

process.on('exit', code => {
  appendFileSync(log, JSON.stringify({ method: 'processExit', params: { code } }) + '\n');
});

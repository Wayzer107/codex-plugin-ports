import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const helper = fileURLToPath(new URL(
  '../plugins/openai-docs/skills/openai-docs/scripts/resolve-latest-model-info.js',
  import.meta.url,
));

test('resolves model metadata through a configured HTTP proxy', async t => {
  const source = 'http://model-docs.test/latest-model.md';
  const proxy = createServer((request, response) => {
    if (request.url !== source) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/markdown' }).end(
      'latestModelInfo:\n  model: example-model\n  migrationGuide: /migration\n  promptingGuide: /prompting\n',
    );
  });
  proxy.listen(0, '127.0.0.1');
  t.after(() => proxy.close());
  await once(proxy, 'listening');

  const proxyURL = `http://127.0.0.1:${proxy.address().port}`;
  const { stdout } = await execFileAsync(process.execPath, [helper, '--source', source], {
    env: {
      ...process.env,
      HTTP_PROXY: proxyURL,
      http_proxy: proxyURL,
      NO_PROXY: '',
      no_proxy: '',
      NODE_USE_ENV_PROXY: '0',
    },
  });

  assert.deepEqual(JSON.parse(stdout), {
    model: 'example-model',
    modelSlug: 'example-model',
    migrationGuideUrl: 'https://developers.openai.com/migration',
    promptingGuideUrl: 'https://developers.openai.com/prompting',
  });
});

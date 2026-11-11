import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('../claude-ports/project-lsp/skills/project-lsp/scripts/project-lsp.mjs', import.meta.url));
const mp = 'claude-plugins-official';
const id = name => `${name}@${mp}`;

const catalog = {
  plugins: [
    { name: 'gopls-lsp', lspServers: { gopls: { command: 'gopls', extensionToLanguage: { '.go': 'go' } } } },
    { name: 'pyright-lsp', lspServers: { pyright: { command: 'pyright-langserver', extensionToLanguage: { '.py': 'python' } } } },
    { name: 'ruby-lsp', lspServers: { ruby: { command: 'ruby-lsp', extensionToLanguage: { '.rb': 'ruby' } } } },
    { name: 'liquid-lsp', lspServers: { liquid: { command: 'liquid', extensionToLanguage: { '.liquid': 'liquid' } } } },
    { name: 'not-an-lsp', description: 'ignored' },
  ],
};

async function temp(t, prefix) {
  const path = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

async function setup(t, { withCatalog = true } = {}) {
  const home = await temp(t, 'project-lsp-home-');
  if (withCatalog) {
    const dir = join(home, '.claude', 'plugins', 'marketplaces', mp, '.claude-plugin');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'marketplace.json'), JSON.stringify(catalog));
  }
  const project = await temp(t, 'project-lsp-repo-');
  assert.equal(spawnSync('git', ['init', '-q', project]).status, 0);
  return { home, project };
}

function run(home, args, extraEnv = {}) {
  const result = spawnSync(process.execPath, [checker, ...args], {
    env: { ...process.env, HOME: home, ...extraEnv }, encoding: 'utf8', timeout: 15_000,
  });
  return { ...result, json: result.stdout.trim() ? JSON.parse(result.stdout) : null };
}

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

test('enables detected languages from a nested directory and skips vendor and ignored paths', async t => {
  const { home, project } = await setup(t);
  await mkdir(join(project, 'src', 'deep'), { recursive: true });
  await writeFile(join(project, 'src', 'deep', 'main.go'), 'package main\n');
  await mkdir(join(project, 'vendor'));
  await writeFile(join(project, 'vendor', 'lib.rb'), '');
  await writeFile(join(project, '.gitignore'), 'ignored.py\n');
  await writeFile(join(project, 'ignored.py'), '');

  const result = run(home, ['--cwd', join(project, 'src', 'deep')]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.extensions, 'catalog');
  assert.deepEqual(result.json.detected, ['gopls-lsp']);
  assert.deepEqual(result.json.added, [id('gopls-lsp')]);
  const settings = await readJson(join(project, '.claude', 'settings.json'));
  assert.deepEqual(settings.enabledPlugins, { [id('gopls-lsp')]: true });
  assert.equal(settings.extraKnownMarketplaces[mp].source.repo, 'anthropics/claude-plugins-official');
  assert.deepEqual((await readJson(join(project, '.claude', 'project-lsp.json'))).managed, [id('gopls-lsp')]);
});

test('check mode reports the plan, honours file hints and writes nothing', async t => {
  const { home, project } = await setup(t);
  const result = run(home, ['--cwd', project, '--check', '--file', 'new/app.py']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.detected, ['pyright-lsp']);
  assert.equal(result.json.check, true);
  assert.equal(spawnSync('test', ['-e', join(project, '.claude')]).status, 1, '.claude must not be created');
});

test('preserves hand-set entries and other settings, and repeat runs change nothing', async t => {
  const { home, project } = await setup(t);
  await writeFile(join(project, 'a.go'), '');
  await writeFile(join(project, 'b.py'), '');
  await mkdir(join(project, '.claude'));
  const original = { model: 'sonnet', enabledPlugins: { [id('pyright-lsp')]: false, 'other@x': true } };
  await writeFile(join(project, '.claude', 'settings.json'), JSON.stringify(original, null, 4));

  const first = run(home, ['--cwd', project]);
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(first.json.skipped, [id('pyright-lsp')]);
  assert.deepEqual(first.json.added, [id('gopls-lsp')]);
  const settings = await readJson(join(project, '.claude', 'settings.json'));
  assert.equal(settings.model, 'sonnet');
  assert.equal(settings.enabledPlugins[id('pyright-lsp')], false);
  assert.equal(settings.enabledPlugins['other@x'], true);

  const before = await readFile(join(project, '.claude', 'settings.json'), 'utf8');
  const second = run(home, ['--cwd', project]);
  assert.equal(second.json.changed, false);
  assert.equal(await readFile(join(project, '.claude', 'settings.json'), 'utf8'), before);
});

test('removes only managed entries when their language disappears', async t => {
  const { home, project } = await setup(t);
  await writeFile(join(project, 'a.go'), '');
  await writeFile(join(project, 'theme.liquid'), '');
  assert.equal(run(home, ['--cwd', project]).status, 0);

  await rm(join(project, 'theme.liquid'));
  const result = run(home, ['--cwd', project]);
  assert.deepEqual(result.json.removed, [id('liquid-lsp')]);
  const settings = await readJson(join(project, '.claude', 'settings.json'));
  assert.deepEqual(settings.enabledPlugins, { [id('gopls-lsp')]: true });
  assert.deepEqual((await readJson(join(project, '.claude', 'project-lsp.json'))).managed, [id('gopls-lsp')]);
});

test('hook mode is silent when unchanged and reports changes as SessionStart output', async t => {
  const { home, project } = await setup(t);
  await writeFile(join(project, 'a.rb'), '');
  const first = run(home, ['--hook'], { CLAUDE_PROJECT_DIR: project });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.json.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(first.json.hookSpecificOutput.additionalContext, /ruby-lsp/);
  const second = run(home, ['--hook'], { CLAUDE_PROJECT_DIR: project });
  assert.equal(second.stdout, '');
});

test('falls back to the bundled extension map without an installed catalog', async t => {
  const { home, project } = await setup(t, { withCatalog: false });
  await writeFile(join(project, 'main.ts'), '');
  const result = run(home, ['--cwd', project, '--check']);
  assert.equal(result.json.extensions, 'bundled');
  assert.deepEqual(result.json.detected, ['typescript-lsp']);
});

test('rejects a directory outside a Git project, but the hook stays silent there', async t => {
  const home = await temp(t, 'project-lsp-home-');
  const outside = await temp(t, 'project-lsp-outside-');
  const cli = run(home, ['--cwd', outside]);
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /not inside a Git project/);
  const hook = run(home, ['--hook', '--cwd', outside]);
  assert.equal(hook.status, 0);
  assert.equal(hook.stdout, '');
});

test('rejects a symlinked .claude directory without writing through it', async t => {
  const { home, project } = await setup(t);
  await writeFile(join(project, 'a.go'), '');
  const elsewhere = await temp(t, 'project-lsp-elsewhere-');
  await symlink(elsewhere, join(project, '.claude'));
  const result = run(home, ['--cwd', project]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ordinary project directory/);
  assert.equal(spawnSync('test', ['-e', join(elsewhere, 'settings.json')]).status, 1);
});

test('rejects a file hint outside the project', async t => {
  const { home, project } = await setup(t);
  const result = run(home, ['--cwd', project, '--check', '--file', '../outside.go']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /outside the project/);
});

test('does not create .claude when no language matches', async t => {
  const { home, project } = await setup(t);
  await writeFile(join(project, 'notes.txt'), '');
  const result = run(home, ['--cwd', project]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.detected, []);
  assert.equal(result.json.changed, false);
  assert.equal(spawnSync('test', ['-e', join(project, '.claude')]).status, 1, '.claude must not be created');
});

test('rejects a malformed enabledPlugins value without writing', async t => {
  const { home, project } = await setup(t);
  await writeFile(join(project, 'a.go'), '');
  await mkdir(join(project, '.claude'));
  const text = JSON.stringify({ enabledPlugins: ['gopls-lsp'] });
  await writeFile(join(project, '.claude', 'settings.json'), text);
  const result = run(home, ['--cwd', project]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /enabledPlugins .* must be a JSON object/);
  assert.equal(await readFile(join(project, '.claude', 'settings.json'), 'utf8'), text);
});

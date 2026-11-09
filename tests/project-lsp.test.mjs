import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('../plugins/project-lsp/skills/project-lsp/scripts/project-lsp.mjs', import.meta.url));
const catalogPath = '.agents/plugins/marketplace.json';
const configPath = '.codex/config.toml';

async function put(root, path, content) {
  const file = join(root, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function project(t, { git = true } = {}) {
  const temp = await realpath(tmpdir());
  const directory = await mkdtemp(join(temp, 'project-lsp-test-'));
  t.after(async () => {
    assert.equal(dirname(await realpath(directory)), temp);
    await rm(directory, { recursive: true, force: true });
  });

  const root = join(directory, 'project with spaces');
  const home = join(directory, 'home');
  const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: join(home, '.codex') };
  await mkdir(root);
  await mkdir(home);

  function run(command, args) {
    const result = spawnSync(command, args, { cwd: directory, env, encoding: 'utf8', windowsHide: true, timeout: 15_000 });
    assert.ifError(result.error);
    return result;
  }

  function gitCommand(...args) {
    const result = run('git', ['-C', root, ...args]);
    assert.equal(result.status, 0, result.stderr);
  }

  if (git) gitCommand('init', '--quiet');
  return {
    directory,
    root,
    home,
    git: gitCommand,
    run(cwd, ...args) {
      return run(process.execPath, [helper, '--cwd', cwd, ...args]);
    },
    sync(cwd = root, ...args) {
      const result = this.run(cwd, ...args);
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.ok(Array.isArray(report.detected));
      assert.ok(Array.isArray(report.managed));
      assert.equal(typeof report.changed, 'boolean');
      return report;
    },
  };
}

async function catalog(root) {
  return JSON.parse(await readFile(join(root, catalogPath), 'utf8'));
}

function checkSource(marketplace, name) {
  const entry = marketplace.plugins.find(plugin => plugin.name === name);
  assert.ok(entry, `Missing marketplace entry for ${name}`);
  assert.equal(entry.source.source, 'git-subdir');
  assert.equal(entry.source.url, 'https://github.com/Wayzer107/codex-plugin-ports.git');
  assert.equal(entry.source.path, './plugins/' + name);
  assert.match(entry.source.sha, /^[0-9a-f]{40}$/);
}

function assertEnabled(config, name, marketplace) {
  const header = `[plugins."${name}@${marketplace}"]`;
  const lines = config.split(/\r?\n/);
  const index = lines.findIndex(line => line.trim() === header);
  assert.ok(index >= 0, `Missing config table ${header}`);
  const nextTable = lines.findIndex((line, lineIndex) => lineIndex > index && line.trimStart().startsWith('['));
  const settings = lines.slice(index + 1, nextTable < 0 ? undefined : nextTable);
  assert.ok(settings.includes('enabled = true'), `${header} must be enabled`);
}

function assertRejected(result, diagnostic) {
  assert.equal(result.signal, null);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, diagnostic);
}

test('detects Git project languages from a nested directory and excludes vendor and ignored paths', async t => {
  const repo = await project(t);
  await put(repo.root, '.gitignore', 'ignored/\n');
  await put(repo.root, 'src/index.ts', 'export const value = 1;\n');
  await put(repo.root, 'tools/main.py', 'print(1)\n');
  await put(repo.root, 'src/vendor/main.go', 'package main\n');
  await put(repo.root, 'node_modules/dependency/main.java', 'class Main {}\n');
  await put(repo.root, 'build/main.swift', 'print(1)\n');
  await put(repo.root, 'ignored/main.rs', 'fn main() {}\n');
  repo.git('add', '-f', '--', '.gitignore', 'src/index.ts', 'src/vendor/main.go', 'node_modules/dependency/main.java');

  const report = repo.sync(join(repo.root, 'src'));
  assert.deepEqual([...report.detected].sort(), ['pyright-lsp', 'typescript-lsp']);
  assert.deepEqual([...report.managed].sort(), ['pyright-lsp', 'typescript-lsp']);
  assert.equal(report.changed, true);
  assert.equal((await catalog(repo.root)).plugins.length, 2);
  await assert.rejects(lstat(join(repo.root, 'src', '.codex')), { code: 'ENOENT' });
});

test('check mode combines a new file hint with project detection without writing configuration', async t => {
  const repo = await project(t);
  await put(repo.root, 'src/index.ts', 'export const value = 1;\n');

  const report = repo.sync(repo.root, '--file', 'src/run.py', '--check');
  assert.deepEqual([...report.detected].sort(), ['pyright-lsp', 'typescript-lsp']);
  assert.deepEqual([...report.managed].sort(), ['pyright-lsp', 'typescript-lsp']);
  assert.equal(report.changed, true);
  await assert.rejects(lstat(join(repo.root, '.codex')), { code: 'ENOENT' });
  await assert.rejects(lstat(join(repo.root, '.agents')), { code: 'ENOENT' });
});

test('pins the marketplace source and preserves existing project and user settings across repeat runs', async t => {
  const repo = await project(t);
  const unrelated = {
    name: 'manual-plugin',
    source: { source: 'local', path: './plugins/manual' },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: 'Developer Tools',
  };
  const existingCatalog = { name: 'local-tools', interface: { displayName: 'Local Tools' }, plugins: [unrelated] };
  const projectConfig = '# local comment\nmodel = "keep-project-model"\n\n[plugins."manual-plugin@local-tools"]\nenabled = false\n';
  const userConfig = 'model = "keep-user-model"\n';
  await put(repo.root, 'src/index.ts', 'export const value = 1;\n');
  await put(repo.root, 'plugins/manual/plugin.json', JSON.stringify({ name: 'manual-plugin', version: '1.0.0' }));
  await put(repo.root, catalogPath, JSON.stringify(existingCatalog));
  await put(repo.root, configPath, projectConfig);
  await put(repo.home, configPath, userConfig);

  const report = repo.sync();
  assert.deepEqual(report.managed, ['typescript-lsp']);
  assert.equal(report.changed, true);
  const marketplace = await catalog(repo.root);
  assert.equal(marketplace.name, existingCatalog.name);
  assert.deepEqual(marketplace.interface, existingCatalog.interface);
  assert.deepEqual(marketplace.plugins.find(plugin => plugin.name === unrelated.name), unrelated);
  checkSource(marketplace, 'typescript-lsp');
  await assert.rejects(lstat(join(repo.root, '.codex', 'lsp-plugins')), { code: 'ENOENT' });

  const catalogBefore = await readFile(join(repo.root, catalogPath), 'utf8');
  const configBefore = await readFile(join(repo.root, configPath), 'utf8');
  assert.ok(configBefore.includes(projectConfig));
  assertEnabled(configBefore, 'typescript-lsp', marketplace.name);

  const repeat = repo.sync();
  assert.deepEqual(repeat.managed, ['typescript-lsp']);
  assert.equal(repeat.changed, false);
  assert.equal(await readFile(join(repo.root, catalogPath), 'utf8'), catalogBefore);
  assert.equal(await readFile(join(repo.root, configPath), 'utf8'), configBefore);
  assert.equal(await readFile(join(repo.home, configPath), 'utf8'), userConfig);
  assert.deepEqual(await readdir(join(repo.home, '.codex')), ['config.toml']);
});

test('drops stale managed entries when a tracked source file is removed', async t => {
  const repo = await project(t);
  await put(repo.root, 'main.py', 'print(1)\n');
  await put(repo.root, 'index.ts', 'export const value = 1;\n');
  repo.git('add', '--', 'main.py', 'index.ts');
  assert.deepEqual([...repo.sync().managed].sort(), ['pyright-lsp', 'typescript-lsp']);
  const previous = await catalog(repo.root);
  checkSource(previous, 'pyright-lsp');

  await rm(join(repo.root, 'main.py'));
  const report = repo.sync();
  assert.deepEqual(report.detected, ['typescript-lsp']);
  assert.deepEqual(report.managed, ['typescript-lsp']);
  assert.equal(report.changed, true);
  const marketplace = await catalog(repo.root);
  assert.deepEqual(marketplace.plugins.map(plugin => plugin.name), ['typescript-lsp']);
  const config = await readFile(join(repo.root, configPath), 'utf8');
  assert.ok(!config.includes(`pyright-lsp@${marketplace.name}`));
  assertEnabled(config, 'typescript-lsp', marketplace.name);
});

test('rejects a directory outside a Git project', async t => {
  const repo = await project(t, { git: false });
  await put(repo.root, 'main.py', 'print(1)\n');

  assertRejected(repo.run(repo.root), /git|repository/i);
  await assert.rejects(lstat(join(repo.root, '.codex')), { code: 'ENOENT' });
  await assert.rejects(lstat(join(repo.root, '.agents')), { code: 'ENOENT' });
});

test('rejects a file hint outside the Git project', async t => {
  const repo = await project(t);
  await put(repo.directory, 'external.py', 'print(1)\n');

  assertRejected(repo.run(repo.root, '--file', '../external.py'), /outside|within|escape|contained/i);
  await assert.rejects(lstat(join(repo.root, '.codex')), { code: 'ENOENT' });
  await assert.rejects(lstat(join(repo.root, '.agents')), { code: 'ENOENT' });
});

test('rejects a symlinked project configuration directory without writing through it', async t => {
  const repo = await project(t);
  const outside = join(repo.directory, 'outside');
  await put(repo.root, 'main.py', 'print(1)\n');
  await put(outside, 'config.toml', 'model = "outside"\n');
  await symlink(outside, join(repo.root, '.codex'), process.platform === 'win32' ? 'junction' : 'dir');

  assertRejected(repo.run(repo.root), /symlink|symbolic link|junction|ordinary project directory/i);
  assert.deepEqual(await readdir(outside), ['config.toml']);
  assert.equal(await readFile(join(outside, 'config.toml'), 'utf8'), 'model = "outside"\n');
});

test('rejects a symlinked project marketplace directory without writing through it', async t => {
  const repo = await project(t);
  const outside = join(repo.directory, 'outside');
  const outsideCatalog = JSON.stringify({ name: 'outside-tools', plugins: [] });
  await put(repo.root, 'main.py', 'print(1)\n');
  await put(outside, 'marketplace.json', outsideCatalog);
  await mkdir(join(repo.root, '.agents'));
  await symlink(outside, join(repo.root, '.agents', 'plugins'), process.platform === 'win32' ? 'junction' : 'dir');

  assertRejected(repo.run(repo.root), /symlink|symbolic link|junction|ordinary project directory/i);
  assert.equal(await readFile(join(outside, 'marketplace.json'), 'utf8'), outsideCatalog);
});

test('rejects a symlinked project config file without writing through it', async t => {
  const repo = await project(t);
  const outside = join(repo.directory, 'outside.toml');
  await put(repo.root, 'main.py', 'print(1)\n');
  await writeFile(outside, 'model = "outside"\n');
  await mkdir(join(repo.root, '.codex'));
  try {
    await symlink(outside, join(repo.root, configPath), 'file');
  } catch (error) {
    if (process.platform !== 'win32' || !['EPERM', 'EACCES'].includes(error.code)) throw error;
    t.skip('Windows file symlink creation requires additional privileges');
    return;
  }

  assertRejected(repo.run(repo.root), /symlink|symbolic link|ordinary file/i);
  assert.equal(await readFile(outside, 'utf8'), 'model = "outside"\n');
});

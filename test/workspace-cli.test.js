const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { fixture, write, snapshot, arrangeManaged } = require('../scripts/testing/workspace-fixtures.cjs');

function run(workspace, args, cwd = workspace.base) {
  const result = spawnSync(process.execPath, [path.join(workspace.checkoutRoot, 'scripts/workspace.mjs'), ...args], {
    cwd, encoding: 'utf8', timeout: 60000, env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: '1' },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

test('CLI help needs no root or parser; missing developer dependencies explain explicit setup', async t => {
  const workspace = await fixture(t, { cli: true, yaml: false });
  const before = await snapshot(workspace.base);
  const help = run(workspace, ['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /checkout command/);
  const missing = run(workspace, ['check', '--root', workspace.root]);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /npm ci --include=dev/);
  assert.deepEqual(await snapshot(workspace.base), before);
});

test('CLI validates usage without writing', async t => {
  const workspace = await fixture(t, { cli: true });
  const before = await snapshot(workspace.base);
  for (const args of [
    [], ['check'], ['unknown', '--root', workspace.root],
    ['check', '--root', workspace.root, '--bogus'],
    ['check', '--root', workspace.root, '--agent', 'other'],
    ['check', '--root', workspace.root, '--agent', 'codex', '--agent', 'claude'],
    ['check', '--root', workspace.root, '--dry-run'],
    ['sync', '--root', workspace.root, '--dry-run', 'extra'],
    ['check', '--root', path.join(workspace.base, 'absent')],
    ['check', '--root', path.join(workspace.checkoutRoot, 'package.json')],
  ]) {
    const result = run(workspace, args);
    assert.equal(result.status, 2, `${JSON.stringify(args)}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /workspace:/);
  }
  assert.deepEqual(await snapshot(workspace.base), before);
});

test('CLI resolves its entrypoint through a linked ancestor such as macOS temporary paths', async t => {
  const workspace = await fixture(t, { cli: true });
  const alias = path.join(workspace.base, 'workspace-alias');
  await fs.symlink(workspace.root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const throughAlias = { ...workspace, checkoutRoot: path.join(alias, 'cats-one') };
  const before = await snapshot(workspace.base);
  const help = run(throughAlias, ['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /checkout command/);
  const check = run(throughAlias, ['check', '--root', workspace.root]);
  assert.equal(check.status, 1, check.stderr);
  assert.match(check.stdout, /4 members, 3 canonical skills/);
  assert.deepEqual(await snapshot(workspace.base), before);
});

test('AC-8 CLI: fresh previews succeed, checks report drift, all targets stay read-only from arbitrary cwd', async t => {
  const workspace = await fixture(t, { cli: true });
  const before = await snapshot(workspace.base);
  for (const agent of ['codex', 'claude', 'all']) {
    const preview = run(workspace, ['sync', '--root', workspace.root, '--agent', agent, '--dry-run']);
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /4 members, 3 canonical skills/);
    assert.match(preview.stdout, /create\s+AGENTS.md/);
    if (agent === 'claude') assert.doesNotMatch(preview.stdout, /\.agents\/skills/);
    if (agent === 'codex') assert.doesNotMatch(preview.stdout, /\.claude\/skills/);
    assert.equal(run(workspace, ['check', '--root', '..', '--agent', agent], workspace.checkoutRoot).status, 1);
  }
  const defaultAgent = run(workspace, ['sync', '--root', workspace.root, '--dry-run']);
  assert.match(defaultAgent.stdout, /target codex/);
  assert.deepEqual(await snapshot(workspace.base), before);
});

test('AC-7/8 CLI: in-sync, adoption, edited files and pending recovery have the contracted exit codes', async t => {
  const workspace = await fixture(t, { cli: true });
  const { inspectWorkspace } = await import('../scripts/shared/workspace-plan.mjs');
  const report = await inspectWorkspace(workspace);
  await arrangeManaged(workspace, report);
  let before = await snapshot(workspace.base);
  const current = run(workspace, ['check', '--root', workspace.root, '--agent', 'all']);
  assert.equal(current.status, 0, current.stderr);
  assert.doesNotMatch(current.stdout, /create|adopt|remove|conflict/);
  assert.deepEqual(await snapshot(workspace.base), before);
  await fs.rename(path.join(workspace.root, '.cats-workspace/managed.json'), path.join(workspace.base, 'saved-managed.json'));
  before = await snapshot(workspace.base);
  const adoption = run(workspace, ['check', '--root', workspace.root]);
  assert.equal(adoption.status, 1, adoption.stderr);
  assert.match(adoption.stdout, /adopt/);
  assert.deepEqual(await snapshot(workspace.base), before);
  await fs.rename(path.join(workspace.base, 'saved-managed.json'), path.join(workspace.root, '.cats-workspace/managed.json'));
  await write(workspace.root, '.claude/skills/a2a-handoff/local.txt', 'Local edit');
  before = await snapshot(workspace.base);
  assert.equal(run(workspace, ['check', '--root', workspace.root, '--agent', 'codex']).status, 0);
  const conflict = run(workspace, ['sync', '--root', workspace.root, '--agent', 'all', '--dry-run']);
  assert.equal(conflict.status, 2, conflict.stderr);
  assert.match(conflict.stdout, /conflict.*\.claude\/skills\/a2a-handoff/);
  assert.deepEqual(await snapshot(workspace.base), before);
  await write(workspace.root, '.cats-workspace/recovery.json', '{}');
  before = await snapshot(workspace.base);
  const pending = run(workspace, ['check', '--root', workspace.root]);
  assert.equal(pending.status, 2);
  assert.match(pending.stderr, /Read-only commands cannot recover/);
  assert.deepEqual(await snapshot(workspace.base), before);
});

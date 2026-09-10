const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { fixture, write, snapshot, relative, repository } = require('../scripts/testing/workspace-fixtures.cjs');

const windows = process.platform === 'win32';
const wrappers = windows
  ? ['powershell.exe', 'pwsh.exe'].map(shell => ({ shell, file: 'scripts/windows/Sync-WorkspaceSkills.ps1' }))
  : ['linux', 'macos'].map(os => ({ file: `scripts/${os}/sync-workspace-skills.sh` }));

async function prepare(t, wrapper, options = {}) {
  const workspace = await fixture(t, { cli: true, ...options });
  const source = relative(repository, wrapper.file);
  const target = relative(workspace.checkoutRoot, wrapper.file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  // Preserve the checkout's mode: direct Unix execution must fail if Git loses +x.
  await fs.cp(source, target);
  return workspace;
}

function run(workspace, wrapper, args = [], { cwd = workspace.base, env = {} } = {}) {
  const script = relative(workspace.checkoutRoot, wrapper.file);
  const command = wrapper.shell || script;
  const prefix = wrapper.shell ? ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script] : [];
  const result = spawnSync(command, [...prefix, ...args], {
    cwd, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: '1', ...env },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

for (const wrapper of wrappers) {
  const label = wrapper.shell || wrapper.file;
  const check = windows ? '-Check' : '--check';
  const preview = windows ? '-WhatIf' : '--dry-run';
  const help = windows ? '-Help' : '--help';

  test(`${label}: no arguments sync and check both agents from any cwd; repeat is a no-op`, async t => {
    const workspace = await prepare(t, wrapper);
    const beforeMembers = await Promise.all(workspace.manifest.members.map(member => snapshot(relative(workspace.root, member.path))));
    const applied = run(workspace, wrapper);
    assert.equal(applied.status, 0, `${applied.stdout}\n${applied.stderr}`);
    assert.match(applied.stdout, /Sync: 4 members, 3 canonical skills, target all/);
    assert.match(applied.stdout, /Read-only check: 4 members, 3 canonical skills, target all/);
    const managed = JSON.parse(await fs.readFile(relative(workspace.root, '.cats-workspace/managed.json'), 'utf8'));
    assert.equal(managed.entries.filter(entry => entry.agent === 'codex').length, 3);
    assert.equal(managed.entries.filter(entry => entry.agent === 'claude').length, 3);
    assert.equal(managed.entries.filter(entry => entry.agent === 'shared').length, 1);
    for (const mirror of ['.agents', '.claude']) {
      assert.deepEqual(await fs.readFile(relative(workspace.root, `${mirror}/skills/a2a-handoff/data/binary.bin`)), Buffer.from([0, 255, 13, 10, 128]));
    }
    assert.deepEqual(await Promise.all(workspace.manifest.members.map(member => snapshot(relative(workspace.root, member.path)))), beforeMembers);
    const settled = await snapshot(workspace.base);
    const repeated = run(workspace, wrapper, [], { cwd: workspace.checkoutRoot });
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.deepEqual(await snapshot(workspace.base), settled);
  });

  test(`${label}: preview, check and invalid options leave a fresh workspace untouched`, async t => {
    const workspace = await prepare(t, wrapper);
    const before = await snapshot(workspace.base);
    const planned = run(workspace, wrapper, [preview]);
    assert.equal(planned.status, 0, planned.stderr);
    assert.match(planned.stdout, /Read-only preview: 4 members, 3 canonical skills, target all/);
    assert.doesNotMatch(planned.stdout, /Read-only check:/);
    const drift = run(workspace, wrapper, [check]);
    assert.equal(drift.status, 1, drift.stderr);
    assert.match(drift.stdout, /Read-only check: 4 members, 3 canonical skills, target all/);
    assert.notEqual(run(workspace, wrapper, ['--bogus']).status, 0);
    assert.notEqual(run(workspace, wrapper, [check, preview]).status, 0);
    assert.deepEqual(await snapshot(workspace.base), before);
  });

  test(`${label}: help needs no dependencies; missing setup returns the CLI error without installing`, async t => {
    const workspace = await prepare(t, wrapper, { yaml: false });
    const before = await snapshot(workspace.base);
    const usage = run(workspace, wrapper, [help]);
    assert.equal(usage.status, 0, usage.stderr);
    assert.match(usage.stdout, /workspace skills|workspace parent/i);
    const missing = run(workspace, wrapper);
    assert.equal(missing.status, 2, missing.stderr);
    assert.match(missing.stderr, /npm ci --include=dev/);
    assert.doesNotMatch(missing.stdout, /Read-only check:/);
    assert.deepEqual(await snapshot(workspace.base), before);
  });

  test(`${label}: a root guidance conflict fails before any copy or follow-up check`, async t => {
    const workspace = await prepare(t, wrapper);
    await write(workspace.root, 'AGENTS.md', 'Keep these personal workspace instructions.\n');
    const before = await snapshot(workspace.base);
    const result = run(workspace, wrapper);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stdout, /conflict\s+AGENTS.md/);
    assert.doesNotMatch(result.stdout, /Read-only check:/);
    assert.deepEqual(await snapshot(workspace.base), before);
  });

  test(`${label}: sync failure stops the sequence and a failed follow-up check keeps its exit code`, async t => {
    const workspace = await prepare(t, wrapper, { yaml: false, skills: false });
    const calls = path.join(workspace.base, 'wrapper-calls.jsonl');
    await write(workspace.checkoutRoot, 'scripts/workspace.mjs', `
      import fs from 'node:fs/promises';
      await fs.appendFile(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + '\\n');
      process.exit(Number(process.argv[2] === 'sync' ? process.env.WRAPPER_SYNC_EXIT : process.env.WRAPPER_CHECK_EXIT));
    `);
    const failedSync = run(workspace, wrapper, [], { env: { WRAPPER_SYNC_EXIT: '17', WRAPPER_CHECK_EXIT: '23' } });
    assert.equal(failedSync.status, 17, failedSync.stderr);
    const firstCalls = (await fs.readFile(calls, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(firstCalls.map(args => args[0]), ['sync']);
    await fs.writeFile(calls, '');
    const failedCheck = run(workspace, wrapper, [], { env: { WRAPPER_SYNC_EXIT: '0', WRAPPER_CHECK_EXIT: '23' } });
    assert.equal(failedCheck.status, 23, failedCheck.stderr);
    const secondCalls = (await fs.readFile(calls, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(secondCalls.map(args => args[0]), ['sync', 'check']);
  });
}

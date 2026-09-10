const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync, fork } = require('node:child_process');
const { once } = require('node:events');
const { fixture, write, addSkill, snapshot, arrangeManaged, relative, repository } = require('../scripts/testing/workspace-fixtures.cjs');
const applyApi = import('../scripts/shared/workspace-apply.mjs');
const planApi = import('../scripts/shared/workspace-plan.mjs');
const sync = async (workspace, extra = {}) => (await applyApi).syncWorkspace({ ...workspace, ...extra });
const inspect = async (workspace, agent = 'codex') => (await planApi).inspectWorkspace({ ...workspace, agent });
const driver = path.join(repository, 'scripts/testing/workspace-sync-child.mjs');

async function assertSettled(workspace) {
  assert.deepEqual((await fs.readdir(relative(workspace.root, '.cats-workspace'))).sort(), ['managed.json']);
  assert.equal((await inspect(workspace)).hasDrift, false);
}

test('AC-1/3/5/8: materializes complete copies and ownership; repeat sync is a byte/mtime no-op', async t => {
  const workspace = await fixture(t);
  const members = new Map();
  for (const member of workspace.manifest.members) members.set(member.id, await snapshot(relative(workspace.root, member.path)));
  const report = await sync(workspace, { agent: 'all' });
  assert.ok(report.actions.every(action => action.action === 'create'));
  assert.equal(report.actions.length, 7);
  const metadata = JSON.parse(await fs.readFile(relative(workspace.root, '.cats-workspace/managed.json'), 'utf8'));
  assert.equal(metadata.entries.length, 7);
  const { readSnapshot } = await import('../scripts/shared/workspace-fs.mjs');
  for (const desired of report.desired) assert.equal((await readSnapshot(report.root, desired.path)).digest, desired.snapshot.digest);
  for (const member of workspace.manifest.members) assert.deepEqual(await snapshot(relative(workspace.root, member.path)), members.get(member.id));
  await assertSettled(workspace);
  const before = await snapshot(workspace.base);
  const again = await sync(workspace, { agent: 'all' });
  assert.ok(again.actions.every(action => action.action === 'unchanged'));
  assert.deepEqual(await snapshot(workspace.base), before);
});

test('recreates a missing managed output even when ownership bytes do not change', async t => {
  const workspace = await fixture(t);
  await sync(workspace);
  const metadata = await fs.readFile(relative(workspace.root, '.cats-workspace/managed.json'));
  await fs.rename(relative(workspace.root, '.agents/skills/a2a-handoff'), path.join(workspace.base, 'missing-output'));
  await sync(workspace);
  assert.deepEqual(await fs.readFile(relative(workspace.root, '.cats-workspace/managed.json')), metadata);
  await assertSettled(workspace);
});

test('AC-5/7/8: adoption, edits and scoped removal retain unrelated files and the other agent', async t => {
  const workspace = await fixture(t);
  const report = await inspect(workspace, 'all');
  const previous = await arrangeManaged(workspace, report);
  await fs.unlink(relative(workspace.root, '.cats-workspace/managed.json'));
  const adopted = await sync(workspace, { agent: 'all' });
  assert.ok(adopted.actions.every(action => action.action === 'adopt'));
  await write(workspace.root, '.agents/skills/personal/SKILL.md', 'Personal skill');
  await write(workspace.root, '.agents/skills/.cats-runtime-managed-skills', 'Legacy helper manifest');
  const claude = await snapshot(relative(workspace.root, '.claude'));
  await write(workspace.root, 'cats-platform/skills/orchestration/a2a-handoff/data/binary.bin', Buffer.from([4, 3, 2, 1]));
  await fs.rename(relative(workspace.root, 'cats-platform/skills/orchestration/project-memory-sync'), path.join(workspace.base, 'removed-source'));
  await addSkill(workspace.root, 'cats-platform', 'skills/orchestration', 'replacement-skill');
  const applied = await sync(workspace);
  assert.equal(applied.actions.find(action => action.path.endsWith('/a2a-handoff')).action, 'update');
  assert.equal(applied.actions.find(action => action.path.endsWith('/project-memory-sync')).action, 'remove');
  await assert.rejects(fs.stat(relative(workspace.root, '.agents/skills/project-memory-sync')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(relative(workspace.root, '.agents/skills/personal/SKILL.md'), 'utf8'), 'Personal skill');
  assert.equal(await fs.readFile(relative(workspace.root, '.agents/skills/.cats-runtime-managed-skills'), 'utf8'), 'Legacy helper manifest');
  assert.deepEqual(await snapshot(relative(workspace.root, '.claude')), claude);
  const metadata = JSON.parse(await fs.readFile(relative(workspace.root, '.cats-workspace/managed.json'), 'utf8'));
  assert.deepEqual(metadata.entries.filter(entry => entry.agent === 'claude'), previous.filter(entry => entry.agent === 'claude'));
  await assertSettled(workspace);
});

test('AC-6/7: all-target conflict and invalid recovery metadata fail before any writes', async t => {
  const workspace = await fixture(t);
  await sync(workspace, { agent: 'all' });
  await write(workspace.root, '.claude/skills/a2a-handoff/local.md', 'Keep this local edit');
  let before = await snapshot(workspace.base);
  assert.equal((await sync(workspace, { agent: 'all' })).hasConflicts, true);
  assert.deepEqual(await snapshot(workspace.base), before);
  await write(workspace.root, '.cats-workspace/recovery.json', '{}');
  before = await snapshot(workspace.base);
  await assert.rejects(sync(workspace), /Invalid recovery record/);
  assert.deepEqual(await snapshot(workspace.base), before);
});

test('source changes while staging trigger rollback before ownership can claim stale content', async t => {
  const workspace = await fixture(t);
  await sync(workspace);
  const oldMetadata = await fs.readFile(relative(workspace.root, '.cats-workspace/managed.json'));
  await write(workspace.root, 'cats-platform/skills/orchestration/a2a-handoff/data/binary.bin', 'first change');
  await assert.rejects(sync(workspace, { onEvent: async event => {
    if (event === 'before-apply') await write(workspace.root, 'cats-platform/skills/orchestration/a2a-handoff/data/binary.bin', 'concurrent change');
  } }), /Canonical inventory changed/);
  assert.deepEqual(await fs.readFile(relative(workspace.root, '.cats-workspace/managed.json')), oldMetadata);
  assert.deepEqual(await fs.readFile(relative(workspace.root, '.agents/skills/a2a-handoff/data/binary.bin')), Buffer.from([0, 255, 13, 10, 128]));
  assert.deepEqual(await fs.readdir(relative(workspace.root, '.cats-workspace')), ['managed.json']);
});

test('AC-3: resource executable permissions survive copying on Unix', async t => {
  if (process.platform === 'win32') return t.skip('Unix executable bits are not available on Windows');
  const workspace = await fixture(t);
  const source = 'cats-platform/skills/orchestration/a2a-handoff/scripts/run.sh';
  await write(workspace.root, source, '#!/bin/sh\nexit 0\n');
  await fs.chmod(relative(workspace.root, source), 0o755);
  await sync(workspace);
  assert.equal((await fs.stat(relative(workspace.root, '.agents/skills/a2a-handoff/scripts/run.sh'))).mode & 0o777, 0o755);
});

test('a source edit after replacement is detected before commit and all prior outputs are restored', async t => {
  const workspace = await changedWorkspace(t);
  let edited = false;
  await assert.rejects(sync(workspace, { onEvent: async event => {
    if (event === 'replaced' && !edited) {
      edited = true;
      await write(workspace.root, 'cats-platform/skills/orchestration/a2a-handoff/data/binary.bin', 'edit during apply');
    }
  } }), /Canonical inventory changed/);
  assert.deepEqual(await fs.readFile(relative(workspace.root, '.cats-workspace/managed.json')), workspace.oldMetadata);
  assert.deepEqual(await fs.readFile(relative(workspace.root, '.agents/skills/a2a-handoff/data/binary.bin')), Buffer.from([0, 255, 13, 10, 128]));
  assert.ok(await fs.stat(relative(workspace.root, '.agents/skills/project-memory-sync')));
  await assert.rejects(fs.stat(relative(workspace.root, '.agents/skills/replacement-skill')), { code: 'ENOENT' });
  assert.deepEqual(await fs.readdir(relative(workspace.root, '.cats-workspace')), ['managed.json']);
});

test('an adopted file edited before commit is preserved and never recorded as owned', async t => {
  const workspace = await fixture(t);
  await arrangeManaged(workspace, await inspect(workspace), ['shared', 'codex']);
  await fs.unlink(relative(workspace.root, '.cats-workspace/managed.json'));
  await assert.rejects(sync(workspace, { onEvent: async event => {
    if (event === 'before-commit') await write(workspace.root, '.agents/skills/a2a-handoff/local.md', 'Keep the concurrent edit');
  } }), /Content changed during workspace operation/);
  assert.equal(await fs.readFile(relative(workspace.root, '.agents/skills/a2a-handoff/local.md'), 'utf8'), 'Keep the concurrent edit');
  await assert.rejects(fs.stat(relative(workspace.root, '.cats-workspace/managed.json')), { code: 'ENOENT' });
  assert.deepEqual(await fs.readdir(relative(workspace.root, '.cats-workspace')), []);
});

test('an interrupted, unpublished journal is discarded without parsing partial JSON', async t => {
  const workspace = await fixture(t);
  await write(workspace.root, '.cats-workspace/recovery.pending', '{"schemaVersion":');
  const before = await snapshot(workspace.base);
  await assert.rejects(inspect(workspace), /Active or interrupted workspace apply/);
  assert.deepEqual(await snapshot(workspace.base), before);
  assert.equal((await sync(workspace)).recovered, 'discarded-unpublished-record');
  await assertSettled(workspace);
});

async function changedWorkspace(t) {
  const workspace = await fixture(t, { cli: true });
  await sync(workspace, { agent: 'all' });
  const oldMetadata = await fs.readFile(relative(workspace.root, '.cats-workspace/managed.json'));
  const otherAgent = await snapshot(relative(workspace.root, '.claude'));
  await write(workspace.root, 'cats-platform/skills/orchestration/a2a-handoff/data/binary.bin', 'replacement bytes');
  await fs.rename(relative(workspace.root, 'cats-platform/skills/orchestration/project-memory-sync'), path.join(workspace.base, 'removed-source'));
  await addSkill(workspace.root, 'cats-platform', 'skills/orchestration', 'replacement-skill');
  return { ...workspace, oldMetadata, otherAgent };
}

async function crashAt(workspace, checkpoint) {
  const child = spawnSync(process.execPath, [driver, workspace.checkoutRoot, workspace.root, checkpoint], {
    cwd: workspace.base, encoding: 'utf8', timeout: 60000, env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: '1' },
  });
  assert.ifError(child.error);
  assert.match(child.stdout, new RegExp(`checkpoint:${checkpoint}`), child.stderr);
  assert.notEqual(child.status, 0);
  const lock = relative(workspace.root, '.cats-workspace/writer.lock');
  const stale = new Date(Date.now() - 60000);
  await fs.utimes(lock, stale, stale); // Fixture time travel after a confirmed SIGKILL.
}

for (const checkpoint of ['journal-published', 'staged', 'backed-up', 'replaced', 'before-commit', 'ownership-written', 'committed', 'recovery-trash', 'recovery-delete', 'recovery-record-removed']) {
  test(`AC-9: SIGKILL at ${checkpoint} recovers on the next sync`, async t => {
    const workspace = await changedWorkspace(t);
    await crashAt(workspace, checkpoint);
    const beforeCheck = await snapshot(workspace.base);
    await assert.rejects(inspect(workspace), /Active or interrupted workspace apply/);
    assert.deepEqual(await snapshot(workspace.base), beforeCheck);
    let recovered;
    await sync(workspace, { onEvent: async (event, detail) => {
      if (event !== 'recovered') return;
      recovered = detail.result;
      if (recovered === 'rolled-back') {
        assert.deepEqual(await fs.readFile(relative(workspace.root, '.cats-workspace/managed.json')), workspace.oldMetadata);
        assert.deepEqual(await fs.readFile(relative(workspace.root, '.agents/skills/a2a-handoff/data/binary.bin')), Buffer.from([0, 255, 13, 10, 128]));
        assert.ok(await fs.stat(relative(workspace.root, '.agents/skills/project-memory-sync')));
      }
    } });
    assert.ok(recovered);
    assert.deepEqual(await snapshot(relative(workspace.root, '.claude')), workspace.otherAgent);
    assert.equal(await fs.readFile(relative(workspace.root, '.agents/skills/a2a-handoff/data/binary.bin'), 'utf8'), 'replacement bytes');
    await assertSettled(workspace);
  });
}

test('AC-9: partial staged content and interruption during rollback remain recoverable', async t => {
  const workspace = await changedWorkspace(t);
  await crashAt(workspace, 'staged');
  await write(workspace.root, '.cats-workspace/transaction/new/0/SKILL.md', 'partial staged bytes');
  await crashAt(workspace, 'recovery-restored');
  await sync(workspace);
  await assertSettled(workspace);
});

test('AC-9: locally edited interrupted outputs stop recovery before further mutation', async t => {
  const workspace = await changedWorkspace(t);
  await crashAt(workspace, 'replaced');
  await write(workspace.root, '.agents/skills/a2a-handoff/local.md', 'New local edit after interruption');
  const before = await snapshot(workspace.base);
  await assert.rejects(sync(workspace), /Recovery cannot restore changed\/missing original/);
  assert.deepEqual(await snapshot(workspace.base), before);
});

test('AC-9: recovery rejects traversal and linked backups without changing state', async t => {
  const workspace = await changedWorkspace(t);
  await crashAt(workspace, 'backed-up');
  const recordPath = relative(workspace.root, '.cats-workspace/recovery.json');
  const original = await fs.readFile(recordPath, 'utf8');
  const record = JSON.parse(original);
  record.operations[0].path = '../outside';
  await fs.writeFile(recordPath, JSON.stringify(record));
  let before = await snapshot(workspace.base);
  await assert.rejects(sync(workspace), /Invalid recovery destination/);
  assert.deepEqual(await snapshot(workspace.base), before);
  await fs.writeFile(recordPath, original);
  await fs.symlink(relative(workspace.root, 'cats-apps/skills'), relative(workspace.root, '.cats-workspace/transaction/old/0/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  before = await snapshot(workspace.base);
  await assert.rejects(sync(workspace), /Linked path is not supported/);
  assert.deepEqual(await snapshot(workspace.base), before);
});

test('AC-9: two processes cannot write one workspace concurrently', { timeout: 60000 }, async t => {
  const workspace = await fixture(t, { cli: true });
  const child = fork(driver, [workspace.checkoutRoot, workspace.root, 'journal-published', 'pause'], {
    cwd: workspace.base, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: '1' },
  });
  let stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const exited = once(child, 'exit');
  const ready = await Promise.race([once(child, 'message'), exited.then(() => { throw new Error(`Writer exited before locking: ${stderr}`); })]);
  assert.equal(ready[0].event, 'journal-published');
  await assert.rejects(sync(workspace), /Workspace writer is active/);
  await assert.rejects(inspect(workspace), /Active or interrupted workspace apply/);
  child.send('continue');
  const [code] = await exited;
  assert.equal(code, 0, stderr);
  await assertSettled(workspace);
});

test('CLI sync materializes selected files and check returns success afterward', async t => {
  const workspace = await fixture(t, { cli: true });
  const cli = path.join(workspace.checkoutRoot, 'scripts/workspace.mjs');
  const result = spawnSync(process.execPath, [cli, 'sync', '--root', workspace.root], { cwd: workspace.base, encoding: 'utf8', timeout: 60000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Sync: 4 members, 3 canonical skills/);
  await assertSettled(workspace);
  const before = await snapshot(workspace.base);
  const check = spawnSync(process.execPath, [cli, 'check', '--root', workspace.root], { cwd: workspace.base, encoding: 'utf8', timeout: 60000 });
  assert.equal(check.status, 0, check.stderr);
  assert.deepEqual(await snapshot(workspace.base), before);
});

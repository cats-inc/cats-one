import fs from 'node:fs/promises';
import { fileSnapshot, inspectPath, readSnapshot, requireCondition } from './workspace-fs.mjs';
import { inventoryWorkspace, loadWorkspace, TARGETS } from './workspace-inventory.mjs';
import {
  COMMIT, COMMIT_PENDING, inspectWorkspace, OWNERSHIP, PENDING_RECORD, RECOVERY, TRANSACTION, WRITER_LOCK, selected,
} from './workspace-plan.mjs';
import { inspectRecovery, journalText, readCommit, readRecovery, recoverPending, slot, validateRecovery } from './workspace-recovery.mjs';
import {
  absolute, assertDigest, digestOf, ensureDirectory, moveChecked, writeFileDurably, writeSnapshot,
} from './workspace-write.mjs';

const STATE_DIRECTORY = '.cats-workspace';
export const LOCK_STALE_MS = 30000;
const LOCK_UPDATE_MS = 10000;

async function lockDependency() {
  try { return (await import('proper-lockfile')).default; } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('Missing cats-one developer dependency "proper-lockfile". Run npm ci --include=dev in cats-one, then retry. Sync never installs dependencies.');
    }
    throw error;
  }
}

async function pendingState(root, manifest) {
  const lock = await inspectPath(root, WRITER_LOCK, { optional: true, kind: 'directory' });
  if (lock) requireCondition((await fs.readdir(lock)).length === 0, 'Writer lock must be an empty lock directory');
  // Let the lock library report a live writer before observing its moving
  // journal/output state. Stale locks still receive full recovery preflight.
  if (lock && Date.now() - (await fs.stat(lock)).mtimeMs <= LOCK_STALE_MS) return true;
  const pending = await inspectPath(root, PENDING_RECORD, { optional: true, kind: 'file' });
  const commit = await readCommit(root);
  const commitPending = await inspectPath(root, COMMIT_PENDING, { optional: true, kind: 'file' });
  const recovery = await readRecovery(root, manifest);
  if (recovery) {
    requireCondition(!pending, 'Unexpected pending publication alongside recovery record');
    await inspectRecovery(root, recovery);
  } else {
    requireCondition(!await inspectPath(root, TRANSACTION, { optional: true }), 'Orphan transaction without recovery record; preserve it for inspection');
    requireCondition(!commitPending, 'Orphan commit publication without recovery record');
    if (commit) await assertDigest(root, OWNERSHIP, commit.record.metadataDigest);
  }
  return Boolean(lock || pending || recovery || commit || commitPending);
}

function inventoryKey(inventory) {
  return JSON.stringify(inventory.desired.map(entry => [entry.path, entry.agent, entry.member, entry.source, entry.snapshot.digest]));
}

function observedKey(report) {
  return JSON.stringify([digestOf(report.metadataSnapshot), [...report.observed].map(([path, snapshot]) => [path, digestOf(snapshot)])]);
}

async function assertSources(options, report) {
  requireCondition(inventoryKey(await inventoryWorkspace(options)) === inventoryKey(report),
    'Canonical inventory changed during sync; rerun the preview');
}

async function makeRecovery(report, agent) {
  const desired = new Map(report.desired.map(entry => [entry.path, entry.snapshot]));
  const operations = report.actions.filter(entry => entry.action !== 'unchanged').map(entry => ({
    path: entry.path, before: digestOf(report.observed.get(entry.path)), after: digestOf(desired.get(entry.path)),
  })).filter(entry => entry.before !== entry.after);
  const afterMetadata = journalText({ schemaVersion: 1, entries: report.nextManaged });
  const metadataSnapshot = fileSnapshot(afterMetadata, 0o600);
  operations.push({ path: OWNERSHIP, before: digestOf(report.metadataSnapshot), after: metadataSnapshot.digest });
  const createdDirectories = [];
  for (const [target, destination] of Object.entries(TARGETS)) {
    if (!selected(target, agent) || !operations.some(entry => entry.path.startsWith(`${destination}/`) && entry.after !== null)) continue;
    for (const directory of [destination.split('/')[0], destination]) {
      if (!await inspectPath(report.root, directory, { optional: true, kind: 'directory' })) createdDirectories.push(directory);
    }
  }
  const record = validateRecovery({
    schemaVersion: 1, agent, beforeMetadata: report.metadataSnapshot?.content.toString('utf8') ?? null,
    afterMetadata, operations, createdDirectories,
  }, report.manifest);
  desired.set(OWNERSHIP, metadataSnapshot);
  return { record, desired };
}

async function assertApplied(report, record) {
  // Includes unchanged/adopted entries: ownership must never claim a destination
  // that was edited concurrently while other entries were being replaced.
  const wanted = new Map(report.desired.map(entry => [entry.path, entry.snapshot]));
  for (const action of report.actions) {
    await assertDigest(report.root, action.path, digestOf(wanted.get(action.path)));
  }
  await assertDigest(report.root, OWNERSHIP, record.operations.at(-1).before);
}

async function applyPlan(options, report, agent, guard, event) {
  const { root } = report;
  const { record, desired } = await makeRecovery(report, agent);
  await guard();
  const content = journalText(record);
  await writeFileDurably(root, PENDING_RECORD, content);
  await moveChecked(root, PENDING_RECORD, RECOVERY, fileSnapshot(content).digest);
  await event('journal-published', {});
  await ensureDirectory(root, `${TRANSACTION}/new`);
  await ensureDirectory(root, `${TRANSACTION}/old`);
  for (const [index, operation] of record.operations.entries()) {
    await guard();
    if (operation.after !== null) await writeSnapshot(root, slot('new', index), desired.get(operation.path));
    await event('staged', { path: operation.path });
  }
  await event('before-apply', {});
  await assertSources(options, report);
  for (const [index, operation] of record.operations.entries()) {
    await event('before-replace', { path: operation.path });
    await guard();
    await assertDigest(root, RECOVERY, fileSnapshot(content).digest);
    await assertDigest(root, operation.path, operation.before);
    if (operation.path === OWNERSHIP) {
      await event('before-commit', {});
      await assertSources(options, report);
      await assertApplied(report, record);
    } else {
      const source = report.desired.find(entry => entry.path === operation.path);
      if (source && source.path !== 'AGENTS.md') {
        await assertDigest(root, `${source.member}/${source.source}`, source.snapshot.digest);
      }
    }
    if (operation.before !== null) {
      await moveChecked(root, operation.path, slot('old', index), operation.before);
      await event('backed-up', { path: operation.path });
    }
    await guard();
    if (operation.after !== null) await moveChecked(root, slot('new', index), operation.path, operation.after);
    await event(operation.path === OWNERSHIP ? 'ownership-written' : 'replaced', { path: operation.path });
  }
  await guard();
  const committed = journalText({ schemaVersion: 1, recoveryDigest: fileSnapshot(content).digest,
    metadataDigest: record.operations.at(-1).after });
  await writeFileDurably(root, COMMIT_PENDING, committed);
  await moveChecked(root, COMMIT_PENDING, COMMIT, fileSnapshot(committed).digest);
  await event('committed', {});
  await event('before-cleanup', {});
  const result = await recoverPending(root, report.manifest, guard, event);
  requireCondition(result === 'finished-committed-cleanup', 'Ownership commit was not completed');
}

export async function syncWorkspace({ root: rootArgument, checkoutRoot, agent = 'codex', onEvent = async () => {} }) {
  requireCondition(agent === 'all' || Object.hasOwn(TARGETS, agent), 'Agent must be codex, claude or all');
  const context = await loadWorkspace({ root: rootArgument, checkoutRoot });
  const options = { root: context.root, checkoutRoot, agent };
  const pending = await pendingState(context.root, context.manifest);
  // Invalid inventory/conflicts and a no-op return before creating any state,
  // including the writer lock. A pending transaction is recovered first.
  const preview = pending ? null : await inspectWorkspace(options);
  if (preview?.hasConflicts || (preview && !preview.hasDrift)) return { ...preview, recovered: null };
  const lockfile = await lockDependency();
  await ensureDirectory(context.root, STATE_DIRECTORY);
  let compromised;
  let release;
  try {
    release = await lockfile.lock(absolute(context.root, STATE_DIRECTORY), {
      lockfilePath: absolute(context.root, WRITER_LOCK), realpath: true,
      stale: LOCK_STALE_MS, update: LOCK_UPDATE_MS, retries: 0,
      onCompromised: error => { compromised = error; },
    });
  } catch (error) {
    if (error.code === 'ELOCKED') throw new Error('Workspace writer is active or recently interrupted. Retry sync after the writer finishes or the 30-second stale-lock interval; do not delete the lock manually.');
    throw error;
  }
  const guard = async () => {
    if (compromised) throw new Error(`Workspace writer lock was lost: ${compromised.message}`);
    await inspectPath(context.root, WRITER_LOCK, { kind: 'directory' });
  };
  try {
    await guard();
    const recovered = await recoverPending(context.root, context.manifest, guard, onEvent);
    if (recovered) await onEvent('recovered', { result: recovered });
    const report = await inspectWorkspace({ ...options, ignoreWriterLock: true });
    if (preview) requireCondition(inventoryKey(report) === inventoryKey(preview) && observedKey(report) === observedKey(preview),
      'Workspace changed before the writer lock was acquired; rerun the preview');
    if (report.hasConflicts || !report.hasDrift) return { ...report, recovered };
    await applyPlan(options, report, agent, guard, onEvent);
    return { ...report, recovered };
  } catch (error) {
    // Do not let a failed/compromised writer race another writer during rollback.
    if (!compromised) {
      try { await recoverPending(context.root, context.manifest, guard); } catch (recoveryError) {
        throw new Error(`${error.message}. Recovery remains pending: ${recoveryError.message}`);
      }
    }
    throw error;
  } finally {
    if (!compromised) await release();
  }
}

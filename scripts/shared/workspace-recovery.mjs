import fs from 'node:fs/promises';
import {
  compare, exactKeys, fileSnapshot, inspectPath, listEntries, readSnapshot, requireCondition,
} from './workspace-fs.mjs';
import {
  COMMIT, COMMIT_PENDING, OWNERSHIP, PENDING_RECORD, RECOVERY, TRANSACTION, selected, validateOwnership,
} from './workspace-plan.mjs';
import { TARGETS } from './workspace-inventory.mjs';
import { assertDigest, digestOf, moveChecked, removeChecked, removeEmptyDirectory } from './workspace-write.mjs';

export const journalText = record => `${JSON.stringify(record, null, 2)}\n`;
export const slot = (side, index) => `${TRANSACTION}/${side}/${index}`;
const trashSlot = (side, index) => `${TRANSACTION}/trash/${side}-${index}`;

export function validateRecovery(record, manifest) {
  exactKeys(record, ['schemaVersion', 'agent', 'beforeMetadata', 'afterMetadata', 'operations', 'createdDirectories'], 'recovery record');
  requireCondition(record.schemaVersion === 1 && ['codex', 'claude', 'all'].includes(record.agent), 'Unsupported recovery schema/agent');
  requireCondition(record.beforeMetadata === null || typeof record.beforeMetadata === 'string', 'Invalid previous ownership in recovery');
  requireCondition(typeof record.afterMetadata === 'string', 'Invalid next ownership in recovery');
  const before = record.beforeMetadata === null ? [] : validateOwnership(JSON.parse(record.beforeMetadata), manifest);
  const after = validateOwnership(JSON.parse(record.afterMetadata), manifest);
  const beforeByPath = new Map(before.map(entry => [entry.path, entry]));
  const afterByPath = new Map(after.map(entry => [entry.path, entry]));
  requireCondition(afterByPath.has('AGENTS.md'), 'Recovery must retain shared root ownership');
  const retained = entries => entries.filter(entry => !selected(entry.agent, record.agent)).sort((a, b) => compare(a.path, b.path));
  requireCondition(JSON.stringify(retained(before)) === JSON.stringify(retained(after)), 'Recovery changes an unselected agent');
  requireCondition(Array.isArray(record.operations) && record.operations.length > 0, 'Recovery operations are missing');
  const paths = new Set();
  for (const [index, operation] of record.operations.entries()) {
    exactKeys(operation, ['path', 'before', 'after'], 'recovery operation');
    requireCondition(!paths.has(operation.path), `Duplicate recovery path: ${operation.path}`);
    paths.add(operation.path);
    const previous = beforeByPath.get(operation.path);
    const next = afterByPath.get(operation.path);
    if (operation.path === OWNERSHIP) {
      requireCondition(index === record.operations.length - 1
        && operation.before === (record.beforeMetadata === null ? null : fileSnapshot(record.beforeMetadata).digest)
        && operation.after === fileSnapshot(record.afterMetadata).digest, 'Invalid recovery ownership commit');
    } else {
      requireCondition((previous || next) && selected((next ?? previous).agent, record.agent), `Invalid recovery destination: ${operation.path}`);
      requireCondition(operation.before === null || operation.before === previous?.digest, `Invalid recovery preimage: ${operation.path}`);
      requireCondition(operation.after === (next?.digest ?? null), `Invalid recovery replacement: ${operation.path}`);
    }
    requireCondition(operation.path === OWNERSHIP || operation.before !== operation.after, `Redundant recovery operation: ${operation.path}`);
  }
  requireCondition(paths.has(OWNERSHIP), 'Recovery is missing its final ownership commit');
  const allowedDirectories = Object.entries(TARGETS).filter(([agent]) => selected(agent, record.agent))
    .flatMap(([, destination]) => [destination.split('/')[0], destination]);
  requireCondition(Array.isArray(record.createdDirectories)
    && new Set(record.createdDirectories).size === record.createdDirectories.length
    && record.createdDirectories.every(value => allowedDirectories.includes(value)), 'Invalid recovery directory cleanup');
  return record;
}

export async function readRecovery(root, manifest) {
  const filename = await inspectPath(root, RECOVERY, { optional: true, kind: 'file' });
  if (!filename) return null;
  const text = await fs.readFile(filename, 'utf8');
  try {
    return { record: validateRecovery(JSON.parse(text), manifest), digest: fileSnapshot(text).digest };
  } catch (error) {
    throw new Error(`Invalid recovery record: ${error.message}`);
  }
}

export async function readCommit(root) {
  const filename = await inspectPath(root, COMMIT, { optional: true, kind: 'file' });
  if (!filename) return null;
  const text = await fs.readFile(filename, 'utf8');
  try {
    const record = JSON.parse(text);
    exactKeys(record, ['schemaVersion', 'recoveryDigest', 'metadataDigest'], 'commit marker');
    requireCondition(record.schemaVersion === 1 && [record.recoveryDigest, record.metadataDigest]
      .every(value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value)), 'Invalid commit marker');
    return { record, digest: fileSnapshot(text).digest };
  } catch (error) { throw new Error(`Invalid commit marker: ${error.message}`); }
}

export async function inspectRecovery(root, recovery) {
  const { record } = recovery;
  const transaction = await inspectPath(root, TRANSACTION, { optional: true, kind: 'directory' });
  if (transaction) {
    for (const side of await listEntries(transaction)) {
      requireCondition(['new', 'old', 'trash'].includes(side.name) && side.isDirectory(), `Unexpected transaction entry: ${side.name}`);
      const directory = await inspectPath(root, `${TRANSACTION}/${side.name}`, { kind: 'directory' });
      for (const entry of await listEntries(directory)) {
        const index = side.name === 'trash' ? /^(?:new|old|installed)-(0|[1-9][0-9]*)$/u.exec(entry.name)?.[1] : entry.name;
        requireCondition(index !== undefined && /^(0|[1-9][0-9]*)$/u.test(index) && Number(index) < record.operations.length,
          `Invalid transaction slot: ${side.name}/${entry.name}`);
        if (side.name === 'trash') await readSnapshot(root, `${TRANSACTION}/trash/${entry.name}`);
      }
    }
  }
  const states = [];
  for (const [index, operation] of record.operations.entries()) {
    const current = digestOf(await readSnapshot(root, operation.path));
    const backup = digestOf(await readSnapshot(root, slot('old', index)));
    const staged = digestOf(await readSnapshot(root, slot('new', index)));
    for (const side of ['new', 'old']) {
      requireCondition(!await inspectPath(root, trashSlot(side, index), { optional: true })
        || (side === 'old' ? backup === null : staged === null), `Duplicate recovery artifact: ${side}/${index}`);
    }
    requireCondition(backup === null || backup === operation.before, `Changed recovery backup: ${operation.path}`);
    // An interrupted stage can be incomplete; it is only disposable while the
    // corresponding destination is still at its preimage and has no backup.
    requireCondition(staged === null || staged === operation.after || (current === operation.before && backup === null),
      `Changed recovery staging: ${operation.path}`);
    states.push({ current, backup, staged });
  }
  const commit = await readCommit(root);
  const commitPending = await inspectPath(root, COMMIT_PENDING, { optional: true, kind: 'file' });
  requireCondition(!commit || (!commitPending && commit.record.recoveryDigest === recovery.digest
    && commit.record.metadataDigest === record.operations.at(-1).after), 'Commit marker does not match recovery record');
  const committed = Boolean(commit);
  for (const [index, operation] of record.operations.entries()) {
    const state = states[index];
    if (committed) {
      requireCondition(state.current === operation.after, `Recovery conflict after ownership commit: ${operation.path}`);
    } else if (operation.before === null) {
      requireCondition(state.current === null || state.current === operation.after, `Recovery conflict: ${operation.path}`);
    } else {
      requireCondition(state.current === operation.before
        || (state.backup === operation.before && (state.current === null || state.current === operation.after)),
      `Recovery cannot restore changed/missing original: ${operation.path}`);
    }
  }
  await assertDigest(root, RECOVERY, recovery.digest);
  return { states, committed, commit };
}

export async function recoverPending(root, manifest, guard, event = async () => {}) {
  const recovery = await readRecovery(root, manifest);
  if (!recovery) {
    requireCondition(!await inspectPath(root, TRANSACTION, { optional: true }), 'Orphan transaction without recovery record; preserve it for inspection');
    requireCondition(!await inspectPath(root, COMMIT_PENDING, { optional: true }), 'Orphan commit publication without recovery record');
    const commit = await readCommit(root);
    if (commit) {
      await assertDigest(root, OWNERSHIP, commit.record.metadataDigest);
      await guard();
      await removeChecked(root, COMMIT, commit.digest);
      return 'finished-committed-cleanup';
    }
    // This reserved scratch file is published before any staging/output writes.
    const pending = await readSnapshot(root, PENDING_RECORD);
    if (pending) {
      requireCondition(pending.type === 'file', 'Invalid pending recovery publication');
      await guard();
      await removeChecked(root, PENDING_RECORD, pending.digest);
      return 'discarded-unpublished-record';
    }
    return null;
  }
  const { record } = recovery;
  const { committed, commit } = await inspectRecovery(root, recovery);
  if (!committed) {
    for (let index = record.operations.length - 1; index >= 0; index--) {
      await guard();
      await assertDigest(root, RECOVERY, recovery.digest);
      const operation = record.operations[index];
      const current = digestOf(await readSnapshot(root, operation.path));
      const backup = digestOf(await readSnapshot(root, slot('old', index)));
      if (current !== operation.before) {
        if (current !== null) await moveChecked(root, operation.path, trashSlot('installed', index), operation.after);
        if (operation.before !== null) {
          requireCondition(backup === operation.before, `Missing recovery backup: ${operation.path}`);
          await moveChecked(root, slot('old', index), operation.path, operation.before);
        }
      }
      await event('recovery-restored', { path: operation.path });
    }
  }
  const pendingCommit = await readSnapshot(root, COMMIT_PENDING);
  if (pendingCommit) {
    await guard();
    await removeChecked(root, COMMIT_PENDING, pendingCommit.digest);
  }
  // All paths/digests were preflighted before any recovery mutation. Recheck
  // each artifact again during cleanup, which is itself restartable.
  for (const [index, operation] of record.operations.entries()) {
    for (const side of ['new', 'old']) {
      await guard();
      const artifact = await readSnapshot(root, slot(side, index));
      if (artifact) {
        if (side === 'old') requireCondition(artifact.digest === operation.before, `Changed recovery backup: ${operation.path}`);
        await moveChecked(root, slot(side, index), trashSlot(side, index), artifact.digest);
        await event('recovery-trash', { path: operation.path, side });
      }
      const trash = await readSnapshot(root, trashSlot(side, index));
      if (trash) await removeChecked(root, trashSlot(side, index), trash.digest,
        path => event('recovery-delete', { path, side }));
      await event('recovery-cleanup', { path: operation.path, side });
    }
    const installed = await readSnapshot(root, trashSlot('installed', index));
    if (installed) {
      await guard();
      await removeChecked(root, trashSlot('installed', index), installed.digest,
        path => event('recovery-delete', { path, side: 'installed' }));
    }
  }
  for (const directory of [`${TRANSACTION}/new`, `${TRANSACTION}/old`, `${TRANSACTION}/trash`, TRANSACTION]) {
    await guard();
    await removeEmptyDirectory(root, directory);
    requireCondition(!await inspectPath(root, directory, { optional: true }), `Transaction directory is not empty: ${directory}`);
  }
  if (!committed) {
    for (const directory of [...record.createdDirectories].sort((a, b) => b.length - a.length)) {
      await guard();
      await removeEmptyDirectory(root, directory);
    }
  }
  await guard();
  await removeChecked(root, RECOVERY, recovery.digest);
  await event('recovery-record-removed', {});
  if (commit) {
    await guard();
    await removeChecked(root, COMMIT, commit.digest);
  }
  return committed ? 'finished-committed-cleanup' : 'rolled-back';
}

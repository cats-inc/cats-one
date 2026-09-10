import {
  compare, exactKeys, inspectPath, readJson, readSnapshot, relativePath, requireCondition,
} from './workspace-fs.mjs';
import { inventoryWorkspace, TARGETS, TEMPLATE, validSkillName } from './workspace-inventory.mjs';

export const OWNERSHIP = '.cats-workspace/managed.json';
const selected = (target, agent) => target === 'shared' || agent === 'all' || target === agent;

function validateOwnership(record, manifest) {
  exactKeys(record, ['schemaVersion', 'entries'], 'ownership record');
  requireCondition(record.schemaVersion === 1 && Array.isArray(record.entries), 'Unsupported ownership schema');
  const paths = new Set();
  for (const entry of record.entries) {
    exactKeys(entry, ['path', 'agent', 'member', 'source', 'digest'], 'ownership entry');
    relativePath(entry.path);
    relativePath(entry.source);
    const member = manifest.members.find(item => item.id === entry.member);
    requireCondition(member, `Unknown ownership member: ${entry.member}`);
    requireCondition(typeof entry.digest === 'string' && /^sha256:[a-f0-9]{64}$/u.test(entry.digest),
      `Invalid ownership digest: ${entry.path}`);
    requireCondition(!paths.has(entry.path.toLowerCase()), `Duplicate ownership path: ${entry.path}`);
    paths.add(entry.path.toLowerCase());
    if (entry.path === 'AGENTS.md') {
      requireCondition(entry.agent === 'shared' && entry.member === 'cats-one' && entry.source === TEMPLATE,
        'Invalid root instruction ownership');
    } else {
      requireCondition(Object.hasOwn(TARGETS, entry.agent), `Invalid ownership target: ${entry.agent}`);
      const name = entry.path.slice(TARGETS[entry.agent].length + 1);
      requireCondition(validSkillName(name) && entry.path === `${TARGETS[entry.agent]}/${name}`,
        `Invalid managed destination: ${entry.path}`);
      requireCondition(member.skillRoots.some(source => entry.source.startsWith(`${source}/`))
        && entry.source.split('/').at(-1) === name
        && !entry.source.split('/').some(part => part.endsWith('.bootstrap')),
      `Invalid canonical ownership source: ${entry.source}`);
    }
  }
  return record.entries;
}

// Pure reconciliation: all I/O and schema validation happen in inspectWorkspace.
// Keep unselected ownership entries for the eventual apply phase.
export function planWorkspace({ desired, managed, observed, agent }) {
  const desiredByPath = new Map(desired.filter(entry => selected(entry.agent, agent)).map(entry => [entry.path, entry]));
  const managedByPath = new Map(managed.filter(entry => selected(entry.agent, agent)).map(entry => [entry.path, entry]));
  const paths = [...new Set([...desiredByPath.keys(), ...managedByPath.keys()])].sort(compare);
  const actions = paths.map(destination => {
    const wanted = desiredByPath.get(destination);
    const previous = managedByPath.get(destination);
    const current = observed.get(destination);
    const owner = wanted ?? previous;
    let action;
    let reason;
    if (previous && current && current.digest !== previous.digest) {
      action = 'conflict'; reason = 'Managed destination has local edits';
    } else if (!wanted) {
      action = 'remove'; reason = current ? 'Canonical skill was removed' : 'Remove stale ownership for absent destination';
    } else if (!current) {
      action = 'create'; reason = 'Destination is missing';
    } else if (!previous) {
      action = current.digest === wanted.snapshot.digest ? 'adopt' : 'conflict';
      reason = action === 'adopt' ? 'Identical unmanaged content; future sync would take ownership' : 'Unmanaged destination differs from source';
    } else if (current.digest !== wanted.snapshot.digest || previous.member !== wanted.member || previous.source !== wanted.source) {
      action = 'update'; reason = 'Canonical content or ownership changed';
    } else {
      action = 'unchanged'; reason = 'Content and ownership match';
    }
    return { action, path: destination, agent: owner.agent, member: owner.member, source: owner.source, reason };
  });
  const nextManaged = [
    ...managed.filter(entry => !selected(entry.agent, agent)),
    ...[...desiredByPath.values()].map(({ path, agent, member, source, snapshot }) => ({ path, agent, member, source, digest: snapshot.digest })),
  ].sort((a, b) => compare(a.path, b.path));
  return {
    actions,
    hasConflicts: actions.some(entry => entry.action === 'conflict'),
    hasDrift: actions.some(entry => entry.action !== 'unchanged'),
    nextManaged,
  };
}

export async function inspectWorkspace({ root, checkoutRoot, agent = 'codex' }) {
  requireCondition(agent === 'all' || Object.hasOwn(TARGETS, agent), 'Agent must be codex, claude or all');
  const inventory = await inventoryWorkspace({ root, checkoutRoot });
  for (const pending of ['.cats-workspace/writer.lock', '.cats-workspace/recovery.json']) {
    requireCondition(!await inspectPath(inventory.root, pending, { optional: true }),
      `Active or interrupted workspace apply: ${pending}. Read-only commands cannot recover it.`);
  }
  const metadataPath = await inspectPath(inventory.root, OWNERSHIP, { optional: true, kind: 'file' });
  const managed = metadataPath ? validateOwnership(await readJson(inventory.root, OWNERSHIP), inventory.manifest) : [];
  // Validate target ancestors even when every canonical skill root is empty.
  for (const [target, destination] of Object.entries(TARGETS)) {
    if (selected(target, agent)) await inspectPath(inventory.root, destination, { optional: true, kind: 'directory' });
  }
  const observed = new Map();
  for (const entry of [...inventory.desired, ...managed]) {
    if (selected(entry.agent, agent) && !observed.has(entry.path)) {
      observed.set(entry.path, await readSnapshot(inventory.root, entry.path));
    }
  }
  return { ...inventory, ...planWorkspace({ desired: inventory.desired, managed, observed, agent }) };
}

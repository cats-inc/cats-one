import fs from 'node:fs/promises';
import path from 'node:path';
import { inspectPath, listEntries, readSnapshot, relativePath, requireCondition } from './workspace-fs.mjs';

export const absolute = (root, relative) => path.join(root, ...relativePath(relative).split('/'));
export const digestOf = snapshot => snapshot?.digest ?? null;

async function flushDirectory(directory) {
  // Windows does not expose directory fsync through Node's portable API.
  if (process.platform === 'win32') return;
  const handle = await fs.open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

export async function ensureDirectory(root, relative) {
  const parts = relativePath(relative).split('/');
  for (let length = 1; length <= parts.length; length++) {
    const current = parts.slice(0, length).join('/');
    if (await inspectPath(root, current, { optional: true, kind: 'directory' })) continue;
    try { await fs.mkdir(absolute(root, current)); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    await inspectPath(root, current, { kind: 'directory' });
    await flushDirectory(path.dirname(absolute(root, current)));
  }
}

export async function writeFileDurably(root, relative, content, mode = 0o600) {
  const parent = path.posix.dirname(relativePath(relative));
  if (parent !== '.') await ensureDirectory(root, parent);
  requireCondition(!await inspectPath(root, relative, { optional: true }), `New file already exists: ${relative}`);
  const handle = await fs.open(absolute(root, relative), 'wx', mode);
  try {
    await handle.writeFile(content);
    await handle.chmod(mode);
    await handle.sync();
  } finally { await handle.close(); }
  await flushDirectory(path.dirname(absolute(root, relative)));
}

export async function writeSnapshot(root, relative, snapshot) {
  requireCondition(!await inspectPath(root, relative, { optional: true }), `Staging destination exists: ${relative}`);
  if (snapshot.type === 'file') {
    await writeFileDurably(root, relative, snapshot.content, snapshot.mode);
    return;
  }
  await ensureDirectory(root, relative);
  for (const entry of snapshot.entries) {
    const child = `${relative}/${entry.path}`;
    if (entry.type === 'directory') await ensureDirectory(root, child);
    else await writeFileDurably(root, child, entry.content, entry.mode);
  }
  // Set directory permissions after their contents exist, including executable
  // resource directories on Unix. Ownership freshness remains byte-based.
  for (const entry of [...snapshot.entries].reverse()) {
    if (entry.type === 'directory') await fs.chmod(await inspectPath(root, `${relative}/${entry.path}`, { kind: 'directory' }), entry.mode);
  }
  await fs.chmod(await inspectPath(root, relative, { kind: 'directory' }), snapshot.mode);
  await flushDirectory(absolute(root, relative));
}

export async function assertDigest(root, relative, expected) {
  const current = await readSnapshot(root, relative);
  requireCondition(digestOf(current) === expected, `Content changed during workspace operation: ${relative}`);
  return current;
}

export async function moveChecked(root, from, to, expected) {
  await assertDigest(root, from, expected);
  await assertDigest(root, to, null);
  const parent = path.posix.dirname(to);
  if (parent !== '.') await ensureDirectory(root, parent);
  const source = await inspectPath(root, from);
  await inspectPath(root, to, { optional: true });
  await fs.rename(source, absolute(root, to));
  await flushDirectory(path.dirname(source));
  await flushDirectory(path.dirname(absolute(root, to)));
}

// Only callers with a validated journal/digest can remove a complete entry.
// Walk without following links; never recursively remove a discovery root.
export async function removeChecked(root, relative, expected, removed = async () => {}) {
  await assertDigest(root, relative, expected);
  async function remove(current) {
    const filename = await inspectPath(root, current);
    const stat = await fs.lstat(filename);
    if (stat.isDirectory()) {
      await fs.chmod(filename, (stat.mode & 0o777) | 0o700);
      for (const entry of await listEntries(filename)) await remove(`${current}/${entry.name}`);
      await fs.rmdir(await inspectPath(root, current, { kind: 'directory' }));
    } else {
      requireCondition(stat.isFile(), `Unsupported removal: ${current}`);
      try { await fs.unlink(await inspectPath(root, current, { kind: 'file' })); } catch (error) {
        if (process.platform !== 'win32' || error.code !== 'EPERM') throw error;
        await fs.chmod(await inspectPath(root, current, { kind: 'file' }), 0o600);
        await fs.unlink(await inspectPath(root, current, { kind: 'file' }));
      }
    }
    await removed(current);
  }
  await remove(relative);
  await flushDirectory(path.dirname(absolute(root, relative)));
}

export async function removeEmptyDirectory(root, relative) {
  const directory = await inspectPath(root, relative, { optional: true, kind: 'directory' });
  if (!directory) return;
  try {
    await fs.rmdir(directory);
    await flushDirectory(path.dirname(directory));
  } catch (error) {
    if (!['ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error;
  }
}

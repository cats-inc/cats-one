import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// Use portable relative names even on case-sensitive hosts. Never reinterpret
// a metadata path containing Windows separators, drive letters or traversal.
export function relativePath(value) {
  requireCondition(typeof value === 'string' && value.length > 0, 'Expected a relative path');
  for (const part of value.split('/')) {
    requireCondition(part && part !== '.' && part !== '..'
      && !/[\\<>:"|?*\x00-\x1f\x7f]/u.test(part) && !/[. ]$/u.test(part)
      && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part),
    `Unsafe relative path: ${value}`);
  }
  return value;
}

export async function canonicalRoot(value) {
  requireCondition(typeof value === 'string' && value.trim(), 'An explicit --root is required');
  const absolute = path.resolve(value);
  const stat = await fs.lstat(absolute);
  requireCondition(stat.isDirectory() && !stat.isSymbolicLink(), `Root must be an existing unlinked directory: ${absolute}`);
  return fs.realpath(absolute);
}

export function contained(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && !path.isAbsolute(relative)
    && relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

export async function maybeStat(filename) {
  try {
    return await fs.lstat(filename);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Check every existing ancestor without following links, including when the
// final destination is absent. Detect case aliases before they become writes.
export async function inspectPath(root, relative, { optional = false, kind } = {}) {
  relativePath(relative);
  let current = root;
  const parts = relative.split('/');
  for (const [index, part] of parts.entries()) {
    const aliases = (await fs.readdir(current)).filter(name => name.toLowerCase() === part.toLowerCase());
    requireCondition(aliases.length === 0 || (aliases.length === 1 && aliases[0] === part),
      `Case-insensitive path collision at ${relative}: ${aliases.join(', ')}`);
    current = path.join(current, part);
    const stat = await maybeStat(current);
    if (!stat) {
      requireCondition(optional, `Required path is missing: ${relative}`);
      return null;
    }
    requireCondition(!stat.isSymbolicLink(), `Linked path is not supported: ${relative}`);
    requireCondition(contained(root, await fs.realpath(current)), `Path escapes workspace: ${relative}`);
    const expected = index < parts.length - 1 ? 'directory' : kind;
    if (expected) {
      requireCondition(expected === 'directory' ? stat.isDirectory() : stat.isFile(),
        `Expected ${expected}: ${relative}`);
    }
  }
  return current;
}

export async function listEntries(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const names = new Map();
  for (const entry of entries) {
    relativePath(entry.name);
    const key = entry.name.toLowerCase();
    requireCondition(!names.has(key), `Case-insensitive collision in ${directory}: ${names.get(key)} and ${entry.name}`);
    names.set(key, entry.name);
    requireCondition(!entry.isSymbolicLink(), `Linked path is not supported: ${path.join(directory, entry.name)}`);
    requireCondition(entry.isDirectory() || entry.isFile(), `Unsupported filesystem entry: ${path.join(directory, entry.name)}`);
  }
  return entries.sort((a, b) => compare(a.name, b.name));
}

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function fileSnapshot(content) {
  const bytes = Buffer.from(content);
  return { type: 'file', content: bytes, digest: `sha256:${hash(JSON.stringify(['file', hash(bytes)]))}` };
}

export async function readSnapshot(root, relative) {
  const filename = await inspectPath(root, relative, { optional: true });
  if (!filename) return null;
  const stat = await fs.lstat(filename);
  if (stat.isFile()) return fileSnapshot(await fs.readFile(filename));
  requireCondition(stat.isDirectory(), `Unsupported filesystem entry: ${relative}`);
  const entries = [];
  async function walk(directory, prefix) {
    for (const entry of await listEntries(directory)) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        entries.push({ path: name, type: 'directory' });
        await walk(child, name);
      } else {
        entries.push({ path: name, type: 'file', content: await fs.readFile(child) });
      }
    }
  }
  await walk(filename, '');
  const digest = `sha256:${hash(JSON.stringify(['directory', entries.map(entry =>
    [entry.type, entry.path, entry.type === 'file' ? hash(entry.content) : null])]))}`;
  return { type: 'directory', entries, digest };
}

export async function readJson(root, relative) {
  const filename = await inspectPath(root, relative, { kind: 'file' });
  try {
    return JSON.parse(await fs.readFile(filename, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read JSON at ${relative}: ${error.message}`);
  }
}

export function exactKeys(object, keys, label) {
  requireCondition(object && typeof object === 'object' && !Array.isArray(object)
    && Object.keys(object).sort().join(',') === [...keys].sort().join(','),
  `Invalid ${label} fields; expected ${keys.join(', ')}`);
}

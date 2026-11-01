import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, readdir, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { syncAgentSkills } from '../scripts/shared/sync-agent-skills.mjs';
import { syncSharedTools } from '../scripts/sync-shared-tools.mjs';

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'cats-tools-'));
  const put = async (name, text = '') => { await mkdir(path.dirname(path.join(root, name)), { recursive: true }); await writeFile(path.join(root, name), text); };
  try { await run(root, put); } finally { await rm(root, { recursive: true, force: true }); }
}

test('recursive skill sync keeps resources, skips bootstrap packages and preserves unrelated skills', async () => fixture(async (root, put) => {
  await put('AGENTS.md');
  await put('skills/orchestration/example/SKILL.md', 'current');
  await put('skills/orchestration/example/resources/data.txt', 'resource');
  await put('skills/ignored.bootstrap/SKILL.md');
  await put('.agents/skills/unrelated/SKILL.md', 'owner');
  await put('.agents/skills/example/stale.txt', 'stale');
  const before = await readdir(path.join(root, '.agents/skills/example'));
  await syncAgentSkills({ projectRoot: root, dryRun: true });
  assert.deepEqual(await readdir(path.join(root, '.agents/skills/example')), before);
  await syncAgentSkills({ projectRoot: root });
  assert.equal(await readFile(path.join(root, '.agents/skills/unrelated/SKILL.md'), 'utf8'), 'owner');
  assert.equal(await readFile(path.join(root, '.claude/skills/example/resources/data.txt'), 'utf8'), 'resource');
  assert.deepEqual((await readdir(path.join(root, '.agents/skills/example'))).sort(), ['SKILL.md', 'resources']);
}));

test('duplicate names and linked destinations fail before either host changes', async () => fixture(async (root, put) => {
  await put('AGENTS.md');
  await put('skills/a/example/SKILL.md');
  await put('skills/b/example/SKILL.md');
  await put('.claude/skills/example/SKILL.md', 'preserve');
  await assert.rejects(syncAgentSkills({ projectRoot: root }), /Duplicate skill/u);
  await rm(path.join(root, 'skills/b'), { recursive: true });
  await mkdir(path.join(root, 'outside'));
  await mkdir(path.join(root, '.agents'));
  await symlink(path.join(root, 'outside'), path.join(root, '.agents/skills'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(syncAgentSkills({ projectRoot: root }), /linked/iu);
  assert.equal(await readFile(path.join(root, '.claude/skills/example/SKILL.md'), 'utf8'), 'preserve');
}));

test('source refresh reads the pinned Git object, catches drift and refuses uncommitted producer changes', async () => fixture(async (root, put) => {
  const source = path.join(root, 'producer'), consumer = path.join(root, 'consumer');
  const git = (...args) => execFileSync('git', args, { cwd: source, encoding: 'utf8' }).trim();
  await put('producer/helper.mjs', 'export const version = 1;\n');
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('add', '.'); git('commit', '-qm', 'fixture');
  const commit = git('rev-parse', 'HEAD');
  const digest = createHash('sha256').update('export const version = 1;\n').digest('hex');
  await put('consumer/scripts/shared-tools.provenance.json', JSON.stringify({ sources: [{ repository: 'cats-inc/fixture', commit, files: [{ source: 'helper.mjs', path: 'scripts/helper.mjs', sha256: digest }] }] }));
  const options = { root: consumer, sources: { 'cats-inc/fixture': source } };
  await syncSharedTools({ ...options, refresh: true });
  await syncSharedTools(options);
  if (process.platform !== 'win32') {
    await chmod(path.join(consumer, 'scripts/helper.mjs'), 0o755);
    await assert.rejects(syncSharedTools({ root: consumer }), /mode drift/u);
    await chmod(path.join(consumer, 'scripts/helper.mjs'), 0o644);
  }
  await put('consumer/scripts/helper.mjs', 'drift');
  await assert.rejects(syncSharedTools({ root: consumer }), /drift/u);
  await put('producer/helper.mjs', 'uncommitted');
  await assert.rejects(syncSharedTools({ ...options, refresh: true }), /Commit source changes/u);
  assert.equal(await readFile(path.join(consumer, 'scripts/helper.mjs'), 'utf8'), 'drift');
  await put('producer/helper.mjs', 'export const version = 2;\n');
  git('add', '.'); git('commit', '-qm', 'second');
  git('replace', git('rev-parse', 'HEAD'), commit);
  await put('producer/helper.mjs', 'export const version = 1;\n');
  await assert.rejects(syncSharedTools({ ...options, refresh: true }), /Commit source changes/u);
}));

test('a non-directory second host is rejected before updating the first', async () => fixture(async (root, put) => {
  await put('AGENTS.md');
  await put('skills/example/SKILL.md', 'new');
  await put('.claude/skills/example/SKILL.md', 'preserve');
  await put('.agents/skills', 'owner file');
  await assert.rejects(syncAgentSkills({ projectRoot: root }), /must be a directory/u);
  assert.equal(await readFile(path.join(root, '.claude/skills/example/SKILL.md'), 'utf8'), 'preserve');
}));

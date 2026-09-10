const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fixture, write, addSkill, snapshot, arrangeManaged, relative } = require('../scripts/testing/workspace-fixtures.cjs');
const api = import('../scripts/shared/workspace-plan.mjs');
const inspect = async (workspace, agent = 'codex') => (await api).inspectWorkspace({ ...workspace, agent });

test('AC-2/3/8: recursive inventory preserves resources, excludes proposals/product skills, and is read-only', async t => {
  const workspace = await fixture(t);
  const before = await snapshot(workspace.base);
  const report = await inspect(workspace, 'all');
  assert.deepEqual(report.skills.map(skill => skill.name), ['a2a-handoff', 'maintain-provider-model-catalogs', 'project-memory-sync']);
  assert.equal(report.actions.length, 7);
  assert.ok(report.actions.every(action => action.action === 'create'));
  assert.equal(report.skills[1].description, 'Audit model catalogs with fixture evidence.\n');
  const resources = report.skills[0].snapshot.entries;
  assert.deepEqual(resources.find(entry => entry.path === 'data/binary.bin').content, Buffer.from([0, 255, 13, 10, 128]));
  assert.ok(resources.some(entry => entry.path === 'empty' && entry.type === 'directory'));
  assert.ok(resources.some(entry => entry.path === 'references/SKILL.md'));
  const guidance = report.desired[0].snapshot.content.toString();
  assert.match(guidance, /cats-platform\/skills\/orchestration\/a2a-handoff/);
  assert.match(guidance, /working\ndirectory/);
  assert.match(guidance, /Read only\nyour own agent-specific file/);
  assert.doesNotMatch(guidance, /\{\{/);
  assert.deepEqual(await snapshot(workspace.base), before);
});

test('AC-4: root names and file timestamps do not change desired content or digests', async t => {
  const first = await fixture(t);
  const second = await fixture(t);
  const movedRoot = path.join(second.base, 'different parent 名稱');
  await fs.rename(second.root, movedRoot);
  second.root = movedRoot;
  second.checkoutRoot = path.join(movedRoot, 'cats-one');
  await fs.utimes(relative(second.root, 'cats-platform/skills/orchestration/a2a-handoff/SKILL.md'), new Date(0), new Date(0));
  const left = await inspect(first);
  const right = await inspect(second);
  assert.deepEqual(left.desired, right.desired);
  assert.deepEqual(left.nextManaged, right.nextManaged);
  assert.ok(!right.desired[0].snapshot.content.toString().includes(second.root));
});

test('empty required roots are valid and still plan root instructions', async t => {
  const workspace = await fixture(t, { skills: false });
  const report = await inspect(workspace, 'all');
  assert.equal(report.skills.length, 0);
  assert.deepEqual(report.actions.map(action => action.path), ['AGENTS.md']);
});

test('YAML supports CRLF, BOM, literal descriptions and additional structured metadata without rewriting bytes', async t => {
  const workspace = await fixture(t);
  const content = '\uFEFF---\r\nname: a2a-handoff\r\ndescription: |-\r\n  First line.\r\n  Second line.\r\nmetadata:\r\n  tags: [handoff, fixture]\r\n---\r\nBody\r\n';
  await write(workspace.root, 'cats-platform/skills/orchestration/a2a-handoff/SKILL.md', content);
  const skill = (await inspect(workspace)).skills.find(entry => entry.name === 'a2a-handoff');
  assert.equal(skill.description, 'First line.\nSecond line.');
  assert.deepEqual(skill.snapshot.entries.find(entry => entry.path === 'SKILL.md').content, Buffer.from(content));
});

test('worktree Git file may refer to metadata outside the workspace', async t => {
  const workspace = await fixture(t);
  const checkout = path.join(workspace.root, 'cats-platform');
  await fs.rename(path.join(checkout, '.git'), path.join(workspace.base, 'external git metadata'));
  await write(checkout, '.git', `gitdir: ${path.relative(checkout, path.join(workspace.base, 'external git metadata'))}\n`);
  assert.equal((await inspect(workspace)).skills.length, 3);
});

const invalidInputs = [
  ['missing member', async w => fs.rename(path.join(w.root, 'cats-apps'), path.join(w.base, 'missing-apps')), /Required path is missing: cats-apps/],
  ['missing canonical root', async w => fs.rename(relative(w.root, 'cats-platform/skills'), relative(w.root, 'cats-platform/absent-skills')), /Required path is missing: cats-platform\/skills/],
  ['wrong package identity', w => write(w.root, 'cats-apps/package.json', '{"name":"wrong"}'), /Package identity mismatch/],
  ['missing member rules', async w => fs.rename(relative(w.root, 'cats-apps/AGENTS.md'), relative(w.root, 'cats-apps/rules.md')), /Required path is missing: cats-apps\/AGENTS.md/],
  ['malformed git pointer', async w => { await fs.rename(relative(w.root, 'cats-apps/.git'), relative(w.root, 'cats-apps/git-data')); await write(w.root, 'cats-apps/.git', 'not a worktree'); }, /Invalid Git worktree pointer/],
  ['missing Git HEAD', w => fs.rename(relative(w.root, 'cats-apps/.git/HEAD'), relative(w.root, 'cats-apps/.git/missing-head')), /ENOENT/],
  ['duplicate skill name', w => addSkill(w.root, 'cats-apps', 'skills', 'a2a-handoff'), /Duplicate skill a2a-handoff: cats-platform\/skills\/orchestration\/a2a-handoff and cats-apps\/skills\/a2a-handoff/],
  ['unsafe frontmatter name', w => write(w.root, 'cats-platform/skills/orchestration/a2a-handoff/SKILL.md', '---\nname: ../escape\ndescription: invalid\n---\n'), /Invalid skill .*name must/],
  ['directory/name mismatch', w => write(w.root, 'cats-platform/skills/orchestration/a2a-handoff/SKILL.md', '---\nname: another-name\ndescription: mismatch\n---\n'), /Directory name must match/],
  ['missing description', w => write(w.root, 'cats-platform/skills/orchestration/a2a-handoff/SKILL.md', '---\nname: a2a-handoff\n---\n'), /description must/],
  ['directory used as skill marker', w => fs.mkdir(relative(w.root, 'cats-apps/skills/SKILL.md')), /Skill marker must be a regular file/],
  ['duplicate YAML key', w => write(w.root, 'cats-platform/skills/orchestration/a2a-handoff/SKILL.md', '---\nname: a2a-handoff\nname: a2a-handoff\ndescription: duplicate\n---\n'), /Map keys must be unique/],
  ['malformed YAML', w => write(w.root, 'cats-platform/skills/orchestration/a2a-handoff/SKILL.md', '---\nname: [unclosed\ndescription: malformed\n---\n'), /Invalid skill/],
  ['YAML alias', w => write(w.root, 'cats-platform/skills/orchestration/a2a-handoff/SKILL.md', '---\nname: a2a-handoff\ndescription: &text fixture\nextra: *text\n---\n'), /Invalid skill/],
  ['bad manifest schema', async w => { w.manifest.schemaVersion = 99; await write(w.checkoutRoot, 'config/developer-workspace.json', JSON.stringify(w.manifest)); }, /Unsupported workspace manifest schema/],
  ['member traversal', async w => { w.manifest.members[3].path = '../cats-apps'; await write(w.checkoutRoot, 'config/developer-workspace.json', JSON.stringify(w.manifest)); }, /Unsafe relative path/],
  ['overlapping member', async w => { w.manifest.members[3].path = 'cats-one'; await write(w.checkoutRoot, 'config/developer-workspace.json', JSON.stringify(w.manifest)); }, /identity\/layout/],
  ['runtime product root', async w => { w.manifest.members[1].skillRoots = ['skills']; await write(w.checkoutRoot, 'config/developer-workspace.json', JSON.stringify(w.manifest)); }, /Invalid canonical skill roots/],
  ['broken template', w => write(w.checkoutRoot, 'templates/workspace/AGENTS.md.template', '{{MEMBERS}}'), /exactly one MEMBERS and one SKILLS/],
  ['malformed ownership JSON', w => write(w.root, '.cats-workspace/managed.json', '{'), /Cannot read JSON/],
  ['active writer', w => write(w.root, '.cats-workspace/writer.lock', 'busy'), /Active or interrupted workspace apply/],
  ['pending recovery', w => write(w.root, '.cats-workspace/recovery.json', '{}'), /Active or interrupted workspace apply/],
];

for (const [name, mutate, pattern] of invalidInputs) {
  test(`AC-6/8: ${name} fails without changing the fixture`, async t => {
    const workspace = await fixture(t);
    await mutate(workspace);
    const before = await snapshot(workspace.base);
    await assert.rejects(inspect(workspace), pattern);
    assert.deepEqual(await snapshot(workspace.base), before);
  });
}

test('executing checkout must be the declared cats-one member', async t => {
  const first = await fixture(t);
  const other = await fixture(t);
  await assert.rejects(inspect({ ...first, checkoutRoot: other.checkoutRoot }), /executing cats-one checkout/);
});

test('AC-7/8: custom root conflicts, identical unmanaged adoption, and fully managed no-op', async t => {
  const workspace = await fixture(t);
  const fresh = await inspect(workspace);
  await write(workspace.root, 'AGENTS.md', '# Personal instructions\n');
  const conflict = await inspect(workspace);
  assert.equal(conflict.hasConflicts, true);
  assert.equal(conflict.actions.find(action => action.path === 'AGENTS.md').action, 'conflict');
  await write(workspace.root, 'AGENTS.md', fresh.desired[0].snapshot.content);
  assert.equal((await inspect(workspace)).actions.find(action => action.path === 'AGENTS.md').action, 'adopt');
  await arrangeManaged(workspace, fresh);
  const before = await snapshot(workspace.base);
  const current = await inspect(workspace, 'all');
  assert.ok(current.actions.every(action => action.action === 'unchanged'));
  assert.equal(current.hasDrift, false);
  assert.deepEqual(await snapshot(workspace.base), before);
});

test('AC-5/7/8 planner: edits, renames and stale ownership preserve other agents and unrelated files', async t => {
  const workspace = await fixture(t);
  const original = await inspect(workspace, 'all');
  const previous = await arrangeManaged(workspace, original);
  await write(workspace.root, '.agents/skills/personal-skill/SKILL.md', 'Unmanaged personal skill');
  await write(workspace.root, 'cats-platform/skills/orchestration/a2a-handoff/data/binary.bin', Buffer.from([1, 2, 3]));
  await fs.rename(relative(workspace.root, 'cats-platform/skills/orchestration/project-memory-sync'), path.join(workspace.base, 'removed-skill'));
  await addSkill(workspace.root, 'cats-platform', 'skills/orchestration', 'replacement-skill');
  const before = await snapshot(workspace.base);
  const report = await inspect(workspace);
  assert.equal(report.actions.find(action => action.path.endsWith('/a2a-handoff')).action, 'update');
  assert.equal(report.actions.find(action => action.path.endsWith('/project-memory-sync')).action, 'remove');
  assert.equal(report.actions.find(action => action.path.endsWith('/replacement-skill')).action, 'create');
  assert.equal(report.actions.find(action => action.path === 'AGENTS.md').action, 'update');
  assert.ok(!report.actions.some(action => action.path.startsWith('.claude/') || action.path.includes('personal-skill')));
  assert.deepEqual(report.nextManaged.filter(entry => entry.agent === 'claude'), previous.filter(entry => entry.agent === 'claude'));
  assert.deepEqual(await snapshot(workspace.base), before);
  await write(workspace.root, '.agents/skills/a2a-handoff/LOCAL.md', 'Local edit');
  await write(workspace.root, '.agents/skills/project-memory-sync/LOCAL.md', 'Local edit before stale cleanup');
  const conflicts = await inspect(workspace);
  assert.equal(conflicts.actions.find(action => action.path.endsWith('/a2a-handoff')).action, 'conflict');
  assert.equal(conflicts.actions.find(action => action.path.endsWith('/project-memory-sync')).action, 'conflict');
});

const invalidOwnership = [
  ['traversal', entry => { entry.path = '../outside'; }, /Unsafe relative path/],
  ['backslash', entry => { entry.path = '.agents\\skills\\a2a-handoff'; }, /Unsafe relative path/],
  ['arbitrary deletion', entry => { entry.path = 'cats-runtime/package.json'; }, /Invalid managed destination/],
  ['unknown owner', entry => { entry.member = 'unknown'; }, /Unknown ownership member/],
  ['product source', entry => { entry.member = 'cats-runtime'; entry.source = 'skills/a2a-handoff'; }, /Invalid canonical ownership source/],
  ['source traversal', entry => { entry.source = 'skills/../a2a-handoff'; }, /Unsafe relative path/],
  ['invalid digest', entry => { entry.digest = 'sha256:invalid'; }, /Invalid ownership digest/],
  ['wrong agent', entry => { entry.agent = 'claude'; }, /Invalid managed destination/],
];
for (const [name, mutate, pattern] of invalidOwnership) {
  test(`AC-6: ownership rejects ${name} before planning`, async t => {
    const workspace = await fixture(t);
    const entries = await arrangeManaged(workspace, await inspect(workspace), ['shared', 'codex']);
    mutate(entries.find(entry => entry.agent === 'codex'));
    await write(workspace.root, '.cats-workspace/managed.json', JSON.stringify({ schemaVersion: 1, entries }));
    const before = await snapshot(workspace.base);
    await assert.rejects(inspect(workspace), pattern);
    assert.deepEqual(await snapshot(workspace.base), before);
  });
}

for (const [name, linkPath, targetPath] of [
  ['source resource', 'cats-platform/skills/orchestration/a2a-handoff/linked', 'cats-apps/skills'],
  ['destination root', '.agents', 'cats-apps/skills'],
  ['ownership directory', '.cats-workspace', 'cats-apps/skills'],
]) {
  test(`AC-6: rejects ${name} symlink/junction without following it`, async t => {
    const workspace = await fixture(t);
    await fs.symlink(relative(workspace.root, targetPath), relative(workspace.root, linkPath), process.platform === 'win32' ? 'junction' : 'dir');
    const before = await snapshot(workspace.base);
    await assert.rejects(inspect(workspace), /Linked path is not supported/);
    assert.deepEqual(await snapshot(workspace.base), before);
  });
}

test('case-only destination aliases are rejected on every filesystem', async t => {
  const workspace = await fixture(t);
  await fs.mkdir(relative(workspace.root, '.AGENTS/skills'), { recursive: true });
  await assert.rejects(inspect(workspace), /Case-insensitive path collision/);
});

test('case-colliding resource files are rejected where the filesystem can represent them', async t => {
  const workspace = await fixture(t);
  const source = 'cats-platform/skills/orchestration/a2a-handoff';
  await write(workspace.root, `${source}/Example.md`, 'first');
  await write(workspace.root, `${source}/example.md`, 'second');
  const names = await fs.readdir(relative(workspace.root, source));
  if (!names.includes('Example.md') || !names.includes('example.md')) return t.skip('Filesystem does not permit two case-only filenames');
  await assert.rejects(inspect(workspace), /Case-insensitive collision/);
});

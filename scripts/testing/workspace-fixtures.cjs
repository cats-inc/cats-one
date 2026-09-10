const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

const repository = path.resolve(__dirname, '../..');
const relative = (root, filename) => path.join(root, ...filename.split('/'));

async function write(root, filename, content) {
  const target = relative(root, filename);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

async function addSkill(root, member, source, name, description = 'Fixture maintenance skill') {
  await write(root, `${member}/${source}/${name}/SKILL.md`, `---\nname: ${name}\ndescription: ${description}\n---\n\nUse resources relative to this skill.\n`);
}

async function fixture(t, { cli = false, yaml = true, skills = true } = {}) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'cats-workspace-test-'));
  t.after(async () => {
    // Only remove the OS-created fixture directory, never a caller-supplied root.
    assert.equal(path.dirname(base), os.tmpdir());
    assert.ok(path.basename(base).startsWith('cats-workspace-test-'));
    await fs.rm(base, { recursive: true, force: true });
  });
  const root = path.join(base, 'workspace 測試');
  const checkoutRoot = path.join(root, 'cats-one');
  const manifest = JSON.parse(await fs.readFile(path.join(repository, 'config/developer-workspace.json'), 'utf8'));
  for (const member of manifest.members) {
    await write(root, `${member.path}/package.json`, `${JSON.stringify({ name: member.packageName, version: '0.0.0-fixture' })}\n`);
    await write(root, `${member.path}/AGENTS.md`, `# ${member.id} fixture rules\n`);
    await write(root, `${member.path}/.git/HEAD`, 'ref: refs/heads/fixture\n');
    for (const source of member.skillRoots) await fs.mkdir(relative(root, `${member.path}/${source}`), { recursive: true });
  }
  await write(checkoutRoot, 'config/developer-workspace.json', JSON.stringify(manifest, null, 2));
  await write(checkoutRoot, 'templates/workspace/AGENTS.md.template', await fs.readFile(path.join(repository, 'templates/workspace/AGENTS.md.template')));
  if (skills) {
    await addSkill(root, 'cats-runtime', 'developer-skills', 'maintain-provider-model-catalogs', '>\n  Audit model catalogs\n  with fixture evidence.');
    await addSkill(root, 'cats-platform', 'skills/orchestration', 'a2a-handoff');
    await addSkill(root, 'cats-platform', 'skills/orchestration', 'project-memory-sync');
    await addSkill(root, 'cats-runtime', 'skills', 'product-only');
    await write(root, 'cats-platform/skills/pending.bootstrap/SKILL.md', 'An unfinished proposal is not a skill yet.');
    await write(root, 'cats-platform/skills/orchestration/a2a-handoff/references/SKILL.md', 'A bundled resource, not another skill.');
    await write(root, 'cats-platform/skills/orchestration/a2a-handoff/data/binary.bin', Buffer.from([0, 255, 13, 10, 128]));
    await fs.mkdir(relative(root, 'cats-platform/skills/orchestration/a2a-handoff/empty'));
  }
  if (cli) {
    await write(checkoutRoot, 'scripts/workspace.mjs', await fs.readFile(path.join(repository, 'scripts/workspace.mjs')));
    await fs.cp(path.join(repository, 'scripts/shared'), path.join(checkoutRoot, 'scripts/shared'), { recursive: true });
    if (yaml) {
      for (const dependency of ['yaml', 'proper-lockfile', 'graceful-fs', 'retry', 'signal-exit']) {
        await fs.cp(path.dirname(require.resolve(`${dependency}/package.json`)), path.join(checkoutRoot, `node_modules/${dependency}`), { recursive: true });
      }
    }
  }
  return { base, root, checkoutRoot, manifest };
}

async function snapshot(root) {
  const result = [];
  async function walk(directory, prefix) {
    for (const name of (await fs.readdir(directory)).sort()) {
      const filename = path.join(directory, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const stat = await fs.lstat(filename);
      if (stat.isSymbolicLink()) result.push([rel, 'link', await fs.readlink(filename)]);
      else if (stat.isDirectory()) {
        result.push([rel, 'directory', stat.mtimeMs]);
        await walk(filename, rel);
      } else result.push([rel, 'file', stat.mtimeMs, (await fs.readFile(filename)).toString('base64')]);
    }
  }
  await walk(root, '');
  return result;
}

// Arrange legacy ownership independently of the production apply code.
async function arrangeManaged(workspace, report, agents = ['shared', 'codex', 'claude']) {
  const entries = [];
  for (const desired of report.desired.filter(entry => agents.includes(entry.agent))) {
    const destination = relative(workspace.root, desired.path);
    if (desired.snapshot.type === 'file') await write(workspace.root, desired.path, desired.snapshot.content);
    else {
      await fs.mkdir(destination, { recursive: true });
      for (const entry of desired.snapshot.entries) {
        if (entry.type === 'directory') await fs.mkdir(relative(destination, entry.path), { recursive: true });
        else await write(destination, entry.path, entry.content);
      }
    }
    const { path: output, agent, member, source, snapshot: content } = desired;
    entries.push({ path: output, agent, member, source, digest: content.digest });
  }
  await write(workspace.root, '.cats-workspace/managed.json', `${JSON.stringify({ schemaVersion: 1, entries }, null, 2)}\n`);
  return entries;
}

module.exports = { fixture, write, addSkill, snapshot, arrangeManaged, relative, repository };

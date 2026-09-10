import fs from 'node:fs/promises';
import path from 'node:path';
import {
  canonicalRoot, compare, contained, exactKeys, fileSnapshot, inspectPath,
  listEntries, readJson, readSnapshot, relativePath, requireCondition,
} from './workspace-fs.mjs';

export const TEMPLATE = 'templates/workspace/AGENTS.md.template';
export const TARGETS = { codex: '.agents/skills', claude: '.claude/skills' };
const PROFILE = {
  'cats-one': 'skills',
  'cats-runtime': 'developer-skills',
  'cats-platform': 'skills',
  'cats-apps': 'skills',
};
export const validSkillName = name => typeof name === 'string' && name.length <= 64
  && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name)
  && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/u.test(name);

function validateManifest(manifest) {
  exactKeys(manifest, ['schemaVersion', 'members'], 'workspace manifest');
  requireCondition(manifest.schemaVersion === 1 && Array.isArray(manifest.members), 'Unsupported workspace manifest schema');
  const ids = new Set();
  for (const member of manifest.members) {
    exactKeys(member, ['id', 'path', 'packageName', 'skillRoots', 'role'], 'workspace member');
    requireCondition(Object.hasOwn(PROFILE, member.id) && !ids.has(member.id), `Invalid or duplicate member: ${member.id}`);
    ids.add(member.id);
    relativePath(member.path);
    requireCondition(member.path === member.id && member.packageName === `@cats-inc/${member.id}`,
      `Member identity/layout does not match the v1 profile: ${member.id}`);
    requireCondition(Array.isArray(member.skillRoots) && member.skillRoots.length === 1
      && member.skillRoots[0] === PROFILE[member.id], `Invalid canonical skill roots: ${member.id}`);
    requireCondition(typeof member.role === 'string' && member.role.trim() && !/[|\r\n<>]/u.test(member.role),
      `Invalid member role: ${member.id}`);
  }
  requireCondition(ids.size === Object.keys(PROFILE).length, 'The v1 workspace requires all four Cats members');
  return manifest;
}

async function validateCheckout(root, member) {
  const checkout = await inspectPath(root, member.path, { kind: 'directory' });
  const pkg = await readJson(root, `${member.path}/package.json`);
  requireCondition(pkg?.name === member.packageName, `Package identity mismatch: ${member.path} must be ${member.packageName}`);
  await inspectPath(root, `${member.path}/AGENTS.md`, { kind: 'file' });
  const gitPath = await inspectPath(root, `${member.path}/.git`);
  const stat = await fs.lstat(gitPath);
  let metadata = gitPath;
  if (stat.isFile()) {
    const pointer = /^gitdir: (.+)\r?\n?$/u.exec(await fs.readFile(gitPath, 'utf8'));
    requireCondition(pointer, `Invalid Git worktree pointer: ${member.path}/.git`);
    metadata = path.resolve(checkout, pointer[1].trim());
  } else {
    requireCondition(stat.isDirectory(), `Invalid Git checkout: ${member.path}`);
  }
  // Git metadata is read-only and may legitimately be outside a worktree.
  requireCondition((await fs.stat(metadata)).isDirectory(), `Missing Git metadata: ${member.path}`);
  const head = await fs.readFile(path.join(metadata, 'HEAD'), 'utf8');
  requireCondition(/^(?:ref: refs\/[^\s]+|[a-f0-9]{40}|[a-f0-9]{64})\s*$/u.test(head),
    `Invalid Git HEAD: ${member.path}`);
  for (const source of member.skillRoots) {
    await inspectPath(root, `${member.path}/${source}`, { kind: 'directory' });
  }
  return checkout;
}

async function loadYaml() {
  try {
    return await import('yaml');
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('Missing cats-one developer dependency "yaml". Run npm ci --include=dev in the cats-one checkout, then retry. This command never installs dependencies.');
    }
    throw error;
  }
}

function skillMetadata(bytes, source, yaml) {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(bytes.toString('utf8'));
  requireCondition(match, `Missing YAML frontmatter: ${source}/SKILL.md`);
  try {
    const document = yaml.parseDocument(match[1], { strict: true, uniqueKeys: true, version: '1.2', schema: 'core' });
    requireCondition(!document.errors.length && !document.warnings.length,
      [...document.errors, ...document.warnings].map(error => error.message).join('; '));
    const value = document.toJS({ maxAliasCount: 0 });
    requireCondition(value && typeof value === 'object' && !Array.isArray(value), 'Frontmatter must be a mapping');
    requireCondition(validSkillName(value.name), 'name must be a portable lowercase skill name (1-64 characters)');
    requireCondition(typeof value.description === 'string' && value.description.trim().length > 0
      && value.description.length <= 1024, 'description must be a nonempty string of at most 1024 characters');
    requireCondition(path.posix.basename(source) === value.name, 'Directory name must match frontmatter name');
    return { name: value.name, description: value.description };
  } catch (error) {
    throw new Error(`Invalid skill ${source}/SKILL.md: ${error.message}`);
  }
}

export async function loadWorkspace({ root: rootArgument, checkoutRoot }) {
  const root = await canonicalRoot(rootArgument);
  const toolRoot = await canonicalRoot(checkoutRoot);
  const manifest = validateManifest(await readJson(toolRoot, 'config/developer-workspace.json'));
  const templatePath = await inspectPath(toolRoot, TEMPLATE, { kind: 'file' });
  const template = (await fs.readFile(templatePath, 'utf8')).replace(/\r\n/g, '\n');
  for (const member of manifest.members) {
    const checkout = await validateCheckout(root, member);
    if (member.id === 'cats-one') {
      requireCondition(await fs.realpath(checkout) === toolRoot,
        'The executing cats-one checkout must be the declared workspace member');
    }
  }
  requireCondition(contained(root, toolRoot), 'cats-one must be a strict descendant of --root');
  return { root, manifest, template };
}

export async function inventoryWorkspace(options) {
  const { root, manifest, template } = await loadWorkspace(options);
  const yaml = await loadYaml();
  const skills = [];
  const names = new Map();
  async function discover(member, source) {
    const directory = await inspectPath(root, `${member.path}/${source}`, { kind: 'directory' });
    const entries = await listEntries(directory);
    const marker = entries.find(entry => entry.name.toLowerCase() === 'skill.md');
    requireCondition(!marker || (marker.name === 'SKILL.md' && marker.isFile()),
      `Skill marker must be a regular file named SKILL.md: ${member.path}/${source}`);
    if (marker) {
      const snapshot = await readSnapshot(root, `${member.path}/${source}`);
      const metadata = skillMetadata(snapshot.entries.find(entry => entry.path === 'SKILL.md').content, `${member.path}/${source}`, yaml);
      requireCondition(!names.has(metadata.name),
        `Duplicate skill ${metadata.name}: ${names.get(metadata.name)} and ${member.path}/${source}`);
      names.set(metadata.name, `${member.path}/${source}`);
      skills.push({ ...metadata, member: member.id, source, snapshot });
      return; // Nested SKILL.md files are resources of this skill.
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.endsWith('.bootstrap')) {
        await discover(member, `${source}/${entry.name}`);
      }
    }
  }
  for (const member of manifest.members) {
    for (const source of member.skillRoots) await discover(member, source);
  }
  skills.sort((a, b) => compare(a.name, b.name));
  const memberTable = ['| Member | Responsibility |', '| --- | --- |', ...manifest.members.map(member =>
    `| \`${member.path}/\` | ${member.role} |`)].join('\n');
  const skillTable = skills.length ? ['| Skill | Owning member | Canonical source |', '| --- | --- | --- |',
    ...skills.map(skill => `| \`${skill.name}\` | \`${skill.member}\` | \`${skill.member}/${skill.source}/\` |`)].join('\n')
    : 'The declared maintenance roots currently contain no skills.';
  requireCondition(template.split('{{MEMBERS}}').length === 2 && template.split('{{SKILLS}}').length === 2,
    'Workspace template must contain exactly one MEMBERS and one SKILLS placeholder');
  const rendered = template.replace('{{MEMBERS}}', () => memberTable).replace('{{SKILLS}}', () => skillTable);
  requireCondition(!/\{\{[^}]*\}\}/u.test(rendered), 'Unknown workspace template placeholder');
  const desired = [{ path: 'AGENTS.md', agent: 'shared', member: 'cats-one', source: TEMPLATE, snapshot: fileSnapshot(rendered) }];
  for (const [agent, destination] of Object.entries(TARGETS)) {
    for (const skill of skills) {
      desired.push({ path: `${destination}/${skill.name}`, agent, member: skill.member, source: skill.source, snapshot: skill.snapshot });
    }
  }
  return { root, manifest, skills, desired };
}

const test = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const { join, relative, sep } = require('node:path');

// CI skips the launcher tests when a change touches only docs/ and the root
// agent instruction files (AGENTS.md, CLAUDE.md, CODEX.md and GEMINI.md), so no
// test, script or launcher code may read repository documentation or the
// content of those agent files.
const repoRoot = process.cwd();
const sourceFile = /\.(?:[cm]?js|[cm]?ts|tsx)$/;
const testFile = /\.test\.(?:[cm]?js|[cm]?ts|tsx)$/;
// A quoted path that starts at docs/, or a 'docs' segment passed to join/resolve.
const docsPath = /['"`](?:\.{1,2}\/)*docs\/|['"`]docs['"`]\s*[,)]/;
// A file read on a line that names a root agent instruction file by its bare
// name. Fixtures, the generated workspace AGENTS.md and existence checks use the
// same names without reading this repository's copies, and a nested AGENTS.md
// or AGENTS.md.template is a different file. The check is line-based, so a path
// built on one line and read on another is not caught.
const agentFile = /['"`](?:\.{1,2}\/)*(?:AGENTS|CLAUDE|CODEX|GEMINI)\.md['"`]/;
const fileRead = /\b(?:readFile(?:Sync)?|createReadStream|copyFile(?:Sync)?|cp(?:Sync)?)\s*\(/;
const readsAgentFile = (line) => agentFile.test(line) && fileRead.test(line);
// A single line that names docs/ or reads an agent file for another reason
// carries a trailing `docs-boundary-ignore: <reason>` comment.
const ignoreMarker = /docs-boundary-ignore: \S/;
const skippedDirectories = new Set(['node_modules', '.npm']);

function listSources(directory) {
  let entries;
  try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return skippedDirectories.has(entry.name) ? [] : listSources(path);
    return sourceFile.test(entry.name) ? [path] : [];
  });
}

function violations(matches) {
  const candidates = [
    ...['test', 'tests', 'scripts', 'bin', 'npm-alias'].flatMap((root) => listSources(join(repoRoot, root))),
    ...listSources(join(repoRoot, 'src')).filter((path) => testFile.test(path)),
  ];
  return candidates
    .map((path) => relative(repoRoot, path).split(sep).join('/'))
    .filter((path) => path !== 'test/docs-boundary.test.js')
    .flatMap((path) => readFileSync(join(repoRoot, path), 'utf8').split(/\r?\n/)
      .map((line, index) => ({ line, at: `${path}:${index + 1}` }))
      .filter(({ line }) => matches(line) && !ignoreMarker.test(line))
      .map(({ at, line }) => `${at}: ${line.trim()}`));
}

test('tests, scripts and the launcher stay independent of repository docs', () => {
  assert.deepEqual(violations((line) => docsPath.test(line)), [],
    'Move executable inputs under tests/fixtures/ instead of reading docs/.');
});

test('tests, scripts and the launcher do not read the root agent instruction files', () => {
  assert.deepEqual(violations(readsAgentFile), [],
    'Move executable inputs under tests/fixtures/ instead of reading AGENTS.md, CLAUDE.md, CODEX.md or GEMINI.md.');
});

test('the agent file check flags reads of the root agent files and nothing else', () => {
  for (const line of [
    "const rules = readFileSync('AGENTS.md', 'utf8');",
    "await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8');",
    "createReadStream(new URL('../GEMINI.md', import.meta.url));",
    "copyFileSync('./CODEX.md', target);",
  ]) assert.ok(readsAgentFile(line), line);
  for (const line of [
    "if (!(await exists(path.join(root, 'AGENTS.md')))?.isFile()) throw new Error('Project root must contain AGENTS.md.');",
    "assert.ok(existsSync(join(repoRoot, 'AGENTS.md')));",
    "await write(workspace.root, 'AGENTS.md', '# Personal instructions\\n');",
    "await fs.readFile(path.join(repository, 'templates/workspace/AGENTS.md.template'));",
    "await readFile(relative(root, 'cats-apps/AGENTS.md'));",
  ]) assert.ok(!readsAgentFile(line), line);
});

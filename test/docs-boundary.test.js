const test = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const { join, relative, sep } = require('node:path');

// CI skips the launcher tests when a change touches only docs/ or the root
// agent instructions (AGENTS.md, CLAUDE.md, CODEX.md, GEMINI.md), so no test,
// script or launcher code may read repository documentation or those files.
const repoRoot = process.cwd();
const sourceFile = /\.(?:[cm]?js|[cm]?ts|tsx)$/;
const testFile = /\.test\.(?:[cm]?js|[cm]?ts|tsx)$/;
// A quoted path that starts at docs/, or a 'docs' segment passed to join/resolve.
const docsPath = /['"`](?:\.{1,2}\/)*docs\/|['"`]docs['"`]\s*[,)]/;
// A quoted root agent instruction file. Nested copies such as sub/AGENTS.md
// and templates such as AGENTS.md.template are ordinary files that CI tests.
const agentFile = /['"`](?:\.{1,2}\/)*(?:AGENTS|CLAUDE|CODEX|GEMINI)\.md['"`]/;
// Checking that a root agent file exists does not read it; the pinned skill
// sync script requires the root AGENTS.md this way.
const existenceCheck = /\b(?:exists|l?stat|access)(?:Sync)?\(/;
const readsFile = /read/i;
// A single line that names docs/ or a root agent file without reading this
// repository's copy carries a trailing `docs-boundary-ignore: <reason>` comment.
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

function readsDocumentation(line) {
  if (ignoreMarker.test(line)) return false;
  if (docsPath.test(line)) return true;
  return agentFile.test(line) && !(existenceCheck.test(line) && !readsFile.test(line));
}

test('the guard covers root agent instructions but allows existence checks', () => {
  assert.ok(readsDocumentation("readFileSync('AGENTS.md', 'utf8');"));
  assert.ok(readsDocumentation("await readFile(path.join(root, 'CLAUDE.md'));"));
  assert.ok(readsDocumentation("readFileSync(`../GEMINI.md`);"));
  assert.ok(readsDocumentation("if (existsSync('CODEX.md')) readFileSync('CODEX.md');"));
  assert.ok(readsDocumentation("await write(root, 'AGENTS.md', 'fixture');"));
  assert.ok(!readsDocumentation("if (!(await exists(path.join(root, 'AGENTS.md')))?.isFile()) throw error;"));
  assert.ok(!readsDocumentation("readFileSync(join(root, 'sub/AGENTS.md'));"));
  assert.ok(!readsDocumentation("await fs.readFile(path.join(repository, 'templates/workspace/AGENTS.md.template'));"));
  assert.ok(!readsDocumentation("seed(root, 'AGENTS.md'); // docs-boundary-ignore: temporary project"));
});

test('tests, scripts and the launcher stay independent of repository docs', () => {
  const candidates = [
    ...['test', 'tests', 'scripts', 'bin', 'npm-alias'].flatMap((root) => listSources(join(repoRoot, root))),
    ...listSources(join(repoRoot, 'src')).filter((path) => testFile.test(path)),
  ];
  const violations = candidates
    .map((path) => relative(repoRoot, path).split(sep).join('/'))
    .filter((path) => path !== 'test/docs-boundary.test.js')
    .flatMap((path) => readFileSync(join(repoRoot, path), 'utf8').split(/\r?\n/)
      .map((line, index) => ({ line, at: `${path}:${index + 1}` }))
      .filter(({ line }) => readsDocumentation(line))
      .map(({ at, line }) => `${at}: ${line.trim()}`));
  assert.deepEqual(violations, [],
    'Move executable inputs under tests/fixtures/ instead of reading docs/ or the root agent instructions.');
});

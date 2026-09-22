const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const canonical = require('../package.json');

test('alias version and exact dependency follow every canonical release', async () => {
  const { createAliasManifest } = await import('../scripts/prepare-npm-alias.mjs');
  for (const version of [canonical.version, '0.2.7-next.1']) {
    const manifest = createAliasManifest({ ...canonical, version });
    assert.equal(manifest.name, 'cats-one');
    assert.equal(manifest.version, version);
    assert.deepEqual(manifest.dependencies, { '@cats-inc/cats-one': version });
  }
});

test('prepared alias forwards arguments, environment, output and exit status', async (t) => {
  const { prepareNpmAlias } = await import('../scripts/prepare-npm-alias.mjs');
  const fixture = mkdtempSync(join(tmpdir(), 'cats npm alias '));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const { directory } = prepareNpmAlias(join(fixture, 'alias'));
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  assert.equal(manifest.version, canonical.version);
  for (const name of ['README.md', 'LICENSE']) {
    assert.equal(readFileSync(join(directory, name), 'utf8'), readFileSync(join(__dirname, '..', name), 'utf8'));
  }

  const target = join(directory, 'node_modules', '@cats-inc', 'cats-one', 'bin');
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'cli.js'), `
    console.log(JSON.stringify({ args: process.argv.slice(2), marker: process.env.CATS_ALIAS_TEST_MARKER }));
    console.error('canonical stderr');
    process.exit(23);
  `);
  const args = ['--platform-only', '--label', 'spaces 中文', '$literal'];
  const result = spawnSync(process.execPath, [join(directory, manifest.bin['cats-one']), ...args], {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, CATS_ALIAS_TEST_MARKER: 'forwarded' },
  });
  assert.equal(result.status, 23, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { args, marker: 'forwarded' });
  assert.equal(result.stderr.trim(), 'canonical stderr');
});

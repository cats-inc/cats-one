const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { delimiter, dirname, join, resolve } = require('node:path');
const { parse } = require('yaml');

// CI skips the matrix and test job for documentation (docs/ and the root agent
// instruction files) and for code whose fingerprint already passed. A push to
// main skips them only when its merged pull request already passed on the same
// tree, and npm publication skips its gate only when CI on the commit on main
// tested that exact code, not when it skipped for documentation alone. These
// tests run the workflows' own shell steps against scratch
// repositories, a local origin and a stubbed gh.
const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
const publish = parse(readFileSync('.github/workflows/npm-publish.yml', 'utf8'));
const bash = process.platform === 'win32'
  ? resolve(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), '../../../bin/bash.exe')
  : 'bash';

function runStep(script, cwd, env) {
  const output = join(mkdtempSync(join(tmpdir(), 'cats-ci-output-')), 'output');
  writeFileSync(output, '');
  try {
    const result = spawnSync(bash, ['-e', '-o', 'pipefail', '-c', script], {
      cwd, encoding: 'utf8', env: { ...process.env, ...env, GITHUB_OUTPUT: output.replaceAll('\\', '/') },
    });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    return readFileSync(output, 'utf8').trim();
  } finally {
    rmSync(dirname(output), { recursive: true, force: true });
  }
}

// A scratch repository with helpers that write, remove and commit its files.
function scratchRepository(t, prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const work = join(root, 'work');
  const git = (cwd, ...args) => execFileSync('git', [
    '-c', 'user.name=CI Test', '-c', 'user.email=ci@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args,
  ], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (path, content) => {
    mkdirSync(dirname(join(work, path)), { recursive: true });
    writeFileSync(join(work, path), content);
  };
  const remove = (path) => rmSync(join(work, path));
  const commit = (message) => {
    git(work, 'add', '--all');
    git(work, 'commit', '-m', message);
    return git(work, 'rev-parse', 'HEAD');
  };
  // Commit a tracked file's change into a symbolic link through the index alone,
  // which needs no symbolic link support from the filesystem.
  const commitTypeChange = (path, message) => {
    git(work, 'update-index', '--cacheinfo', `120000,${git(work, 'rev-parse', `HEAD:${path}`)},${path}`);
    git(work, 'commit', '-m', message);
    return git(work, 'rev-parse', 'HEAD');
  };
  mkdirSync(work);
  git(work, 'init', '--initial-branch=main');
  return { root, work, git, write, remove, commit, commitTypeChange };
}

// The scratch repositories' own agent files and documentation.
const [AGENTS, CLAUDE, CODEX, GEMINI] = ['AGENTS.md', 'CLAUDE.md', 'CODEX.md', 'GEMINI.md']; // docs-boundary-ignore: scratch repository
const [GUIDE, USAGE] = ['docs/guide.md', 'docs/使用說明.md']; // docs-boundary-ignore: scratch repository

function stubGh(bin) {
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'gh'), [
    '#!/usr/bin/env bash',
    'printf \'%s\\n\' "$2" >> "$STUB_LOG"',
    'case "$2" in',
    '  */pulls) [ -n "${STUB_PULLS:-}" ] || exit 1; printf \'%s\\n\' "$STUB_PULLS" ;;',
    '  */actions/workflows/*) [ -n "${STUB_PASSED:-}" ] || exit 1; printf \'%s\\n\' "$STUB_PASSED" ;;',
    '  */actions/runs/*/jobs*) [ -n "${STUB_JOBS:-}" ] || exit 1; printf \'%s\\n\' "$STUB_JOBS" ;;',
    '  *) exit 1 ;;',
    'esac',
  ].join('\n') + '\n', { mode: 0o755 });
}

test('documentation is docs/ plus root agent instruction files that still exist at HEAD', (t) => {
  const paths = ci.jobs.changes.steps.find((step) => step.id === 'paths');
  const { work, git, write, remove, commit, commitTypeChange } = scratchRepository(t, 'cats-ci-paths-');
  write('bin/cli.js', 'launcher\n');
  write(AGENTS, 'shared rules\n');
  write(CLAUDE, 'Claude rules\n');
  write(CODEX, 'Codex rules\n');
  write('sub/AGENTS.md', 'nested rules\n');
  write(GUIDE, 'guide\n');
  const base = commit('base');
  const detect = (change, event = 'push') => {
    git(work, 'checkout', '--quiet', '--force', '--detach', base);
    change();
    commit('change');
    return runStep(paths.run, work, { EVENT: event, BEFORE: base });
  };
  assert.equal(detect(() => write(AGENTS, 'edited shared rules\n')), 'code=false',
    'a root AGENTS.md edit is documentation');
  const failingDiff = 'git() { case " $* " in *" --diff-filter="*) return 128 ;; esac; command git "$@"; }\n';
  assert.equal(runStep(failingDiff + paths.run, work, { EVENT: 'push', BEFORE: base }), 'code=true',
    'a failed git diff runs everything');
  assert.equal(detect(() => write(AGENTS, 'edited shared rules\n'), 'pull_request'), 'code=false');
  assert.equal(detect(() => {
    write(CLAUDE, 'edited Claude rules\n');
    write(GEMINI, 'new Gemini rules\n');
    write(GUIDE, 'edited guide\n');
  }), 'code=false', 'added and edited agent files with docs are documentation');
  assert.equal(detect(() => write(USAGE, 'usage\n')), 'code=false', 'a non-ASCII docs/ path is documentation');
  assert.equal(detect(() => remove(CLAUDE)), 'code=true', 'a deleted root CLAUDE.md is code');
  assert.equal(detect(() => git(work, 'mv', CODEX, 'docs/CODEX.md')), 'code=true', // docs-boundary-ignore: scratch repository
    'a root CODEX.md moved into docs/ is code');
  assert.equal(detect(() => git(work, 'mv', 'bin/cli.js', 'docs/cli.js')), 'code=true', // docs-boundary-ignore: scratch repository
    'code moved into docs/ is code');
  assert.equal(detect(() => write('sub/AGENTS.md', 'edited nested rules\n')), 'code=true',
    'a nested sub/AGENTS.md is code');
  assert.equal(detect(() => {
    write(AGENTS, 'edited shared rules\n');
    write('bin/cli.js', 'edited launcher\n');
  }), 'code=true');
  assert.equal(detect(() => write(AGENTS, 'edited shared rules\n'), 'workflow_dispatch'), 'code=true',
    'a manual run runs everything');
  git(work, 'checkout', '--quiet', '--force', '--detach', base);
  commitTypeChange(AGENTS, 'AGENTS.md becomes a link');
  assert.equal(runStep(paths.run, work, { EVENT: 'push', BEFORE: base }), 'code=true',
    'a root AGENTS.md type change is code');
  assert.equal(runStep(paths.run, work, { EVENT: 'push', BEFORE: '' }), 'code=true', 'an unknown base runs everything');
  assert.equal(runStep(paths.run, work, { EVENT: 'push', BEFORE: 'f'.repeat(40) }), 'code=true',
    'a base missing from the clone runs everything');
});

test('the fingerprint keeps root agent instruction files by presence, not content', (t) => {
  const fingerprint = ci.jobs.changes.steps.find((step) => step.id === 'fingerprint');
  const green = ci.jobs.changes.steps.find((step) => step.id === 'green');
  const save = ci.jobs['record-tested'].steps.find((step) => step.uses === 'actions/cache/save@v4');
  // The agent-file placeholder changed the fingerprint format, hence v2 markers.
  assert.equal(green.with.key, 'ci-green-v2-${{ steps.fingerprint.outputs.fingerprint }}');
  assert.equal(save.with.key, 'ci-green-v2-${{ needs.changes.outputs.fingerprint }}');
  const { work, write, remove, commit, commitTypeChange } = scratchRepository(t, 'cats-ci-fingerprint-');
  const print = () => runStep(fingerprint.run, work, {});
  write('bin/cli.js', 'launcher\n');
  write(AGENTS, 'shared rules\n');
  write('sub/AGENTS.md', 'nested rules\n');
  write(GUIDE, 'guide\n');
  commit('base');
  const base = print();
  assert.match(base, /^fingerprint=[0-9a-f]{64}$/);
  write(AGENTS, 'edited shared rules\n');
  commit('edit AGENTS.md');
  assert.equal(print(), base, 'an AGENTS.md content edit keeps the fingerprint');
  write(GUIDE, 'edited guide\n');
  write(USAGE, 'usage\n');
  commit('edit docs');
  assert.equal(print(), base, 'edits under docs/, including non-ASCII paths, keep the fingerprint');
  write(CLAUDE, 'Claude rules\n');
  commit('add CLAUDE.md');
  const withClaude = print();
  assert.notEqual(withClaude, base, 'adding an agent file changes the fingerprint');
  write(CLAUDE, 'edited Claude rules\n');
  commit('edit CLAUDE.md');
  assert.equal(print(), withClaude);
  remove(CLAUDE);
  commit('delete CLAUDE.md');
  assert.equal(print(), base, 'deleting an agent file changes the fingerprint back');
  write('sub/AGENTS.md', 'edited nested rules\n');
  commit('edit sub/AGENTS.md');
  const nested = print();
  assert.notEqual(nested, base, 'a nested AGENTS.md is code');
  write('bin/cli.js', 'edited launcher\n');
  commit('edit launcher');
  const launcher = print();
  assert.notEqual(launcher, nested);
  commitTypeChange(AGENTS, 'AGENTS.md becomes a link');
  assert.notEqual(print(), launcher, 'an agent file type change changes the fingerprint');
});

test('a main push reuses its merged pull request\'s green run only for that exact tree on the previous main', (t) => {
  const changes = ci.jobs.changes;
  const merged = changes.steps.find((step) => step.id === 'merged');
  assert.equal(merged.if, "github.event_name == 'push' && steps.paths.outputs.code == 'true'");
  assert.deepEqual(changes.permissions, { contents: 'read', 'pull-requests': 'read', actions: 'read' });
  assert.equal(changes.outputs.tested,
    "${{ steps.green.outputs.cache-hit == 'true' || steps.merged.outputs.tested == 'true' }}");
  const { root, work, git, write, commit } = scratchRepository(t, 'cats-ci-merged-');
  const origin = join(root, 'origin.git');
  const bin = join(root, 'bin');
  git(root, 'init', '--bare', '--initial-branch=main', origin);
  git(work, 'remote', 'add', 'origin', origin);
  write('bin/cli.js', 'base\n');
  const base = commit('base');
  // Pull request #7 is up to date with main, so its squash lands the same tree.
  git(work, 'switch', '-c', 'pr-7');
  write('bin/cli.js', 'pull request seven\n');
  const head7 = commit('pr 7');
  git(work, 'push', '--quiet', 'origin', `${head7}:refs/pull/7/head`);
  git(work, 'switch', 'main');
  git(work, 'merge', '--squash', 'pr-7');
  const squash7 = commit('squash #7');
  // Pull request #8 branched from the old main, and main moved before its squash.
  git(work, 'switch', '-c', 'pr-8', base);
  write('scripts/other.mjs', 'pull request eight\n');
  const head8 = commit('pr 8');
  git(work, 'push', '--quiet', 'origin', `${head8}:refs/pull/8/head`);
  git(work, 'switch', 'main');
  git(work, 'merge', '--squash', 'pr-8');
  const squash8 = commit('squash #8');
  stubGh(bin);
  const reuse = (head, before, pulls, passed) => {
    git(work, 'checkout', '--quiet', head);
    return runStep(merged.run, work, {
      PATH: `${bin}${delimiter}${process.env.PATH}`, REPO: 'cats-inc/cats-one', BEFORE: before,
      STUB_PULLS: pulls, STUB_PASSED: passed, STUB_LOG: join(root, 'gh.log'),
    });
  };
  assert.equal(reuse(squash7, base, `7 ${head7}`, '1'), 'tested=true');
  assert.match(readFileSync(join(root, 'gh.log'), 'utf8'),
    new RegExp(`actions/workflows/ci\\.yml/runs\\?head_sha=${head7}&event=pull_request&status=success`));
  assert.equal(reuse(squash7, base, `7 ${head7}`, '0'), 'tested=false', 'the pull request must have passed CI');
  assert.equal(reuse(squash7, base, '', '1'), 'tested=false', 'a failed lookup runs every check');
  assert.equal(reuse(squash7, base, `7 ${head8}`, '1'), 'tested=false', 'the reported head must be the pull request ref');
  assert.equal(reuse(squash7, base, `9 ${head7}`, '1'), 'tested=false', 'an unknown pull request ref runs every check');
  assert.equal(reuse(squash7, '', `7 ${head7}`, '1'), 'tested=false');
  assert.equal(reuse(squash8, base, `8 ${head8}`, '1'), 'tested=false', 'a push of several commits runs every check');
  assert.equal(reuse(squash8, squash7, `8 ${head8}`, '1'), 'tested=false',
    'a head without the previous main was tested on other code');
});

test('CI records which skip applied in steps that npm publication reads', () => {
  const changes = ci.jobs.changes;
  const tested = changes.steps.find((step) => step.name === 'Already tested');
  const documentation = changes.steps.find((step) => step.name === 'Documentation-only change');
  // The tested skip mirrors the job's tested output; documentation is code=false.
  assert.equal(`\${{ ${tested.if} }}`, changes.outputs.tested);
  assert.equal(documentation.if, "steps.paths.outputs.code == 'false'");
  for (const step of [tested, documentation]) {
    assert.equal(step.id, undefined, step.name);
    assert.match(step.run, /^echo /, step.name);
    assert.ok(changes.steps.indexOf(step) > changes.steps.findIndex((other) => other.id === 'merged'), step.name);
  }
  // The publish lookup finds CI's test job by name, so that job keeps its key as its name.
  assert.equal(ci.jobs.test.name, undefined);
});

test('npm publication skips its test gate only after CI tested this exact code on main', (t) => {
  assert.equal(publish.permissions.actions, 'read');
  const steps = publish.jobs.publish.steps;
  for (const name of ['Install dependencies', 'Run test gate']) {
    assert.equal(steps.find((step) => step.name === name)?.if, "steps.ci.outputs.tested != 'true'", name);
  }
  const check = steps.find((step) => step.id === 'ci');
  assert.equal(check.if, undefined, 'the lookup itself always runs');
  assert.ok(steps.indexOf(check) < steps.findIndex((step) => step.name === 'Install dependencies'));
  const root = mkdtempSync(join(tmpdir(), 'cats-publish-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  stubGh(bin);
  const sha = 'a'.repeat(40);
  const lookup = (runs, jobs) => runStep(check.run, root, {
    PATH: `${bin}${delimiter}${process.env.PATH}`, GITHUB_REPOSITORY: 'cats-inc/cats-one', GITHUB_SHA: sha,
    STUB_PASSED: runs, STUB_JOBS: jobs, STUB_LOG: join(root, 'gh.log'),
  });
  // The stub prints the jobs filter's result: one "<name>=<conclusion>" line for
  // the test job and each of the changes job's skip steps.
  const ran = ['test=success', 'Already tested=skipped', 'Documentation-only change=skipped'].join('\n');
  const reused = ['test=skipped', 'Already tested=success', 'Documentation-only change=skipped'].join('\n');
  const documentation = ['test=skipped', 'Already tested=skipped', 'Documentation-only change=success'].join('\n');
  assert.equal(lookup('42', ran), 'tested=true', 'a run whose test job passed tested this code');
  const log = readFileSync(join(root, 'gh.log'), 'utf8');
  assert.match(log, new RegExp(`actions/workflows/ci\\.yml/runs\\?head_sha=${sha}&event=push&branch=main&status=success`));
  assert.match(log, /actions\/runs\/42\/jobs\?filter=latest/);
  assert.equal(lookup('42', reused), 'tested=true', 'a green marker or merged pull request run tested this exact code');
  assert.equal(lookup('42', documentation), 'tested=false', 'a documentation-only skip runs the gate');
  assert.equal(lookup('42', 'test=success\nDocumentation-only change=success'), 'tested=false',
    'a documentation-only run never counts');
  assert.equal(lookup('42', 'test=skipped'), 'tested=false', 'a skip with no recorded reason runs the gate');
  assert.equal(lookup('42', ''), 'tested=false', 'a failed job lookup runs the gate');
  assert.equal(lookup('', ran), 'tested=false', 'without a passing main run the gate runs as before');
  assert.equal(lookup('not-a-run', ran), 'tested=false');
});

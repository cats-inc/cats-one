const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { runLauncher, isHealthy } = require('../bin/cli.js');

const serviceSource = `
const { appendFileSync, readFileSync } = require('node:fs');
const { createServer } = require('node:http');
const runtime = process.argv[2] === 'runtime';
const name = runtime ? 'runtime' : 'platform';
const record = text => appendFileSync(process.env.FIXTURE_LOG, name + '.' + text + '\\n');
let closing = false;
let server;
const close = reason => {
  if (closing) return;
  if (!runtime && process.env.IGNORE_STOP) return;
  closing = true;
  record('closing:' + reason);
  setTimeout(() => {
    record('cleaned');
    if (server) server.close(() => process.exit(0));
    else process.exit(0);
  }, 25);
};
if (runtime) {
  if (process.env.CATS_RUNTIME_STARTUP_MODE !== 'app-managed') throw Error('unmanaged runtime');
  if (process.env.CATS_RUNTIME_MANAGED_BY !== 'cats-one') throw Error('wrong owner');
  process.stdin.resume();
  process.stdin.on('end', () => close('eof'));
  record('starting');
  if (!process.env.NEVER_READY) {
    server = createServer((req, res) => { res.end('ok'); });
    server.listen(Number(process.env.CATS_RUNTIME_PORT), '127.0.0.1', () => record('ready'));
  }
  if (process.env.CRASH_RUNTIME) setInterval(() => {
    if (readFileSync(process.env.FIXTURE_LOG, 'utf8').includes('platform.ready')) process.exit(7);
  }, 10);
} else {
  process.on('message', message => {
    if (message.type === 'cats.shutdown') close('ipc');
  });
  process.on('disconnect', () => close('disconnect'));
  record('args:' + JSON.stringify(process.argv.slice(3)));
  record('ready');
  if (process.env.AUTO_QUIT) setTimeout(() => close('keyboard'), 25);
}
`;

async function fixture(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cats-launcher-lifecycle-'));
  const source = join(root, 'service.cjs');
  const logFile = join(root, 'lifecycle.log');
  writeFileSync(source, serviceSource);
  writeFileSync(logFile, '');
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const children = [];
  const messages = [];
  const events = new EventEmitter();
  let run;
  const readLog = () => readFileSync(logFile, 'utf8');
  const waitFor = async marker => {
    const deadline = Date.now() + 15_000;
    while (!readLog().includes(marker)) {
      if (Date.now() > deadline) assert.fail('Timed out waiting for ' + marker + '\n' + readLog());
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };
  t.after(async () => {
    events.emit('SIGTERM');
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        const closed = new Promise(resolve => child.once('close', resolve));
        child.kill('SIGKILL');
        await closed;
      }
    }
    await run;
    rmSync(root, { recursive: true, force: true });
  });
  return {
    port, events, messages, children, readLog, waitFor,
    start(extra = {}) {
      run = runLauncher({
        args: [], events, input: { isTTY: false }, log: message => messages.push(message),
        env: { ...process.env, HOME: root, USERPROFILE: root, FIXTURE_LOG: logFile,
          CATS_RUNTIME_BASE_URL: 'http://127.0.0.1:' + port, ...overrides },
        resolveBin: name => name.endsWith('cats-runtime') ? 'runtime' : 'platform',
        spawnImpl(command, args, options) {
          const name = args[0];
          const child = spawn(command, [source, name, ...args.slice(1)], {
            ...options, cwd: root,
            stdio: options.stdio.map(entry => entry === 'inherit' ? 'pipe' : entry),
          });
          child.stdout.resume();
          child.stderr.resume();
          children.push(child);
          return child;
        },
        ...extra,
      });
      return run;
    },
  };
}

test('Platform keyboard exit drains Platform before its owned Runtime and forwards --no-open', { timeout: 20_000 }, async t => {
  const f = await fixture(t, { AUTO_QUIT: '1' });
  assert.equal(await f.start({ args: ['--no-open'] }), 0);
  const log = f.readLog();
  assert.match(log, /platform.args:\["--no-open"\]/);
  assert.ok(log.indexOf('platform.cleaned') < log.indexOf('runtime.closing:eof'));
  assert.match(log, /runtime.cleaned/);
  assert.equal(await isHealthy('http://127.0.0.1:' + f.port + '/health'), false);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(signal + ' requests graceful cleanup once through IPC and EOF', { timeout: 20_000 }, async t => {
    const f = await fixture(t);
    const run = f.start();
    await f.waitFor('platform.ready');
    f.events.emit(signal);
    f.events.emit(signal);
    assert.equal(await run, 0);
    assert.equal(f.readLog().split('platform.closing:ipc').length - 1, 1);
    assert.ok(f.readLog().indexOf('platform.cleaned') < f.readLog().indexOf('runtime.closing:eof'));
    assert.equal(f.events.listenerCount('SIGINT'), 0);
    assert.equal(f.events.listenerCount('SIGTERM'), 0);
  });
}

test('an already healthy Runtime is reused and survives the launcher exit', { timeout: 20_000 }, async t => {
  const f = await fixture(t, { AUTO_QUIT: '1' });
  const server = createServer((req, res) => res.end('ok'));
  await new Promise(resolve => server.listen(f.port, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  assert.equal(await f.start(), 0);
  assert.equal(f.children.length, 1);
  assert.equal(await isHealthy('http://127.0.0.1:' + f.port + '/health'), true);
});

test('cancellation before Runtime readiness stops it without launching Platform', { timeout: 20_000 }, async t => {
  const f = await fixture(t, { NEVER_READY: '1' });
  const run = f.start();
  await f.waitFor('runtime.starting');
  f.events.emit('SIGINT');
  assert.equal(await run, 0);
  assert.equal(f.children.length, 1);
  assert.match(f.readLog(), /runtime.cleaned/);
});

test('an unexpected owned Runtime exit stops Platform and fails the launcher', { timeout: 20_000 }, async t => {
  const f = await fixture(t, { CRASH_RUNTIME: '1' });
  assert.notEqual(await f.start(), 0);
  assert.match(f.readLog(), /platform.closing:ipc/);
  assert.match(f.readLog(), /platform.cleaned/);
});

test('a failed Platform spawn still cleans up the owned Runtime', { timeout: 20_000 }, async t => {
  const f = await fixture(t);
  const normalSpawn = spawn;
  let calls = 0;
  const run = f.start({ spawnImpl(command, args, options) {
    calls++;
    if (calls === 2) throw new Error('fixture spawn failure');
    const child = normalSpawn(command, ['-e', "process.stdin.resume(); process.stdin.on('end', () => process.exit(0)); require('node:http').createServer((q,r) => r.end('ok')).listen(Number(process.env.CATS_RUNTIME_PORT), '127.0.0.1');"], options);
    f.children.push(child);
    return child;
  } });
  assert.equal(await run, 1);
  assert.match(f.messages.join('\n'), /fixture spawn failure/);
  assert.equal(f.children[0].exitCode, 0);
});

test('a child that ignores cleanup is force-stopped after a bounded wait', { timeout: 20_000 }, async t => {
  const f = await fixture(t, { IGNORE_STOP: '1' });
  const run = f.start({ shutdownTimeoutMs: 150 });
  await f.waitFor('platform.ready');
  f.events.emit('SIGTERM');
  assert.equal(await run, 1);
  assert.match(f.messages.join('\n'), /forcing its exit/);
  assert.match(f.readLog(), /runtime.cleaned/);
});

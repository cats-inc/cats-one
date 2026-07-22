const test = require('node:test');
const assert = require('node:assert/strict');

const { pickPlatformBin, pickRuntimeBin, waitForHealth, isHealthy } = require('../bin/cli.js');

test('accepts a string bin declaration', () => {
  assert.equal(pickPlatformBin({ bin: 'build/server/index.js' }), 'build/server/index.js');
});

test('resolves the canonical cats-platform bin key', () => {
  assert.equal(
    pickPlatformBin({ bin: { 'cats-platform': 'build/server/index.js' } }),
    'build/server/index.js',
  );
});

test('rejects a manifest without the cats-platform bin entry', () => {
  assert.throws(() => pickPlatformBin({ bin: { cats: './legacy.js' } }), /cats-platform/);
  assert.throws(() => pickPlatformBin({ bin: {} }), /cats-platform/);
  assert.throws(() => pickPlatformBin({}), /cats-platform/);
});

test('matches the real @cats-inc/cats-platform contract when the sibling checkout exists', (t) => {
  let manifest;
  try {
    manifest = require('../../cats-platform/package.json');
  } catch {
    t.skip('sibling cats-platform checkout not available');
    return;
  }
  assert.equal(pickPlatformBin(manifest), 'build/server/index.js');
});

test('resolves the canonical cats-runtime bin key', () => {
  assert.equal(
    pickRuntimeBin({ bin: { 'cats-runtime': 'build/runtime/index.js' } }),
    'build/runtime/index.js',
  );
  assert.equal(pickRuntimeBin({ bin: 'build/runtime/index.js' }), 'build/runtime/index.js');
});

test('rejects a manifest without the cats-runtime bin entry', () => {
  assert.throws(() => pickRuntimeBin({ bin: {} }), /cats-runtime/);
  assert.throws(() => pickRuntimeBin({}), /cats-runtime/);
});

test('matches the real @cats-inc/cats-runtime contract when the sibling checkout exists', (t) => {
  let manifest;
  try {
    manifest = require('../../cats-runtime/package.json');
  } catch {
    t.skip('sibling cats-runtime checkout not available');
    return;
  }
  assert.equal(pickRuntimeBin(manifest), 'build/runtime/index.js');
  assert.equal(manifest.exports['./package.json'], './package.json');
});

test('waitForHealth resolves once the endpoint reports ok', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: calls >= 3 };
  };
  const healthy = await waitForHealth('http://127.0.0.1:9/health', {
    timeoutMs: 5_000,
    intervalMs: 1,
    fetchImpl,
  });
  assert.equal(healthy, true);
  assert.equal(calls, 3);
});

test('waitForHealth gives up on timeout and on shouldStop', async () => {
  const failingFetch = async () => { throw new Error('down'); };
  assert.equal(
    await waitForHealth('http://127.0.0.1:9/health', {
      timeoutMs: 30,
      intervalMs: 1,
      fetchImpl: failingFetch,
    }),
    false,
  );
  assert.equal(
    await waitForHealth('http://127.0.0.1:9/health', {
      timeoutMs: 5_000,
      intervalMs: 1,
      fetchImpl: failingFetch,
      shouldStop: () => true,
    }),
    false,
  );
});

test('isHealthy swallows connection errors', async () => {
  assert.equal(await isHealthy('http://127.0.0.1:9/health', async () => { throw new Error('x'); }), false);
  assert.equal(await isHealthy('http://127.0.0.1:9/health', async () => ({ ok: true })), true);
});

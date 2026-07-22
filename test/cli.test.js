const test = require('node:test');
const assert = require('node:assert/strict');

const { pickPlatformBin } = require('../bin/cli.js');

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

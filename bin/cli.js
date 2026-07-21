#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

function resolvePlatformBin() {
  const manifestPath = require.resolve('@cats-inc/cats-platform/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const relativeBin = typeof manifest.bin === 'string'
    ? manifest.bin
    : manifest.bin?.['cats-platform'] ?? manifest.bin?.cats ?? Object.values(manifest.bin ?? {})[0];

  if (!relativeBin) {
    throw new Error('Unable to resolve the cats executable from @cats-inc/cats-platform.');
  }

  return resolve(dirname(manifestPath), relativeBin);
}

let platformBinPath;

try {
  platformBinPath = resolvePlatformBin();
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(
    `cats-one could not find @cats-inc/cats-platform. Reinstall cats-one or run npx cats-one again.\n${detail}`,
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [platformBinPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  windowsHide: true,
});

if (result.error) {
  const detail = result.error instanceof Error ? result.error.message : String(result.error);
  console.error(`cats-one failed to launch Cats: ${detail}`);
  process.exit(1);
}

process.exit(result.status ?? 1);

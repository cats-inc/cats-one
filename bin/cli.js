#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

function pickPlatformBin(manifest) {
  if (typeof manifest.bin === 'string') {
    return manifest.bin;
  }

  const relativeBin = manifest.bin?.['cats-platform'];

  if (!relativeBin) {
    throw new Error(
      '@cats-inc/cats-platform does not declare the required "cats-platform" bin entry.',
    );
  }

  return relativeBin;
}

function resolvePlatformBin() {
  const manifestPath = require.resolve('@cats-inc/cats-platform/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  return resolve(dirname(manifestPath), pickPlatformBin(manifest));
}

function main() {
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
}

if (require.main === module) {
  main();
}

module.exports = { pickPlatformBin };

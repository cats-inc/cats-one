#!/usr/bin/env node
const { spawn } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

const DEFAULT_RUNTIME_BASE_URL = 'http://127.0.0.1:3110';
const RUNTIME_READY_TIMEOUT_MS = 60_000;

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

function pickRuntimeBin(manifest) {
  if (typeof manifest.bin === 'string') {
    return manifest.bin;
  }

  const relativeBin = manifest.bin?.['cats-runtime'];

  if (!relativeBin) {
    throw new Error(
      '@cats-inc/cats-runtime does not declare the required "cats-runtime" bin entry.',
    );
  }

  return relativeBin;
}

function resolvePackageBin(packageName, picker) {
  const manifestPath = require.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  return resolve(dirname(manifestPath), picker(manifest));
}

async function isHealthy(url, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(url, {
  timeoutMs = RUNTIME_READY_TIMEOUT_MS,
  intervalMs = 500,
  fetchImpl = fetch,
  shouldStop = () => false,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (shouldStop()) {
      return false;
    }
    if (await isHealthy(url, fetchImpl)) {
      return true;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs));
  }
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const platformOnly = args.includes('--platform-only');
  const platformArgs = args.filter((arg) => arg !== '--platform-only');
  const runtimeBaseUrl = (process.env.CATS_RUNTIME_BASE_URL || DEFAULT_RUNTIME_BASE_URL)
    .replace(/\/+$/, '');
  const runtimeHealthUrl = `${runtimeBaseUrl}/health`;

  let platformBinPath;
  let runtimeBinPath = null;

  try {
    platformBinPath = resolvePackageBin('@cats-inc/cats-platform', pickPlatformBin);
    if (!platformOnly) {
      runtimeBinPath = resolvePackageBin('@cats-inc/cats-runtime', pickRuntimeBin);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      `cats-one could not resolve its Cats packages. Reinstall cats-one or run npx cats-one again.\n${detail}`,
    );
    process.exit(1);
  }

  let runtimeChild = null;
  let runtimeExitedEarly = false;
  let shuttingDown = false;

  const stopRuntime = () => {
    if (runtimeChild && runtimeChild.exitCode === null && !runtimeChild.killed) {
      runtimeChild.kill();
    }
  };

  if (!platformOnly) {
    if (await isHealthy(runtimeHealthUrl)) {
      console.error(`cats-one: reusing the cats-runtime already serving ${runtimeBaseUrl}`);
    } else {
      console.error(`cats-one: starting cats-runtime (${runtimeBaseUrl})`);
      runtimeChild = spawn(process.execPath, [runtimeBinPath], {
        stdio: 'inherit',
        env: process.env,
        windowsHide: true,
      });
      runtimeChild.on('exit', (code) => {
        if (!shuttingDown) {
          runtimeExitedEarly = true;
          console.error(`cats-one: cats-runtime exited unexpectedly (code ${code ?? 'unknown'})`);
        }
      });

      const ready = await waitForHealth(runtimeHealthUrl, {
        shouldStop: () => runtimeExitedEarly,
      });
      if (!ready) {
        console.error(
          `cats-one: cats-runtime did not become healthy at ${runtimeHealthUrl} within ${RUNTIME_READY_TIMEOUT_MS / 1000}s.`,
        );
        shuttingDown = true;
        stopRuntime();
        process.exit(1);
      }
      console.error('cats-one: cats-runtime is healthy');
    }
  }

  console.error('cats-one: starting cats-platform');
  const platformChild = spawn(process.execPath, [platformBinPath, ...platformArgs], {
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  });

  const stopAll = () => {
    shuttingDown = true;
    if (platformChild.exitCode === null && !platformChild.killed) {
      platformChild.kill();
    }
    stopRuntime();
  };
  process.on('SIGINT', stopAll);
  process.on('SIGTERM', stopAll);

  runtimeChild?.on('exit', () => {
    if (!shuttingDown) {
      // The runtime died under the platform; fail loudly instead of leaving a
      // half-working stack behind. Supervision/restart policy is future work.
      stopAll();
      process.exitCode = 1;
    }
  });

  platformChild.on('exit', (code) => {
    shuttingDown = true;
    stopRuntime();
    process.exit(process.exitCode ?? code ?? 1);
  });
}

if (require.main === module) {
  main();
}

module.exports = { pickPlatformBin, pickRuntimeBin, waitForHealth, isHealthy };

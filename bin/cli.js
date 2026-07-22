#!/usr/bin/env node
const { spawn } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

const DEFAULT_RUNTIME_HOST = '127.0.0.1';
const DEFAULT_RUNTIME_PORT = '3110';
const RUNTIME_READY_TIMEOUT_MS = 60_000;
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '0.0.0.0', '::']);

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

// The launcher's endpoint contract: CATS_RUNTIME_BASE_URL wins, otherwise
// CATS_RUNTIME_HOST/CATS_RUNTIME_PORT, otherwise http://127.0.0.1:3110.
// The resolved endpoint drives the health probe, the env handed to a runtime
// the launcher starts (CATS_RUNTIME_HOST/PORT), and the env handed to the
// platform (CATS_RUNTIME_BASE_URL), so all three always agree.
function resolveRuntimeEndpoint(env) {
  const explicitBase = env.CATS_RUNTIME_BASE_URL?.trim();
  let url;

  if (explicitBase) {
    url = new URL(explicitBase.replace(/\/+$/, ''));
  } else {
    const host = env.CATS_RUNTIME_HOST?.trim() || DEFAULT_RUNTIME_HOST;
    const port = env.CATS_RUNTIME_PORT?.trim() || DEFAULT_RUNTIME_PORT;
    url = new URL(`http://${host.includes(':') ? `[${host}]` : host}:${port}`);
  }

  const bindHostname = url.hostname.replace(/^\[|\]$/g, '');
  const isLocal = LOCAL_HOSTNAMES.has(bindHostname);
  // A wildcard bind address is not dialable; probe it via loopback.
  const probeHostname = bindHostname === '0.0.0.0' || bindHostname === '::'
    ? DEFAULT_RUNTIME_HOST
    : url.hostname;
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  const baseUrl = `${url.protocol}//${probeHostname}:${port}`;

  return {
    baseUrl,
    healthUrl: `${baseUrl}/health`,
    isLocal,
    spawnEnv: isLocal
      ? { CATS_RUNTIME_HOST: bindHostname, CATS_RUNTIME_PORT: port }
      : null,
  };
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

  let endpoint;
  try {
    endpoint = resolveRuntimeEndpoint(process.env);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`cats-one: invalid runtime endpoint configuration.\n${detail}`);
    process.exit(1);
  }

  const childEnv = {
    ...process.env,
    CATS_RUNTIME_BASE_URL: endpoint.baseUrl,
    ...(endpoint.spawnEnv ?? {}),
  };

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
    if (await isHealthy(endpoint.healthUrl)) {
      console.error(`cats-one: reusing the cats-runtime already serving ${endpoint.baseUrl}`);
    } else if (!endpoint.isLocal) {
      console.error(
        `cats-one: no runtime is answering at ${endpoint.healthUrl} and cats-one only `
        + 'auto-starts a local runtime. Start the remote runtime first, or use a '
        + 'local CATS_RUNTIME_BASE_URL.',
      );
      process.exit(1);
    } else {
      console.error(`cats-one: starting cats-runtime (${endpoint.baseUrl})`);
      runtimeChild = spawn(process.execPath, [runtimeBinPath], {
        stdio: 'inherit',
        env: childEnv,
        windowsHide: true,
      });
      runtimeChild.on('exit', (code) => {
        if (!shuttingDown) {
          runtimeExitedEarly = true;
          console.error(`cats-one: cats-runtime exited unexpectedly (code ${code ?? 'unknown'})`);
        }
      });

      const ready = await waitForHealth(endpoint.healthUrl, {
        shouldStop: () => runtimeExitedEarly,
      });
      if (!ready) {
        console.error(
          `cats-one: cats-runtime did not become healthy at ${endpoint.healthUrl} within ${RUNTIME_READY_TIMEOUT_MS / 1000}s.`,
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
    env: childEnv,
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

module.exports = {
  pickPlatformBin,
  pickRuntimeBin,
  resolveRuntimeEndpoint,
  waitForHealth,
  isHealthy,
};

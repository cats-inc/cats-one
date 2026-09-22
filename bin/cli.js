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

async function isHealthy(url, fetchImpl = fetch, apiKey) {
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(2_000),
      ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(url, {
  timeoutMs = RUNTIME_READY_TIMEOUT_MS,
  intervalMs = 500,
  fetchImpl = fetch,
  apiKey,
  shouldStop = () => false,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (shouldStop()) {
      return false;
    }
    if (await isHealthy(url, fetchImpl, apiKey)) {
      return true;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs));
  }
  return false;
}

function spawnService(name, bin, args, options, spawnImpl = spawn) {
  const child = spawnImpl(process.execPath, [bin, ...args], options);
  const service = { name, child, finished: false, result: null };
  let spawnError;
  child.on('error', error => { spawnError = error; });
  // The private input pipe is only used for EOF-based shutdown. A child may
  // already have exited by the time its parent closes it.
  child.stdin?.on('error', () => {});
  service.done = new Promise(resolveDone => {
    child.once('close', (code, signal) => {
      service.finished = true;
      service.result = { code, signal, error: spawnError };
      resolveDone(service.result);
    });
  });
  return service;
}

async function stopService(service, { timeoutMs, log }) {
  if (!service || service.finished) return false;
  const child = service.child;
  if (service.name === 'cats-runtime') {
    child.stdin.end();
  } else if (child.connected) {
    child.send({ type: 'cats.shutdown' }, () => {});
  }

  let timer;
  const stopped = await Promise.race([
    service.done.then(() => true),
    new Promise(resolveTimeout => { timer = setTimeout(() => resolveTimeout(false), timeoutMs); }),
  ]);
  clearTimeout(timer);
  if (stopped) return false;

  log(`cats-one: ${service.name} did not stop within ${timeoutMs / 1000}s; forcing its exit.`);
  if (!service.finished) child.kill('SIGKILL');
  await service.done;
  return true;
}

async function runLauncher({
  args = process.argv.slice(2), env = process.env, events = process,
  input = process.stdin, spawnImpl = spawn, resolveBin = resolvePackageBin,
  log = console.error, shutdownTimeoutMs = 15_000,
} = {}) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write([
      'Usage: cats-one [options]',
      '',
      '  --platform-only  Skip Runtime startup',
      '  --no-open        Skip opening the browser (press o to open later)',
      '  -h, --help       Show this help',
      '',
      'Other options are forwarded to cats-platform.',
      'Once ready: o opens the browser; q or Ctrl+C stops the services.',
      '',
    ].join('\n'));
    return 0;
  }
  const platformOnly = args.includes('--platform-only');
  const platformArgs = args.filter((arg) => arg !== '--platform-only');
  let runtime = null;
  let platform = null;
  let shuttingDown = false;
  let shutdownPromise;
  let exitCode = 0;
  const wasRaw = input.isRaw;
  const shutdown = (code = 0) => {
    if (code !== 0) exitCode = code;
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    shutdownPromise = (async () => {
      log('cats-one: stopping services...');
      for (const service of [platform, runtime]) {
        if (await stopService(service, { timeoutMs: shutdownTimeoutMs, log })) exitCode = 1;
        if (service?.result?.error || service?.result?.code > 0) exitCode = service.result.code || 1;
      }
    })();
    return shutdownPromise;
  };
  const onSignal = () => { void shutdown(); };
  events.on('SIGINT', onSignal);
  events.on('SIGTERM', onSignal);

  try {
    const endpoint = resolveRuntimeEndpoint(env);
    const childEnv = { ...env, CATS_RUNTIME_BASE_URL: endpoint.baseUrl, ...(endpoint.spawnEnv ?? {}) };
    const platformBin = resolveBin('@cats-inc/cats-platform', pickPlatformBin);
    if (!platformOnly) {
      const healthy = await isHealthy(endpoint.healthUrl, fetch, childEnv.CATS_RUNTIME_API_KEY);
      if (shuttingDown) { await shutdown(); return exitCode; }
      if (healthy) {
        log(`cats-one: reusing the cats-runtime already serving ${endpoint.baseUrl}`);
      } else {
        if (!endpoint.isLocal) throw new Error(`No runtime is answering at ${endpoint.healthUrl}; start the remote runtime first.`);
        const runtimeBin = resolveBin('@cats-inc/cats-runtime', pickRuntimeBin);
        log(`cats-one: starting cats-runtime (${endpoint.baseUrl})`);
        runtime = spawnService('cats-runtime', runtimeBin, [], {
          stdio: ['pipe', 'inherit', 'inherit'],
          env: {
            ...childEnv,
            CATS_RUNTIME_STARTUP_MODE: 'app-managed',
            CATS_RUNTIME_MANAGED_BY: 'cats-one',
            CATS_RUNTIME_READY_OUTPUT: 'plain',
          },
          windowsHide: true,
        }, spawnImpl);
        void runtime.done.then(result => {
          if (!shuttingDown) {
            log(`cats-one: cats-runtime exited unexpectedly (${result.error?.message ?? result.code ?? result.signal}).`);
            void shutdown(1);
          }
        });
        const ready = await waitForHealth(endpoint.healthUrl, {
          apiKey: childEnv.CATS_RUNTIME_API_KEY,
          shouldStop: () => shuttingDown,
        });
        if (shuttingDown) { await shutdown(); return exitCode; }
        if (!ready) throw new Error(`cats-runtime did not become healthy within ${RUNTIME_READY_TIMEOUT_MS / 1000}s.`);
        log('cats-one: cats-runtime is healthy');
      }
    }
    if (shuttingDown) { await shutdown(); return exitCode; }
    log('cats-one: starting cats-platform');
    // Platform owns interactive stdin and browser readiness. The separate IPC
    // channel lets the launcher request cleanup without stealing keyboard input.
    platform = spawnService('cats-platform', platformBin, platformArgs, {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      env: childEnv,
      windowsHide: true,
    }, spawnImpl);
    const result = await platform.done;
    if (!shuttingDown) {
      if (result.error) log(`cats-one: ${result.error.message}`);
      await shutdown(result.code ?? 1);
    } else {
      await shutdown();
    }
    return exitCode;
  } catch (error) {
    log(`cats-one: ${error instanceof Error ? error.message : String(error)}`);
    await shutdown(1);
    return exitCode;
  } finally {
    events.off('SIGINT', onSignal);
    events.off('SIGTERM', onSignal);
    // A forced child exit must not leave the shared terminal in raw mode.
    if (input.isTTY) input.setRawMode(wasRaw);
  }
}

if (require.main === module) {
  runLauncher().then(code => { process.exitCode = code; }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  pickPlatformBin,
  pickRuntimeBin,
  resolveRuntimeEndpoint,
  waitForHealth,
  isHealthy,
  runLauncher,
};

// Isolated fault/lock test driver. The production CLI has no fault-injection flags.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [checkoutRoot, root, checkpoint, mode = 'crash'] = process.argv.slice(2);
const { syncWorkspace } = await import(pathToFileURL(path.join(checkoutRoot, 'scripts/shared/workspace-apply.mjs')));
let reached = false;
try {
  await syncWorkspace({ root, checkoutRoot, agent: 'codex', onEvent: async (event, detail) => {
    if (reached || event !== checkpoint) return;
    reached = true;
    fs.writeSync(1, `checkpoint:${event}\n`);
    if (mode === 'pause') {
      process.send({ event, detail });
      await new Promise(resolve => process.once('message', resolve));
    } else {
      process.kill(process.pid, 'SIGKILL');
    }
  } });
  if (!reached) throw new Error(`Checkpoint was never reached: ${checkpoint}`);
} catch (error) {
  fs.writeSync(2, `${error.stack}\n`);
  process.exitCode = 2;
} finally {
  if (process.connected) process.disconnect();
}

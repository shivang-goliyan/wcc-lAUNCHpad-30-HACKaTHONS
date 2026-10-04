// Long-running worker: engine ticks for due households, outbox dispatch (calls), and recovery.
import { dueHouseholds, runCommand } from '../lib/db/repo';
import { ensureSchema } from '../lib/db/client';
import { dispatchOutbox, watchdog } from '../lib/calls/runtime';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await ensureSchema();
  console.log('[worker] started');
  let n = 0;
  for (;;) {
    try {
      await dispatchOutbox();
      if (n % 5 === 0) {
        for (const id of await dueHouseholds()) {
          await runCommand(id, null).catch((e) => console.error('[worker] tick failed', id, e));
        }
      }
      if (n % 30 === 0) await watchdog();
    } catch (e) {
      console.error('[worker] loop error', e);
    }
    n += 1;
    await sleep(1000);
  }
}

void main();

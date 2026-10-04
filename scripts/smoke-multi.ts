// Two households must both get their clinic calls (regression: global id collision).
import { createHousehold, loadHousehold, runCommand } from '../lib/db/repo';
import { dispatchOutbox } from '../lib/calls/runtime';
import { sql } from '../lib/db/client';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const ids = [await createHousehold({}), await createHousehold({})];
  for (const hh of ids) {
    await runCommand(hh, { type: 'appointment.propose', clinicId: 'cl_mehta', dateFrom: '2026-10-06', dateTo: '2026-10-12', window: 'morning', reason: 'test_results' });
    await runCommand(hh, { type: 'pending.confirm', kind: 'permit_clinic_call', confirmation: { source: 'button' } });
  }
  for (let i = 0; i < 40; i++) {
    await dispatchOutbox();
    const states = await Promise.all(ids.map(async (h) => (await loadHousehold(h))!.state.appointments[0].state));
    if (states.every((s) => s !== 'finding_availability')) { console.log('✓ both households:', states); break; }
    await sleep(500);
  }
  const rows = await sql()`SELECT id, household_id, transcript->1->>'text' AS line FROM call_sessions WHERE household_id IN ${sql()(ids)}`;
  console.log(rows);
  await sql().end();
}
main().catch((e) => { console.error(e); process.exit(1); });

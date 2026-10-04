// End-to-end smoke test against a real Postgres (scripted sim clinic when no LLM key).
import { createHousehold, loadHousehold, runCommand } from '../lib/db/repo';
import { dispatchOutbox } from '../lib/calls/runtime';
import { sql } from '../lib/db/client';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function pump(hh: string, until: () => Promise<boolean>, label: string) {
  for (let i = 0; i < 60; i++) {
    await dispatchOutbox();
    if (await until()) return console.log('✓', label);
    await sleep(500);
  }
  throw new Error('timeout: ' + label);
}

async function main() {
  const hh = await createHousehold({});
  console.log('household', hh);
  const st = async () => (await loadHousehold(hh))!.state;
  let r = await runCommand(hh, { type: 'appointment.propose', clinicId: 'cl_mehta', dateFrom: '2026-10-06', dateTo: '2026-10-12', window: 'morning', reason: 'follow_up' });
  console.log('propose →', r.reply?.sayHint);
  r = await runCommand(hh, { type: 'pending.confirm', kind: 'permit_clinic_call', confirmation: { source: 'voice', transcript: 'haan kar do' } });
  console.log('permit →', r.reply?.sayHint);
  await pump(hh, async () => (await st()).appointments[0].state !== 'finding_availability', 'availability call finished');
  const a = (await st()).appointments[0];
  console.log('state', a.state, a.offeredSlot?.dateIso, a.offeredSlot?.time24h, a.verification.map((v) => `${v.check}:${v.pass}`).join(' '));
  r = await runCommand(hh, { type: 'pending.confirm', kind: 'approve_slot', confirmation: { source: 'button' } });
  await pump(hh, async () => (await st()).appointments[0].state !== 'pending_clinic_confirmation', 'confirm call finished');
  console.log('final', (await st()).appointments[0].state);
  // check-in ladder via demo skips
  for (let i = 0; i < 6; i++) await runCommand(hh, null, { clockJumpTo: 'next' });
  const s = await st();
  console.log('cases', s.cases.map((c) => `${c.type}:${c.state}`));
  const ev = await sql()`SELECT summary FROM events WHERE household_id=${hh} ORDER BY id`;
  console.log(ev.map((e) => ' · ' + e.summary).join('\n'));
  const calls = await sql()`SELECT purpose, state, extractor, jsonb_array_length(transcript) n, disclosure FROM call_sessions WHERE household_id=${hh}`;
  console.log(calls);
  await sql().end();
}
main().catch((e) => { console.error(e); process.exit(1); });

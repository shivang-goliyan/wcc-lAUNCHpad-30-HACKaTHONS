// Executes outbox effects (calls) and feeds results back to the engine as commands.
import twilio from 'twilio';
import { ensureSchema, sql } from '../db/client';
import { loadHousehold, runCommand, virtualNow } from '../db/repo';
import type { CallPurpose, StartCallEffect } from '../engine/types';
import { dateIso } from '../engine/time';
import { agentNextTurn, clinicSimTurn, extract, scriptedClinicCall } from '../agents/callAgents';
import { llmAvailable } from '../agents/llm';
import type { ClinicBrief, Speaker, Turn } from '../agents/types';
import { checkDisclosure } from '../verify/disclosure';

type CallRow = {
  id: string;
  household_id: string;
  purpose: CallPurpose;
  adapter: 'sim' | 'twilio';
  related_id: string | null;
  to_number: string | null;
  state: string;
  provider_call_id: string | null;
  brief: Record<string, unknown>;
  transcript: Turn[];
  result_sent: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const running = new Set<string>();

export function allowlisted(num: string | null) {
  if (!num) return false;
  const list = (process.env.PHONE_ALLOWLIST ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(num);
}

export function twilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export function calleeSpeaker(purpose: CallPurpose): Speaker {
  return purpose.startsWith('clinic') ? 'clinic' : purpose === 'recipient_checkin' ? 'recipient' : 'contact';
}

async function getCall(id: string) {
  const rows = await sql()<CallRow[]>`SELECT * FROM call_sessions WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function appendTurn(id: string, turn: Turn) {
  await sql()`UPDATE call_sessions SET transcript = transcript || ${sql().json([turn] as never)}::jsonb, state = CASE WHEN state IN ('queued','ringing') THEN 'in_progress' ELSE state END, updated_at = now() WHERE id = ${id}`;
}

async function setState(id: string, state: string) {
  await sql()`UPDATE call_sessions SET state = ${state}, updated_at = now(), ended_at = CASE WHEN ${state} IN ('completed','no_answer','busy','voicemail','failed','cancelled') THEN now() ELSE ended_at END WHERE id = ${id}`;
}

/** Final step for every call: extraction (if needed) → disclosure check → engine command. Idempotent. */
export async function finishCall(id: string, status: 'completed' | 'no_answer' | 'busy' | 'failed' | 'voicemail', preExtracted?: unknown, extractor?: string) {
  const call = await getCall(id);
  if (!call || call.result_sent) return;
  let extracted = preExtracted;
  let by = extractor ?? 'llm';
  if (status === 'completed' && extracted === undefined) {
    const hh = await loadHousehold(call.household_id);
    const today = hh ? dateIso(virtualNow(hh.clock_offset_ms), 'Asia/Kolkata') : new Date().toISOString().slice(0, 10);
    try {
      extracted = llmAvailable() ? await extract(call.purpose, call.transcript, { todayIso: today, brief: call.brief }) : {};
      by = llmAvailable() ? 'llm' : 'none';
    } catch (e) {
      console.error('extract failed', e);
      extracted = {};
      by = 'failed';
    }
  }
  const disclosure = checkDisclosure(
    call.transcript.filter((t) => t.speaker === 'nami').map((t) => t.text),
    { forbiddenWords: (call.brief.forbiddenDetails as string[] | undefined) ?? [] },
  );
  const upd = await sql()`UPDATE call_sessions SET extracted = ${sql().json((extracted ?? null) as never)}, extractor = ${by}, disclosure = ${sql().json(disclosure as never)},
    result_sent = true, state = ${status}, ended_at = COALESCE(ended_at, now()), updated_at = now() WHERE id = ${id} AND result_sent = false RETURNING id`;
  if (!upd.length) return;
  await runCommand(call.household_id, { type: 'call.result', callId: id, status, extracted });
}

// ------------------------------------------------------------------ simulated calls

export async function runSimCall(id: string) {
  if (running.has(id)) return;
  running.add(id);
  try {
    const call = await getCall(id);
    if (!call || call.result_sent) return;
    const hh = await loadHousehold(call.household_id);
    if (!hh) return;
    const b = call.brief as unknown as ClinicBrief;
    const clinic = hh.state.clinics[0];
    await setState(id, 'ringing');
    await sleep(1500);
    if (b.scenario === 'voicemail') {
      await appendTurn(id, { speaker: 'system', text: '(Simulated) Voicemail, nobody answered.', t: Date.now() });
      return await finishCall(id, 'voicemail', { outcome: 'not_reached' }, 'scripted');
    }
    if (!llmAvailable()) {
      const { turns, extracted } = scriptedClinicCall(b, clinic.simCalendar, virtualNow(hh.clock_offset_ms));
      for (const t of turns) {
        if ((await getCall(id))?.state === 'cancelled') return;
        await appendTurn(id, { ...t, t: Date.now() });
        await sleep(1600);
      }
      return await finishCall(id, 'completed', extracted, 'scripted');
    }
    const turns: Turn[] = [];
    const push = async (t: Turn) => {
      turns.push(t);
      await appendTurn(id, t);
    };
    await push({ speaker: 'clinic', text: `${b.clinicName}, namaste. Boliye?`, t: Date.now() });
    for (let i = 0; i < 6; i++) {
      if ((await getCall(id))?.state === 'cancelled') return;
      const n = await agentNextTurn(call.purpose, call.brief, turns);
      await push({ speaker: 'nami', text: n.say, t: Date.now() });
      if (n.end_call) break;
      const c = await clinicSimTurn(b, clinic.simCalendar, turns);
      await push({ speaker: 'clinic', text: c.say, t: Date.now() });
    }
    await finishCall(id, 'completed');
  } catch (e) {
    console.error('sim call failed', id, e);
    await appendTurn(id, { speaker: 'system', text: 'Call failed (technical error).', t: Date.now() }).catch(() => {});
    await finishCall(id, 'failed', {}, 'error').catch(() => {});
  } finally {
    running.delete(id);
  }
}

// ------------------------------------------------------------------ outbox dispatcher

export async function dispatchOutbox(limit = 10) {
  await ensureSchema();
  const db = sql();
  const items = await db.begin(async (tx) => {
    const rows = await tx<{ id: string; household_id: string; kind: string; payload: unknown; attempts: number }[]>`
      SELECT id, household_id, kind, payload, attempts FROM outbox WHERE state = 'pending' AND next_attempt_at <= now()
      ORDER BY id LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
    if (rows.length) await tx`UPDATE outbox SET state = 'in_flight', attempts = attempts + 1 WHERE id IN ${tx(rows.map((r) => r.id))}`;
    return rows;
  });
  for (const it of items) {
    try {
      if (it.kind === 'start_call') await startCall(it.household_id, it.payload as StartCallEffect['payload']);
      else if (it.kind === 'cancel_call') await cancelCall((it.payload as { callId: string }).callId);
      await db`UPDATE outbox SET state = 'done' WHERE id = ${it.id}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('outbox item failed', it.id, msg);
      if (it.attempts + 1 >= 3) {
        await db`UPDATE outbox SET state = 'failed', last_error = ${msg} WHERE id = ${it.id}`;
        if (it.kind === 'start_call') await finishCall((it.payload as { callId: string }).callId, 'failed', {}, 'error').catch(() => {});
      } else {
        await db`UPDATE outbox SET state = 'pending', last_error = ${msg}, next_attempt_at = now() + ${`${5 * (it.attempts + 1)} seconds`}::interval WHERE id = ${it.id}`;
      }
    }
  }
  return items.length;
}

async function startCall(hh: string, p: StartCallEffect['payload']) {
  const db = sql();
  await db`INSERT INTO call_sessions (id, household_id, purpose, adapter, related_id, to_number, brief, started_at)
    VALUES (${p.callId}, ${hh}, ${p.purpose}, ${p.adapter}, ${p.relatedId}, ${p.to}, ${db.json(p.brief as never)}, now())
    ON CONFLICT (id) DO NOTHING`;
  if (p.adapter === 'sim') {
    void runSimCall(p.callId);
    return;
  }
  const client = twilioClient();
  if (!allowlisted(p.to) || !client || !process.env.TWILIO_FROM || !process.env.APP_URL) {
    await appendTurn(p.callId, { speaker: 'system', text: `Real call not placed: ${!allowlisted(p.to) ? 'number not on the allow-list' : 'Twilio not configured'}.`, t: Date.now() });
    await finishCall(p.callId, 'failed', {}, 'none');
    return;
  }
  const base = process.env.APP_URL.replace(/\/$/, '');
  const call = await client.calls.create({
    to: p.to!,
    from: process.env.TWILIO_FROM,
    url: `${base}/api/twilio/voice?callId=${p.callId}`,
    statusCallback: `${base}/api/twilio/status?callId=${p.callId}`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    machineDetection: 'Enable',
    timeout: 25,
  });
  await db`UPDATE call_sessions SET provider_call_id = ${call.sid}, state = 'ringing', updated_at = now() WHERE id = ${p.callId}`;
}

async function cancelCall(callId: string) {
  const call = await getCall(callId);
  if (!call || call.result_sent) return;
  await setState(callId, 'cancelled');
  if (call.adapter === 'twilio' && call.provider_call_id) {
    await twilioClient()?.calls(call.provider_call_id).update({ status: 'completed' }).catch(() => {});
  }
  await sql()`UPDATE call_sessions SET result_sent = true WHERE id = ${callId}`;
}

/** Recovery after restarts: sim calls orphaned mid-dialogue are failed truthfully; stuck Twilio calls are polled. */
export async function watchdog() {
  const db = sql();
  const stale = await db<CallRow[]>`SELECT * FROM call_sessions WHERE result_sent = false AND updated_at < now() - interval '3 minutes'`;
  for (const c of stale) {
    if (c.adapter === 'sim' && !running.has(c.id)) {
      await appendTurn(c.id, { speaker: 'system', text: 'Call interrupted (service restarted), marked failed, not confirmed.', t: Date.now() });
      await finishCall(c.id, 'failed', {}, 'error');
    } else if (c.adapter === 'twilio' && c.provider_call_id) {
      const tw = await twilioClient()?.calls(c.provider_call_id).fetch().catch(() => null);
      const map: Record<string, 'completed' | 'no_answer' | 'busy' | 'failed'> = { completed: 'completed', 'no-answer': 'no_answer', busy: 'busy', failed: 'failed', canceled: 'failed' };
      if (tw && map[tw.status]) await finishCall(c.id, map[tw.status]);
    }
  }
}

// ------------------------------------------------------------------ Twilio turn loop (Say / Gather)

const VOICE = () => (process.env.TWILIO_VOICE_HI || 'Polly.Aditi') as 'Polly.Aditi';

function twiml() {
  return new twilio.twiml.VoiceResponse();
}

export async function twilioVoice(callId: string, answeredBy: string | null) {
  const call = await getCall(callId);
  const vr = twiml();
  if (!call) {
    vr.hangup();
    return vr.toString();
  }
  await setState(callId, 'in_progress');
  if (answeredBy && answeredBy.startsWith('machine')) {
    // Voicemail: leave no details.
    vr.say({ voice: VOICE(), language: 'hi-IN' }, 'Raynet se call tha. Kripya Nami link dekhiye. Dhanyavaad.');
    vr.hangup();
    await appendTurn(callId, { speaker: 'system', text: `Voicemail detected (${answeredBy}), no details left.`, t: Date.now() });
    void finishCall(callId, 'voicemail', { voicemail: true, accepted: 'not_reached', outcome: 'not_reached' }, 'twilio');
    return vr.toString();
  }
  return nextTwilioTurn(call, vr);
}

export async function twilioGather(callId: string, speech: string | null) {
  const call = await getCall(callId);
  const vr = twiml();
  if (!call || call.state === 'cancelled') {
    vr.hangup();
    return vr.toString();
  }
  const turn: Turn = { speaker: calleeSpeaker(call.purpose), text: speech?.trim() || '(silence)', t: Date.now() };
  await appendTurn(callId, turn);
  call.transcript.push(turn);
  return nextTwilioTurn(call, vr);
}

async function nextTwilioTurn(call: CallRow, vr: ReturnType<typeof twiml>) {
  let say = 'Namaste, main Nami hoon, ek AI assistant. Maaf kijiye, abhi technical dikkat hai. Hum baad mein call karenge.';
  let end = true;
  if (call.transcript.filter((t) => t.speaker === 'nami').length < 10) {
    try {
      const n = await agentNextTurn(call.purpose, call.brief, call.transcript);
      say = n.say;
      end = n.end_call;
    } catch (e) {
      console.error('agent turn failed', e);
    }
  }
  await appendTurn(call.id, { speaker: 'nami', text: say, t: Date.now() });
  vr.say({ voice: VOICE(), language: 'hi-IN' }, say);
  if (end) {
    vr.hangup();
  } else {
    const base = (process.env.APP_URL ?? '').replace(/\/$/, '');
    const g = vr.gather({ input: ['speech'], language: 'hi-IN', speechTimeout: 'auto', action: `${base}/api/twilio/gather?callId=${call.id}`, method: 'POST' });
    void g;
    vr.redirect({ method: 'POST' }, `${base}/api/twilio/gather?callId=${call.id}`);
  }
  return vr.toString();
}

export async function twilioStatus(callId: string, status: string, answeredBy: string | null) {
  const map: Record<string, 'completed' | 'no_answer' | 'busy' | 'failed'> = { completed: 'completed', 'no-answer': 'no_answer', busy: 'busy', failed: 'failed', canceled: 'failed' };
  if (status === 'ringing') await setState(callId, 'ringing');
  if (status === 'in-progress' || status === 'answered') await setState(callId, 'in_progress');
  const final = map[status];
  if (!final) return;
  const call = await getCall(callId);
  if (!call || call.result_sent) return;
  if (answeredBy?.startsWith('machine')) return finishCall(callId, 'voicemail', { voicemail: true, accepted: 'not_reached', outcome: 'not_reached' }, 'twilio');
  const spoke = call.transcript.some((t) => t.speaker !== 'nami' && t.speaker !== 'system' && t.text !== '(silence)');
  await finishCall(callId, final === 'completed' && !spoke ? 'no_answer' : final);
}

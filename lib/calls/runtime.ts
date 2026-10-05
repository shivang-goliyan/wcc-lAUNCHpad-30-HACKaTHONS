// Executes outbox effects (calls) and feeds results back to the engine as commands.
import { randomBytes } from 'node:crypto';
import twilio from 'twilio';
import { ensureSchema, sql } from '../db/client';
import { loadHousehold, runCommand, virtualNow } from '../db/repo';
import type { CallPurpose, StartCallEffect } from '../engine/types';
import { dateIso } from '../engine/time';
import { agentNextTurn, clinicSimTurn, extract, scriptedClinicCall } from '../agents/callAgents';
import { llmAvailable } from '../agents/llm';
import type { ClinicBrief, Speaker, Turn } from '../agents/types';
import { checkDisclosure } from '../verify/disclosure';
import { namiInstructions } from '../agents/namiPrompt';
import { namiReply, replyLanguage } from '../agents/namiTurn';
import { checkSafety } from '../server/safetyCheck';
import { callKey } from '../server/twilioRequest';

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
  if (!sid) return null;
  if (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET) return twilio(process.env.TWILIO_API_KEY_SID, process.env.TWILIO_API_KEY_SECRET, { accountSid: sid });
  const token = process.env.TWILIO_AUTH_TOKEN;
  return token ? twilio(sid, token) : null;
}

const cap = (name: string, def: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const MAX_SECONDS = () => cap('CALL_MAX_SECONDS', 180);

function hookUrl(route: 'voice' | 'gather' | 'status', callId: string) {
  const base = (process.env.APP_URL ?? '').replace(/\/$/, '');
  return `${base}/api/twilio/${route}?callId=${callId}&k=${callKey(callId)}`;
}

/**
 * Every real (paid) call passes here first. Demo homes call only numbers on the allow-list,
 * except the judge's own phone for a companion call: Indian mobiles or US numbers only,
 * at most CALLS_PER_NUMBER_PER_DAY per number, CALLS_PER_HOUSEHOLD per demo home, and
 * CALLS_PER_DAY across the whole site. REAL_CALLS=off stops everything. Returns why not, or null.
 */
export async function realCallGate(to: string | null, hh: string, companion: boolean): Promise<string | null> {
  if (process.env.REAL_CALLS === 'off') return 'real calls are switched off';
  if (!to) return 'no number';
  if (!companion && !allowlisted(to)) return 'number not on the allow-list';
  if (companion && !/^\+91[6-9]\d{9}$|^\+1[2-9]\d{9}$/.test(to)) return 'only Indian mobile and US numbers can be called';
  const [c] = await sql()<{ day: number; num: number; house: number }[]>`SELECT
      count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS day,
      count(*) FILTER (WHERE to_number = ${to} AND created_at > now() - interval '24 hours')::int AS num,
      count(*) FILTER (WHERE household_id = ${hh})::int AS house
    FROM call_sessions WHERE adapter = 'twilio'`;
  if (c.day >= cap('CALLS_PER_DAY', 20)) return 'today’s limit of demo calls has been reached';
  if (c.num >= cap('CALLS_PER_NUMBER_PER_DAY', 2)) return 'this number has had its demo calls for today';
  if (companion && c.house >= cap('CALLS_PER_HOUSEHOLD', 2)) return 'this demo home has used its phone calls';
  return null;
}

export function calleeSpeaker(purpose: CallPurpose): Speaker {
  return purpose.startsWith('clinic') ? 'clinic' : purpose === 'recipient_checkin' || purpose === 'companion' ? 'recipient' : 'contact';
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
  if (call.purpose === 'companion') {
    // a conversation, not an errand: nothing to extract or report to the engine
    await sql()`UPDATE call_sessions SET result_sent = true, state = ${status}, ended_at = COALESCE(ended_at, now()), updated_at = now() WHERE id = ${id}`;
    return;
  }
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
  const gate = p.adapter === 'twilio' ? await realCallGate(p.to, hh, false) : null;
  await db`INSERT INTO call_sessions (id, household_id, purpose, adapter, related_id, to_number, brief, started_at)
    VALUES (${p.callId}, ${hh}, ${p.purpose}, ${p.adapter}, ${p.relatedId}, ${p.to}, ${db.json(p.brief as never)}, now())
    ON CONFLICT (id) DO NOTHING`;
  if (p.adapter === 'sim') {
    void runSimCall(p.callId);
    return;
  }
  const client = twilioClient();
  if (gate || !client || !process.env.TWILIO_FROM || !process.env.APP_URL) {
    await appendTurn(p.callId, { speaker: 'system', text: `Real call not placed: ${gate ?? 'Twilio not configured'}.`, t: Date.now() });
    await finishCall(p.callId, 'failed', {}, 'none');
    return;
  }
  const call = await client.calls.create({
    to: p.to!,
    from: process.env.TWILIO_FROM,
    url: hookUrl('voice', p.callId),
    statusCallback: hookUrl('status', p.callId),
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    machineDetection: 'Enable',
    timeout: 25,
    timeLimit: MAX_SECONDS(),
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
  if (call.purpose === 'companion') return companionGreeting(call, vr);
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
  if (call.purpose === 'companion') return companionTurn(call, speech?.trim() ?? '', vr);
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
    vr.gather({ input: ['speech'], language: 'hi-IN', speechTimeout: 'auto', action: hookUrl('gather', call.id), method: 'POST' });
    vr.redirect({ method: 'POST' }, hookUrl('gather', call.id));
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

// ------------------------------------------------------------------ the judge's phone: talking to Nami as the elder

const sayOpts = (lang: string) => ({ voice: VOICE(), language: (lang === 'en' ? 'en-IN' : 'hi-IN') as 'hi-IN' });

function listen(call: CallRow, vr: ReturnType<typeof twiml>) {
  const lang = String(call.brief.lang ?? 'hi');
  vr.gather({ input: ['speech'], language: lang === 'en' ? 'en-IN' : 'hi-IN', speechTimeout: 'auto', timeout: 7, action: hookUrl('gather', call.id), method: 'POST' });
  vr.redirect({ method: 'POST' }, hookUrl('gather', call.id));
}

async function companionGreeting(call: CallRow, vr: ReturnType<typeof twiml>) {
  const lang = String(call.brief.lang ?? 'hi');
  const hello =
    lang === 'en'
      ? 'Hello! This is Nami, an AI companion from Raynet, calling for your demo. Talk to me like you would every day: ask about your plan, tell me you took your tablet, or ask me to book Dr. Mehta.'
      : 'Namaste! Main Nami hoon, Raynet ki AI saathi. Yeh aapki demo call hai. Mujhse roz ki tarah baat kijiye: aaj ka plan poochhiye, ya kahiye Dr. Mehta ka appointment book kar do.';
  await appendTurn(call.id, { speaker: 'nami', text: hello, t: Date.now() });
  vr.say(sayOpts(lang), hello);
  listen(call, vr);
  return vr.toString();
}

async function companionTurn(call: CallRow, speech: string, vr: ReturnType<typeof twiml>) {
  const lang = String(call.brief.lang ?? 'hi');
  const naminTurns = call.transcript.filter((t) => t.speaker === 'nami').length;
  const silences = call.transcript.slice(-2).filter((t) => t.text === '(silence)').length;
  const started = call.transcript[0]?.t ?? Date.now();
  const bye = (text: string) => {
    vr.say(sayOpts(lang), text);
    vr.hangup();
    void appendTurn(call.id, { speaker: 'nami', text, t: Date.now() });
    return vr.toString();
  };
  if (!speech) {
    if (silences >= 2) return bye(lang === 'en' ? 'I’ll let you go now. Talk to me any time on the Raynet screen. Bye!' : 'Theek hai, ab main rakhti hoon. Raynet screen par kabhi bhi baat kijiye. Namaste!');
    vr.say(sayOpts(lang), lang === 'en' ? 'I’m listening.' : 'Main sun rahi hoon.');
    listen(call, vr);
    return vr.toString();
  }
  // the same two crisis checks as on the screen, before anything else
  const safety = await checkSafety(call.household_id, speech).catch(() => null);
  if (safety?.matched) {
    return bye(
      lang === 'en'
        ? 'I’m opening a help request and telling your family now. If this is an emergency, please call 112. For someone to talk to, Tele-MANAS is 14416.'
        : 'Main abhi madad maang rahi hoon aur aapke parivaar ko bata rahi hoon. Emergency ho to 112 par call kijiye. Baat karne ke liye Tele-MANAS 14416.',
    );
  }
  let reply = lang === 'en' ? 'Sorry, I didn’t catch that. Could you say it again?' : 'Maaf kijiye, phir se boliye?';
  try {
    const system =
      (await namiInstructions(call.household_id, 'voice')) +
      replyLanguage(speech) +
      '\n\nYou are on a phone call. Answer in one or two short spoken sentences. No lists, no emojis, no markdown.';
    const history = call.transcript
      .slice(0, -1)
      .filter((t) => t.speaker === 'nami' || (t.speaker === 'recipient' && t.text !== '(silence)'))
      .slice(-10)
      .map((t) => ({ role: (t.speaker === 'nami' ? 'assistant' : 'user') as 'assistant' | 'user', text: t.text }));
    const r = await namiReply(call.household_id, system, history, speech, 'voice');
    if (r.text) reply = r.text.replace(/[*_#]/g, '');
  } catch (e) {
    console.error('companion turn failed', e);
  }
  const elapsed = (Date.now() - started) / 1000;
  if (naminTurns >= 9 || elapsed > MAX_SECONDS() - 25) {
    return bye(`${reply} ${lang === 'en' ? 'That’s our demo time. Thank you for talking to me!' : 'Demo ka samay poora hua. Baat karne ke liye shukriya!'}`);
  }
  await appendTurn(call.id, { speaker: 'nami', text: reply, t: Date.now() });
  vr.say(sayOpts(lang), reply);
  listen(call, vr);
  return vr.toString();
}

/** A judge asked Nami to phone them as the elder. Guarded by realCallGate. */
export async function startCompanionCall(hh: string, to: string, lang: 'en' | 'hi') {
  const client = twilioClient();
  if (!client || !process.env.TWILIO_FROM || !process.env.APP_URL) return { ok: false as const, reason: 'phone calls are not set up on this server' };
  const why = await realCallGate(to, hh, true);
  if (why) return { ok: false as const, reason: why };
  const id = `call_ph_${randomBytes(8).toString('base64url')}`;
  const db = sql();
  await db`INSERT INTO call_sessions (id, household_id, purpose, adapter, related_id, to_number, brief, started_at)
    VALUES (${id}, ${hh}, 'companion', 'twilio', null, ${to}, ${db.json({ lang } as never)}, now())`;
  try {
    const call = await client.calls.create({
      to,
      from: process.env.TWILIO_FROM,
      url: hookUrl('voice', id),
      statusCallback: hookUrl('status', id),
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      machineDetection: 'Enable',
      timeout: 25,
      timeLimit: MAX_SECONDS(),
    });
    await db`UPDATE call_sessions SET provider_call_id = ${call.sid}, state = 'ringing', updated_at = now() WHERE id = ${id}`;
    return { ok: true as const, callId: id };
  } catch (e) {
    console.error('companion call failed', e);
    await finishCall(id, 'failed');
    return { ok: false as const, reason: 'the call could not be placed' };
  }
}

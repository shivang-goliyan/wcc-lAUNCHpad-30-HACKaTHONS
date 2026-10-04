// Nami's tools (docs/AGENTS.md §3). Shared by the realtime voice agent and text mode.
// Every call is zod-validated and turned into an engine command — tools never write state.
import { z } from 'zod';
import type { Command } from '../engine/engine';
import { loadHousehold, runCommand, virtualNow } from '../db/repo';
import { dateIso, spokenEn, time24 } from '../engine/time';
import type { InputSource, ToolReply } from '../engine/types';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const TOOL_SCHEMAS = {
  get_my_day: { description: "Read today's plan: reminders and their status, open check-in, appointments, pending confirmations.", schema: z.object({}) },
  record_reminder_response: {
    description: 'Record what the user said about a reminder (taken / not taken / snooze / needs help). Pass her exact words in quote.',
    schema: z.object({ occurrence_id: z.string().nullable().optional(), response: z.enum(['taken', 'not_taken', 'snooze', 'help']), snooze_minutes: z.number().int().min(10).max(120).nullable().optional(), quote: z.string() }),
  },
  respond_to_checkin: { description: 'The user answered her daily check-in ("main theek hoon", "I am here"). Pass her exact words.', schema: z.object({ quote: z.string() }) },
  propose_appointment: {
    description: 'Draft an appointment request with an APPROVED clinic. Returns a readback you must read to the user and a pending_action_id. Nothing is called until she confirms.',
    schema: z.object({ clinic_id: z.string(), date_from: iso, date_to: iso, time_window: z.enum(['morning', 'afternoon', 'evening', 'any']), reason: z.enum(['follow_up', 'new_concern', 'test_results', 'other']), note: z.string().nullable().optional() }),
  },
  confirm_pending_action: {
    description: "Execute a pending action ONLY after the user clearly said yes. Pass her exact words in user_quote; the server verifies them.",
    schema: z.object({ pending_action_id: z.string().nullable().optional(), user_quote: z.string() }),
  },
  decline_pending_action: { description: 'The user said no to a pending action.', schema: z.object({ pending_action_id: z.string().nullable().optional() }) },
  get_appointment_status: { description: 'Status of the latest appointment request.', schema: z.object({ request_id: z.string().nullable().optional() }) },
  propose_call_family: { description: 'Draft a request asking a family member to call her. Needs confirmation.', schema: z.object({ contact: z.enum(['primary', 'backup']), reason: z.string(), message: z.string().nullable().optional() }) },
  request_help: { description: 'Open a help case IMMEDIATELY when she asks for help or says she is hurt, unwell, scared or in distress.', schema: z.object({ quote: z.string(), kind: z.enum(['explicit_help', 'distress']) }) },
  remember: { description: 'Save a personal memory ONLY after asking permission and hearing yes. consent_quote = her words of consent.', schema: z.object({ text: z.string(), consent_quote: z.string() }) },
  forget: { description: 'Delete something Nami remembers.', schema: z.object({ memory_id: z.string().nullable().optional(), text: z.string().nullable().optional() }) },
  draft_story_for_family: {
    description: "Memory Corner: after Meera tells the story behind a family photo, draft a warm 2–3 sentence summary IN HER WORDS (first person) and pass her exact words as quote. Nothing is sent until she confirms.",
    schema: z.object({ prompt_id: z.string().nullable().optional(), story: z.string(), quote: z.string() }),
  },
  snooze_conversation: { description: 'She asked for quiet ("not now", "leave me alone"). Go quiet.', schema: z.object({ minutes: z.number().int().min(5).max(240).nullable().optional() }) },
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;
export const TOOL_NAMES = Object.keys(TOOL_SCHEMAS) as ToolName[];

/** JSON Schema list (for realtime session config and Claude tools). */
export function toolJsonSchemas() {
  return TOOL_NAMES.map((name) => {
    const js = z.toJSONSchema(TOOL_SCHEMAS[name].schema) as Record<string, unknown>;
    delete js.$schema;
    return { name, description: TOOL_SCHEMAS[name].description, parameters: js };
  });
}

export async function myDay(hh: string) {
  const row = await loadHousehold(hh);
  if (!row) return { ok: false, status: 'no_household', sayHint: '' } satisfies ToolReply;
  const s = row.state;
  const now = virtualNow(row.clock_offset_ms);
  const tz = s.recipient.timezone;
  const today = dateIso(now, tz);
  const items = s.occurrences
    .filter((o) => dateIso(o.dueAt, tz) === today)
    .sort((a, b) => a.dueAt - b.dueAt)
    .map((o) => ({ id: o.id, time: time24(o.dueAt, tz), what: s.schedules.find((x) => x.id === o.scheduleId)?.label, state: o.state, outcome: o.outcome }));
  return {
    ok: true,
    status: 'ok',
    sayHint: `It is ${spokenEn(now, tz)}.`,
    data: {
      now: spokenEn(now, tz),
      reminders: items,
      openCheckin: s.cases.find((c) => c.type === 'checkin' && ['awaiting_response', 'retrying_page', 'phone_fallback', 'escalating'].includes(c.state))?.id ?? null,
      appointments: s.appointments.slice(-2).map((a) => ({ id: a.id, state: a.state, slot: a.offeredSlot ? spokenEn(a.offeredSlot.startAt, tz) : null })),
      pending: s.pending.filter((p) => p.state === 'open').map((p) => ({ id: p.id, kind: p.kind, readback: p.readback })),
    },
  } satisfies ToolReply;
}

export async function executeTool(hh: string, name: string, rawArgs: unknown, ctx: { source: InputSource; lastUserTranscript: string | null }): Promise<ToolReply> {
  if (!(name in TOOL_SCHEMAS)) return { ok: false, status: 'unknown_tool', sayHint: 'I cannot do that.' };
  const parsed = TOOL_SCHEMAS[name as ToolName].schema.safeParse(rawArgs ?? {});
  if (!parsed.success) return { ok: false, status: 'invalid_arguments', sayHint: 'Sorry, I did not get the details right. Could you say that again?', data: { issues: parsed.error.issues.slice(0, 3) } };
  const a = parsed.data as Record<string, never>;
  let cmd: Command | null = null;
  // Consent checks run on the user's REAL latest words (from transcription), not on what the model claims.
  const userWords = ctx.lastUserTranscript ?? (a.user_quote as string | undefined) ?? null;
  switch (name as ToolName) {
    case 'get_my_day':
      return myDay(hh);
    case 'get_appointment_status': {
      const row = await loadHousehold(hh);
      const ap = row?.state.appointments.at(-1);
      if (!ap) return { ok: true, status: 'none', sayHint: 'There is no appointment request yet.' };
      return { ok: true, status: ap.state, sayHint: `The appointment request is ${ap.state.replace(/_/g, ' ')}${ap.offeredSlot ? ` for ${spokenEn(ap.offeredSlot.startAt, row!.state.recipient.timezone)}` : ''}${ap.failureReason ? `, ${ap.failureReason}` : ''}.` };
    }
    case 'record_reminder_response':
      cmd = { type: 'reminder.respond', occurrenceId: a.occurrence_id ?? null, response: a.response, snoozeMinutes: a.snooze_minutes ?? undefined, quote: a.quote, source: ctx.source };
      break;
    case 'respond_to_checkin':
      cmd = { type: 'checkin.respond', quote: a.quote, source: ctx.source };
      break;
    case 'propose_appointment':
      cmd = { type: 'appointment.propose', clinicId: a.clinic_id, dateFrom: a.date_from, dateTo: a.date_to, window: a.time_window, reason: a.reason, note: a.note ?? null };
      break;
    case 'confirm_pending_action':
      cmd = { type: 'pending.confirm', pendingId: a.pending_action_id ?? null, confirmation: { source: ctx.source, transcript: userWords } };
      break;
    case 'decline_pending_action':
      cmd = { type: 'pending.decline', pendingId: a.pending_action_id ?? null, source: ctx.source };
      break;
    case 'propose_call_family':
      cmd = { type: 'family.propose', contact: a.contact, reason: a.reason, message: a.message ?? null };
      break;
    case 'request_help':
      cmd = { type: 'help.open', quote: a.quote, kind: a.kind, source: ctx.source };
      break;
    case 'remember':
      cmd = { type: 'memory.save', text: a.text, consent: { source: ctx.source, transcript: userWords ?? a.consent_quote } };
      break;
    case 'forget':
      cmd = { type: 'memory.delete', memoryId: a.memory_id ?? null, text: a.text ?? null };
      break;
    case 'draft_story_for_family':
      cmd = { type: 'memory.story.draft', promptId: a.prompt_id ?? null, story: a.story, quote: a.quote };
      break;
    case 'snooze_conversation':
      cmd = { type: 'ui.quiet', minutes: a.minutes ?? 60 };
      break;
  }
  const r = await runCommand(hh, cmd);
  return r.reply ?? { ok: true, status: 'ok', sayHint: 'Done.' };
}

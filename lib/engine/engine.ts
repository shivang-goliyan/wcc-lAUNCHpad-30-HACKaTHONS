// The deterministic workflow engine. The ONLY code allowed to change care state.
// Pure: (state, command, now) -> { state, effects, events, reply }. Never reads the wall clock.
import {
  EngineReject,
  TERMINAL_CASE_STATES,
  type Appointment,
  type Attempt,
  type AttemptOutcome,
  type CallPurpose,
  type Case,
  type CaseEvidence,
  type Contact,
  type Effect,
  type EngineEvent,
  type EngineResult,
  type EventCategory,
  type HouseholdState,
  type InputSource,
  type Occurrence,
  type PendingAction,
  type PendingKind,
  type TimeWindow,
  type ToolReply,
} from './types';
import { addDaysIso, atLocal, dateIso, DAY, inQuietHours, MIN, spokenDateEn, spokenDateHi, spokenEn, spokenHi, time24 } from './time';
import { checkAffirmation } from '../verify/affirmation';
import { verifySlot } from '../verify/slot';

// ---------------------------------------------------------------- commands

export type Confirmation = { source: InputSource; transcript?: string | null };

export type Command =
  | { type: 'device.heartbeat'; visibility: 'visible' | 'hidden' }
  | { type: 'reminder.respond'; occurrenceId?: string | null; response: 'taken' | 'not_taken' | 'snooze' | 'help' | 'done'; snoozeMinutes?: number; quote?: string | null; source: InputSource }
  | { type: 'checkin.respond'; quote?: string | null; source: InputSource }
  | { type: 'help.open'; quote?: string | null; kind: 'explicit_help' | 'distress'; source: InputSource }
  | { type: 'help.mistake'; caseId: string; source: InputSource }
  | { type: 'case.contactAction'; caseId: string; contactId: string; action: 'accept' | 'decline' | 'spoke' | 'still_needs_help'; note?: string | null; source: 'link' | 'phone'; quote?: string | null }
  | { type: 'appointment.propose'; clinicId: string; dateFrom: string; dateTo: string; window: TimeWindow; reason: Appointment['constraints']['reason']; note?: string | null }
  | { type: 'pending.confirm'; pendingId?: string | null; kind?: PendingKind; confirmation: Confirmation }
  | { type: 'pending.decline'; pendingId?: string | null; kind?: PendingKind; source: InputSource }
  | { type: 'call.result'; callId: string; status: 'completed' | 'no_answer' | 'busy' | 'failed' | 'voicemail'; extracted?: unknown }
  | { type: 'family.propose'; contact: 'primary' | 'backup'; reason: string; message?: string | null }
  | { type: 'memory.save'; text: string; consent: Confirmation }
  | { type: 'memory.delete'; memoryId?: string | null; text?: string | null }
  | { type: 'ui.quiet'; minutes: number }
  | { type: 'memory.prompt.add'; contactId: string; photoPath: string; caption: string }
  | { type: 'memory.story.draft'; promptId?: string | null; story: string; quote: string }
  | { type: 'notice.seen'; contactId: string };

// ---------------------------------------------------------------- context

class Ctx {
  effects: Effect[] = [];
  events: EngineEvent[] = [];
  reply: ToolReply | null = null;
  constructor(public s: HouseholdState, public now: number) {
    s.memoryPrompts ??= []; // documents created before Memory Corner existed
  }

  id(prefix: string) {
    this.s.seq += 1;
    return `${prefix}_${this.s.seq.toString(36)}`;
  }
  ev(category: EventCategory, actor: string, action: string, recordType: string, recordId: string | null, summary: string, detail?: Record<string, unknown>) {
    this.events.push({ at: this.now, category, actor, action, recordType, recordId, summary, detail });
  }
  get tz() {
    return this.s.recipient.timezone;
  }
  get today() {
    return dateIso(this.now, this.tz);
  }
  contact(id: string | null) {
    return this.s.contacts.find((c) => c.id === id) ?? null;
  }
  consent(purpose: HouseholdState['consents'][number]['purpose']) {
    return this.s.consents.some((c) => c.purpose === purpose && c.revokedAt === null);
  }
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

function done(ctx: Ctx): EngineResult {
  return { state: ctx.s, effects: ctx.effects, events: ctx.events, reply: ctx.reply };
}

const isTerminal = (c: Case) => TERMINAL_CASE_STATES.includes(c.state);
const openCase = (s: HouseholdState, type: Case['type']) => s.cases.find((c) => c.type === type && !isTerminal(c) && c.state !== 'unresolved') ?? null;

// ---------------------------------------------------------------- public API

export function decide(state: HouseholdState, cmd: Command, now: number): EngineResult {
  const ctx = new Ctx(clone(state), now);
  switch (cmd.type) {
    case 'device.heartbeat':
      ctx.s.device.lastSeenAt = now;
      ctx.s.device.visibility = cmd.visibility;
      break;
    case 'reminder.respond':
      reminderRespond(ctx, cmd);
      break;
    case 'checkin.respond':
      userResponded(ctx, cmd.source, cmd.quote ?? null, true);
      break;
    case 'help.open':
      helpOpen(ctx, cmd.source, cmd.quote ?? null, cmd.kind);
      break;
    case 'help.mistake':
      helpMistake(ctx, cmd.caseId);
      break;
    case 'case.contactAction':
      contactAction(ctx, cmd);
      break;
    case 'appointment.propose':
      appointmentPropose(ctx, cmd);
      break;
    case 'pending.confirm':
      pendingConfirm(ctx, cmd.pendingId ?? null, cmd.kind, cmd.confirmation);
      break;
    case 'pending.decline':
      pendingDecline(ctx, cmd.pendingId ?? null, cmd.kind);
      break;
    case 'call.result':
      callResult(ctx, cmd);
      break;
    case 'family.propose':
      familyPropose(ctx, cmd);
      break;
    case 'memory.save':
      memorySave(ctx, cmd.text, cmd.consent);
      break;
    case 'memory.delete':
      memoryDelete(ctx, cmd.memoryId ?? null, cmd.text ?? null);
      break;
    case 'ui.quiet':
      ctx.s.ui.quietUntil = now + Math.max(5, Math.min(240, cmd.minutes)) * MIN;
      ctx.ev('human', 'user', 'quiet_requested', 'ui', null, `Asked for quiet for ${cmd.minutes} min, respected, no follow-up`);
      ctx.reply = { ok: true, status: 'quiet', sayHint: 'Of course. I will stay quiet. Reminders will still appear on screen.' };
      break;
    case 'memory.prompt.add':
      memoryPromptAdd(ctx, cmd);
      break;
    case 'memory.story.draft':
      memoryStoryDraft(ctx, cmd);
      break;
    case 'notice.seen':
      break;
  }
  // Any command may have made timers due (e.g. a heartbeat after a long gap).
  return done(ctx);
}

export function tick(state: HouseholdState, now: number): EngineResult {
  const ctx = new Ctx(clone(state), now);
  materialiseOccurrences(ctx);
  tickOccurrences(ctx);
  tickCheckins(ctx);
  tickCases(ctx);
  tickPending(ctx);
  return done(ctx);
}

/** Earliest future time at which tick() would do something. */
export function nextWakeAt(s: HouseholdState, now: number): number | null {
  const times: number[] = [];
  const tz = s.recipient.timezone;
  for (const o of s.occurrences) {
    if (o.state === 'scheduled') times.push(o.notifyAt);
    if (o.state === 'awaiting_response') times.push(o.notifyAt + s.policy.reminderWindowMin * MIN);
  }
  for (const c of s.cases) if (!isTerminal(c) && c.timerAt) times.push(c.timerAt);
  for (const a of s.attempts) if (a.state === 'active' && a.timeoutAt) times.push(a.timeoutAt);
  for (const p of s.pending) if (p.state === 'open') times.push(p.expiresAt);
  // next scheduled reminders and check-ins (today + tomorrow)
  for (const d of [dateIso(now, tz), addDaysIso(dateIso(now, tz), 1)]) {
    for (const sch of s.schedules) if (sch.active) for (const t of sch.times) times.push(atLocal(d, t, tz) - 0);
    for (const t of s.policy.times) if (!s.checkinsCreated.includes(`${d} ${t}`)) times.push(atLocal(d, t, tz));
  }
  for (const sch of s.schedules) if (sch.active) for (const t of sch.onceAt) times.push(t);
  const future = times.filter((t) => t > now);
  return future.length ? Math.min(...future) : null;
}

// ---------------------------------------------------------------- reminders

function materialiseOccurrences(ctx: Ctx) {
  const { s, tz, now } = ctx;
  const days = [ctx.today, addDaysIso(ctx.today, 1)];
  const want: Array<{ scheduleId: string; dueAt: number }> = [];
  for (const sch of s.schedules) {
    if (!sch.active) continue;
    for (const d of days) for (const t of sch.times) want.push({ scheduleId: sch.id, dueAt: atLocal(d, t, tz) });
    for (const at of sch.onceAt) if (at > now - DAY && at < now + 2 * DAY) want.push({ scheduleId: sch.id, dueAt: at });
  }
  for (const w of want) {
    if (s.occurrences.some((o) => o.scheduleId === w.scheduleId && o.dueAt === w.dueAt)) continue;
    // never create reminders for times that passed before this household existed
    if (w.dueAt < s.createdAt) continue;
    s.occurrences.push({
      id: ctx.id('occ'),
      scheduleId: w.scheduleId,
      dueAt: w.dueAt,
      notifyAt: w.dueAt,
      state: 'scheduled',
      outcome: null,
      outcomeAt: null,
      outcomeSource: null,
      outcomeQuote: null,
      snoozes: 0,
      delivery: { attemptedAt: null, pageVisible: null, deviceLastSeen: null },
    });
  }
  // keep the document small: drop resolved occurrences older than 3 days
  s.occurrences = s.occurrences.filter((o) => o.state !== 'resolved' || o.dueAt > now - 3 * DAY);
}

function pageVisible(s: HouseholdState, now: number) {
  return s.device.visibility === 'visible' && s.device.lastSeenAt !== null && now - s.device.lastSeenAt < 45_000;
}

function scheduleLabel(s: HouseholdState, o: Occurrence) {
  return s.schedules.find((x) => x.id === o.scheduleId)?.label ?? 'Reminder';
}

function tickOccurrences(ctx: Ctx) {
  const { s, now } = ctx;
  for (const o of s.occurrences) {
    if (o.state === 'scheduled' && o.notifyAt <= now) {
      o.state = 'awaiting_response';
      o.delivery = { attemptedAt: now, pageVisible: pageVisible(s, now), deviceLastSeen: s.device.lastSeenAt };
      ctx.ev('state', 'engine', 'reminder_presented', 'occurrence', o.id, `Reminder shown: ${scheduleLabel(s, o)}${o.delivery.pageVisible ? '' : ' (Nami page not visible, delivery uncertain)'}`, {
        rule: 'schedule',
      });
    }
    if (o.state === 'awaiting_response' && o.notifyAt + s.policy.reminderWindowMin * MIN <= now) {
      o.state = 'resolved';
      o.outcome = o.delivery.pageVisible ? 'unacknowledged' : 'delivery_uncertain';
      o.outcomeAt = now;
      ctx.ev('state', 'engine', 'reminder_' + o.outcome, 'occurrence', o.id, `${scheduleLabel(s, o)}: ${o.outcome === 'unacknowledged' ? 'no response (not an emergency)' : 'delivery uncertain, page was not visible'}`);
    }
  }
}

function reminderRespond(ctx: Ctx, cmd: Extract<Command, { type: 'reminder.respond' }>) {
  const { s, now } = ctx;
  let o: Occurrence | undefined;
  if (cmd.occurrenceId) o = s.occurrences.find((x) => x.id === cmd.occurrenceId);
  else
    o =
      [...s.occurrences].filter((x) => x.state === 'awaiting_response').sort((a, b) => b.notifyAt - a.notifyAt)[0] ??
      [...s.occurrences].filter((x) => x.state === 'scheduled' && x.dueAt - now < 2 * 60 * MIN && x.dueAt - now > -MIN).sort((a, b) => a.dueAt - b.dueAt)[0];
  if (!o) throw new EngineReject('no_open_reminder', 'No open reminder', 'There is no reminder waiting right now.');
  s.device.lastExplicitResponseAt = now;
  const label = scheduleLabel(s, o);
  if (o.state === 'resolved') {
    ctx.ev('state', 'engine', 'duplicate_ack_ignored', 'occurrence', o.id, `Duplicate response for “${label}” ignored (already ${o.outcome})`);
    ctx.reply = { ok: true, status: 'already_recorded', sayHint: `That was already noted as: ${o.outcome?.replace(/_/g, ' ')}.` };
    return;
  }
  if (cmd.response === 'snooze') {
    const mins = Math.max(10, Math.min(120, cmd.snoozeMinutes ?? 15));
    o.state = 'scheduled';
    o.notifyAt = now + mins * MIN;
    o.snoozes += 1;
    ctx.ev('human', 'user', 'reminder_snoozed', 'occurrence', o.id, `“${label}” snoozed ${mins} min (the prescribed time is unchanged)`, { quote: cmd.quote });
    ctx.reply = { ok: true, status: 'snoozed', sayHint: `Okay, I will remind you again in ${mins} minutes.` };
    return;
  }
  o.state = 'resolved';
  o.outcomeAt = now;
  o.outcomeSource = cmd.source;
  o.outcomeQuote = cmd.quote ?? null;
  o.outcome = cmd.response === 'taken' ? 'taken_reported' : cmd.response === 'not_taken' ? 'not_taken_reported' : cmd.response === 'done' ? 'done_reported' : 'help_requested';
  ctx.ev('human', 'user', 'reminder_' + o.outcome, 'occurrence', o.id, `“${label}”: ${o.outcome === 'taken_reported' ? 'you said you took it' : o.outcome.replace(/_/g, ' ')} (${cmd.source})`, { quote: cmd.quote });
  // an explicit reminder reply also answers an open routine check-in
  const oc = openCase(s, 'checkin');
  if (oc) userResponded(ctx, cmd.source, cmd.quote ?? null, false);
  if (o.outcome === 'taken_reported' || o.outcome === 'done_reported') {
    ctx.reply = { ok: true, status: o.outcome, sayHint: 'Noted, you said you took it. Thank you.' };
  } else if (o.outcome === 'not_taken_reported') {
    const primary = escalationOrder(s, 'help')[0];
    const p = addPending(ctx, 'not_taken_contact_helper', o.id, { contactId: primary?.id ?? null }, `Should I let ${primary?.name ?? 'your contact'} know so they can help?`, `क्या मैं ${primary?.name ?? 'आपके परिवार'} को बता दूँ ताकि वे मदद कर सकें?`);
    ctx.reply = {
      ok: true,
      status: 'not_taken_reported',
      sayHint: `Noted that you have not taken it. I can't give medicine advice, please follow Dr. Mehta's instructions. ${p.readback}`,
      data: { pendingActionId: p.id },
    };
  } else {
    helpOpen(ctx, cmd.source, cmd.quote ?? null, 'explicit_help');
  }
}

// ---------------------------------------------------------------- check-ins & help cases

function escalationOrder(s: HouseholdState, type: Case['type']): Contact[] {
  const perm = type === 'checkin' ? 'checkins' : 'help';
  return [...s.contacts].filter((c) => c.permissions[perm]).sort((a, b) => a.priority - b.priority);
}

function tickCheckins(ctx: Ctx) {
  const { s, now, tz } = ctx;
  for (const d of [addDaysIso(ctx.today, -1), ctx.today]) {
    for (const t of s.policy.times) {
      const key = `${d} ${t}`;
      const due = atLocal(d, t, tz);
      if (due > now || s.checkinsCreated.includes(key)) continue;
      s.checkinsCreated.push(key);
      if (due < s.createdAt || now - due > s.policy.deadlineMin * MIN) continue; // too old to be meaningful
      const quiet = inQuietHours(due, tz, s.recipient.quietStart, s.recipient.quietEnd);
      const away = s.recipient.plannedAbsenceUntil !== null && s.recipient.plannedAbsenceUntil > now;
      if (quiet || away) {
        ctx.ev('state', 'engine', 'checkin_skipped', 'policy', null, `Check-in ${t} skipped, ${quiet ? 'quiet hours' : 'planned absence'} (agreed policy)`);
        continue;
      }
      if (openCase(s, 'checkin') || openCase(s, 'help')) continue;
      const c: Case = {
        id: ctx.id('case'),
        type: 'checkin',
        state: 'awaiting_response',
        openedAt: now,
        dueAt: due,
        deadlineAt: due + s.policy.deadlineMin * MIN,
        timerAt: now + s.policy.responseWindowMin * MIN,
        pageRetriesUsed: 0,
        contactOrder: escalationOrder(s, 'checkin').map((x) => x.id),
        step: -1,
        ownerContactId: null,
        evidence: null,
        resolution: null,
        mistakeUntil: null,
        openedBy: 'schedule',
        openingQuote: null,
      };
      s.cases.push(c);
      ctx.ev('state', 'engine', 'checkin_due', 'case', c.id, `Daily check-in (${t}) shown: “I'm here” / “Later” / “I need help”`, { rule: `policy.times includes ${t}` });
    }
  }
  s.checkinsCreated = s.checkinsCreated.slice(-20);
}

function evidenceSnapshot(ctx: Ctx, c: Case): CaseEvidence {
  const { s, now } = ctx;
  return {
    checkinDueAt: c.dueAt,
    pageLastSeenAt: s.device.lastSeenAt,
    pageVisible: pageVisible(s, now),
    lastExplicitResponseAt: s.device.lastExplicitResponseAt,
    quietHours: inQuietHours(now, ctx.tz, s.recipient.quietStart, s.recipient.quietEnd),
    plannedAbsence: s.recipient.plannedAbsenceUntil !== null && s.recipient.plannedAbsenceUntil > now,
    promptsShown: 1 + c.pageRetriesUsed,
    phoneFallback: c.evidence?.phoneFallback ?? null,
  };
}

function activeAttempts(s: HouseholdState, caseId: string) {
  return s.attempts.filter((a) => a.caseId === caseId && a.state === 'active');
}

function closeAttempt(ctx: Ctx, a: Attempt, outcome: AttemptOutcome, quote: string | null = null) {
  a.state = 'closed';
  a.outcome = outcome;
  a.closedAt = ctx.now;
  a.quote = quote ?? a.quote;
  if (a.callId && ['cancelled', 'superseded', 'responded'].includes(outcome)) {
    ctx.effects.push({ kind: 'cancel_call', key: `cancel:${a.callId}`, payload: { callId: a.callId } });
  }
}

function canPhone(s: HouseholdState, phone: string | null) {
  return s.phoneCallsEnabled && !!phone;
}

function tickCases(ctx: Ctx) {
  const { s, now } = ctx;
  for (const c of s.cases) {
    if (isTerminal(c)) continue;
    // attempt timeouts (contacts that never answered the link/phone)
    for (const a of activeAttempts(s, c.id)) {
      if (a.timeoutAt !== null && a.timeoutAt <= now) {
        closeAttempt(ctx, a, 'timeout');
        if (a.contactId) {
          ctx.ev('state', 'engine', 'contact_no_acceptance', 'attempt', a.id, `${ctx.contact(a.contactId)?.name} did not accept within ${s.policy.contactAckTimeoutMin} min`);
          if (c.state === 'escalating') escalateNext(ctx, c);
        }
      }
    }
    if (c.timerAt === null || c.timerAt > now) continue;
    if (c.state === 'awaiting_response' || c.state === 'retrying_page') {
      if (c.pageRetriesUsed < s.policy.pageRetries) {
        c.pageRetriesUsed += 1;
        c.state = 'retrying_page';
        c.timerAt = now + s.policy.retryWindowMin * MIN;
        ctx.ev('state', 'engine', 'checkin_retry', 'case', c.id, `No response yet, asked again on screen (retry ${c.pageRetriesUsed}/${s.policy.pageRetries})`);
      } else if (s.policy.phoneFallback) {
        c.state = 'phone_fallback';
        c.timerAt = c.deadlineAt;
        const att = newAttempt(ctx, c, null, ['phone']);
        if (canPhone(s, s.recipient.phone)) {
          att.callId = startCall(ctx, 'recipient_checkin', c.id, { to: s.recipient.phone, adapter: 'twilio', brief: { recipientName: s.recipient.addressAs } });
          c.evidence = { ...evidenceSnapshot(ctx, c), phoneFallback: 'pending' };
          ctx.ev('agent', 'engine', 'phone_fallback_started', 'case', c.id, `Calling ${s.recipient.addressAs}'s phone (agreed fallback)`);
        } else {
          closeAttempt(ctx, att, 'not_configured');
          c.evidence = { ...evidenceSnapshot(ctx, c), phoneFallback: 'not_configured' };
          ctx.ev('state', 'engine', 'phone_fallback_unavailable', 'case', c.id, 'Phone fallback not configured in this sandbox, waiting until the agreed deadline');
        }
      } else {
        c.timerAt = c.deadlineAt;
        c.state = 'phone_fallback';
      }
    } else if (c.state === 'phone_fallback') {
      for (const a of activeAttempts(s, c.id)) closeAttempt(ctx, a, 'superseded');
      c.evidence = evidenceSnapshot(ctx, c);
      ctx.ev('state', 'engine', 'deadline_reached', 'case', c.id, 'Check-in still unacknowledged at the agreed deadline, contacting family (facts only, no guesses)', {
        evidence: c.evidence,
      });
      c.timerAt = null;
      c.state = 'escalating';
      escalateNext(ctx, c);
    }
  }
}

function newAttempt(ctx: Ctx, c: Case, contactId: string | null, channels: Attempt['channels']): Attempt {
  const a: Attempt = {
    id: ctx.id('att'),
    caseId: c.id,
    contactId,
    channels,
    state: 'active',
    outcome: null,
    callId: null,
    startedAt: ctx.now,
    timeoutAt: contactId ? ctx.now + ctx.s.policy.contactAckTimeoutMin * MIN : null,
    closedAt: null,
    quote: null,
  };
  ctx.s.attempts.push(a);
  return a;
}

function startCall(ctx: Ctx, purpose: CallPurpose, relatedId: string, o: { to: string | null; adapter: 'sim' | 'twilio'; brief: Record<string, unknown>; clinicId?: string; contactId?: string }) {
  const callId = ctx.id(`call_${ctx.s.hid ?? 'hh'}`);
  ctx.effects.push({
    kind: 'start_call',
    key: `call:${callId}`,
    payload: { callId, purpose, relatedId, adapter: o.adapter, to: o.to, clinicId: o.clinicId, contactId: o.contactId, lang: ctx.s.recipient.language === 'en' ? 'en' : 'hi', brief: o.brief },
  });
  return callId;
}

function caseFacts(ctx: Ctx, c: Case) {
  const { s, tz } = ctx;
  const name = s.recipient.addressAs;
  if (c.type === 'help') {
    return {
      en: `${name} pressed Get Help at ${time24(c.openedAt, tz)}.${c.openingQuote ? ` She said: “${c.openingQuote}”.` : ''}`,
      hi: `${name} ने ${time24(c.openedAt, tz)} बजे मदद माँगी है।`,
    };
  }
  const ev = c.evidence;
  const seen = ev?.pageLastSeenAt ? `The Nami page was last seen at ${time24(ev.pageLastSeenAt, tz)}.` : 'The Nami page has not been seen today.';
  return {
    en: `${name}'s ${time24(c.dueAt, tz)} check-in has not been acknowledged. ${seen}`,
    hi: `${name} का ${time24(c.dueAt, tz)} बजे का चेक-इन जवाब नहीं मिला। ${ev?.pageLastSeenAt ? `Nami पेज आख़िरी बार ${time24(ev.pageLastSeenAt, tz)} बजे देखा गया।` : ''}`,
  };
}

function escalateNext(ctx: Ctx, c: Case) {
  const { s } = ctx;
  for (const a of activeAttempts(s, c.id)) if (a.contactId) closeAttempt(ctx, a, 'superseded');
  c.step += 1;
  if (c.step >= c.contactOrder.length) {
    c.state = 'unresolved';
    c.timerAt = null;
    ctx.ev('state', 'engine', 'case_unresolved', 'case', c.id, 'Nobody has accepted follow-up yet. This is NOT resolved, links stay open for a late acceptance.');
    return;
  }
  const contact = ctx.contact(c.contactOrder[c.step])!;
  const att = newAttempt(ctx, c, contact.id, canPhone(s, contact.phone) ? ['link', 'phone'] : ['link']);
  const facts = caseFacts(ctx, c);
  if (canPhone(s, contact.phone)) {
    att.callId = startCall(ctx, 'contact_alert', att.id, {
      to: contact.phone,
      adapter: 'twilio',
      contactId: contact.id,
      brief: { contactName: contact.name, recipientName: s.recipient.addressAs, caseKind: c.type, factsEn: facts.en, factsHi: facts.hi },
    });
  }
  s.notices.push({ id: ctx.id('ntc'), contactId: contact.id, at: ctx.now, text: facts.en, caseId: c.id });
  ctx.ev('agent', 'engine', 'contact_alerted', 'attempt', att.id, `Asked ${contact.name} (${contact.relation}) to accept follow-up via ${att.channels.join(' + ')}, waiting for an explicit yes`, {
    rule: `escalation step ${c.step + 1}/${c.contactOrder.length}`,
    facts: facts.en,
  });
}

function helpOpen(ctx: Ctx, source: InputSource, quote: string | null, kind: 'explicit_help' | 'distress') {
  const { s, now } = ctx;
  s.device.lastExplicitResponseAt = now;
  const existing = openCase(s, 'help');
  if (existing) {
    ctx.reply = { ok: true, status: existing.state, sayHint: 'I am already contacting your people. If this is an emergency, please call 112.', data: { caseId: existing.id } };
    return;
  }
  // a help request supersedes an open routine check-in
  const chk = openCase(s, 'checkin');
  if (chk) {
    for (const a of activeAttempts(s, chk.id)) closeAttempt(ctx, a, 'superseded');
    chk.state = 'resolved_user_responded';
    chk.timerAt = null;
    chk.resolution = { by: 'user', note: 'Superseded by a help request', at: now };
  }
  const c: Case = {
    id: ctx.id('case'),
    type: 'help',
    state: 'escalating',
    openedAt: now,
    dueAt: now,
    deadlineAt: now,
    timerAt: null,
    pageRetriesUsed: 0,
    contactOrder: escalationOrder(s, 'help').map((x) => x.id),
    step: -1,
    ownerContactId: null,
    evidence: null,
    resolution: null,
    mistakeUntil: now + 10_000,
    openedBy: source,
    openingQuote: quote,
  };
  s.cases.push(c);
  ctx.ev('human', 'user', 'help_requested', 'case', c.id, `Get Help (${source}${kind === 'distress' ? ', distress words' : ''}), contacting the agreed person immediately`, { quote });
  escalateNext(ctx, c);
  const first = ctx.contact(c.contactOrder[0]);
  ctx.reply = {
    ok: true,
    status: c.state,
    sayHint: first ? `I am contacting ${first.name} right now. If this is an emergency, please call 112.` : 'No help contact is set up. Please call 112 if this is an emergency.',
    data: { caseId: c.id },
  };
}

function helpMistake(ctx: Ctx, caseId: string) {
  const c = ctx.s.cases.find((x) => x.id === caseId && x.type === 'help');
  if (!c || isTerminal(c)) throw new EngineReject('no_open_help', 'No open help case');
  const reached = ctx.s.attempts.filter((a) => a.caseId === c.id && a.contactId).map((a) => a.contactId!);
  for (const a of activeAttempts(ctx.s, c.id)) closeAttempt(ctx, a, 'cancelled');
  c.state = 'cancelled_mistake';
  c.timerAt = null;
  c.resolution = { by: 'user', note: 'Pressed by mistake', at: ctx.now };
  for (const id of new Set(reached)) ctx.s.notices.push({ id: ctx.id('ntc'), contactId: id, at: ctx.now, text: `${ctx.s.recipient.addressAs} says the help request was pressed by mistake.`, caseId: c.id });
  ctx.ev('human', 'user', 'help_cancelled_mistake', 'case', c.id, 'Help request cancelled as a mistake; contacts already reached were told');
  ctx.reply = { ok: true, status: 'cancelled_mistake', sayHint: 'Okay, I have cancelled it and told anyone I had already contacted.' };
}

/** The user herself responded — closes an open routine check-in, cancels pending calls. */
function userResponded(ctx: Ctx, source: InputSource, quote: string | null, explicit: boolean) {
  const { s, now, tz } = ctx;
  s.device.lastExplicitResponseAt = now;
  const c = openCase(s, 'checkin') ?? s.cases.find((x) => x.type === 'checkin' && x.state === 'unresolved') ?? null;
  if (!c) {
    if (explicit) ctx.reply = { ok: true, status: 'no_open_checkin', sayHint: 'Thank you for letting me know.' };
    return;
  }
  const notify = new Set<string>();
  for (const a of s.attempts.filter((x) => x.caseId === c.id && x.contactId)) notify.add(a.contactId!);
  for (const a of activeAttempts(s, c.id)) closeAttempt(ctx, a, 'cancelled');
  c.state = 'resolved_user_responded';
  c.timerAt = null;
  c.resolution = { by: 'user', note: quote, at: now };
  for (const id of notify) s.notices.push({ id: ctx.id('ntc'), contactId: id, at: now, text: `${s.recipient.addressAs} responded herself at ${time24(now, tz)} (${source}).`, caseId: c.id });
  ctx.ev('human', 'user', 'checkin_responded', 'case', c.id, `${s.recipient.addressAs} responded (${source})${notify.size ? ', pending contact attempts cancelled and contacts informed' : ''}`, { quote });
  if (explicit) ctx.reply = { ok: true, status: 'checkin_responded', sayHint: notify.size ? 'Thank you! I have told your family you responded.' : 'Thank you, noted.' };
}

function contactAction(ctx: Ctx, cmd: Extract<Command, { type: 'case.contactAction' }>) {
  const { s, now } = ctx;
  const c = s.cases.find((x) => x.id === cmd.caseId);
  if (!c) throw new EngineReject('no_case', 'Unknown case');
  const contact = ctx.contact(cmd.contactId);
  if (!contact || !c.contactOrder.includes(contact.id)) throw new EngineReject('not_authorised', 'Contact not part of this case');
  if (isTerminal(c)) {
    ctx.ev('external', `contact:${contact.id}`, 'late_action_ignored', 'case', c.id, `${contact.name}'s “${cmd.action}” arrived after the case closed, no change`);
    ctx.reply = { ok: true, status: c.state, sayHint: 'This case is already closed.' };
    return;
  }
  const att = activeAttempts(s, c.id).find((a) => a.contactId === contact.id);
  const who = `contact:${contact.id}`;
  const familyAsked = ['escalating', 'owner_accepted', 'unresolved'].includes(c.state);
  if (!familyAsked) throw new EngineReject('not_yet_escalated', 'Family has not been asked yet, the agreed check-in steps are still running');
  if ((cmd.action === 'spoke' || cmd.action === 'still_needs_help') && c.state === 'owner_accepted' && c.ownerContactId !== contact.id)
    throw new EngineReject('not_owner', `${ctx.contact(c.ownerContactId)?.name} is currently following up`);
  switch (cmd.action) {
    case 'accept': {
      if (c.state === 'owner_accepted' && c.ownerContactId === contact.id) {
        ctx.ev('external', who, 'duplicate_accept_ignored', 'case', c.id, `Duplicate acceptance from ${contact.name} ignored`);
        break;
      }
      if (c.state === 'owner_accepted' && c.ownerContactId !== contact.id) {
        ctx.ev('external', who, 'accept_while_owned', 'case', c.id, `${contact.name} also offered to help; ${ctx.contact(c.ownerContactId)?.name} remains the current owner`);
        break;
      }
      for (const a of activeAttempts(s, c.id)) closeAttempt(ctx, a, a === att ? 'accepted' : 'superseded', a === att ? (cmd.quote ?? null) : null);
      if (!att) s.attempts.push({ id: ctx.id('att'), caseId: c.id, contactId: contact.id, channels: [cmd.source], state: 'closed', outcome: 'accepted', callId: null, startedAt: now, timeoutAt: null, closedAt: now, quote: cmd.quote ?? null });
      c.state = 'owner_accepted';
      c.ownerContactId = contact.id;
      c.timerAt = null;
      ctx.ev('external', who, 'follow_up_accepted', 'case', c.id, `${contact.name} accepted follow-up (${cmd.source}). Wellbeing is NOT yet confirmed, awaiting their report.`, { quote: cmd.quote });
      break;
    }
    case 'decline':
      if (att) closeAttempt(ctx, att, 'declined', cmd.quote ?? null);
      ctx.ev('external', who, 'follow_up_declined', 'case', c.id, `${contact.name} cannot help right now, moving to the next agreed contact`);
      if (c.state === 'escalating' || c.state === 'unresolved') {
        if (c.contactOrder[c.step] === contact.id) escalateNext(ctx, c);
      }
      break;
    case 'spoke':
      if (c.ownerContactId !== contact.id && c.state !== 'owner_accepted') {
        // accept + report in one go
        for (const a of activeAttempts(s, c.id)) closeAttempt(ctx, a, a.contactId === contact.id ? 'accepted' : 'superseded');
        c.ownerContactId = contact.id;
      }
      c.state = 'resolved_human_reported';
      c.timerAt = null;
      c.resolution = { by: who, note: cmd.note ?? null, at: now };
      ctx.ev('external', who, 'human_reported_outcome', 'case', c.id, `Human-reported by ${contact.name}: “${cmd.note || 'spoke with her'}”`, { note: cmd.note });
      break;
    case 'still_needs_help':
      ctx.ev('external', who, 'still_needs_help', 'case', c.id, `${contact.name} reports she still needs help, continuing to the next agreed contact`, { note: cmd.note });
      c.ownerContactId = null;
      c.state = 'escalating';
      if (c.contactOrder[c.step] !== contact.id) c.step = c.contactOrder.indexOf(contact.id);
      escalateNext(ctx, c);
      break;
  }
  ctx.reply = { ok: true, status: c.state, sayHint: '' };
}

// ---------------------------------------------------------------- pending actions

function addPending(ctx: Ctx, kind: PendingKind, relatedId: string | null, payload: Record<string, unknown>, readback: string, readbackHi: string, ttlMin = 15): PendingAction {
  // only one open pending action of a kind at a time
  for (const p of ctx.s.pending) if (p.state === 'open' && p.kind === kind) p.state = 'expired';
  const p: PendingAction = { id: ctx.id('pa'), kind, relatedId, payload, state: 'open', createdAt: ctx.now, expiresAt: ctx.now + ttlMin * MIN, readback, readbackHi };
  ctx.s.pending.push(p);
  return p;
}

function findPending(ctx: Ctx, id: string | null, kind?: PendingKind) {
  const open = ctx.s.pending.filter((p) => p.state === 'open' && p.expiresAt > ctx.now);
  const p = id ? open.find((x) => x.id === id) : kind ? open.filter((x) => x.kind === kind).at(-1) : open.at(-1);
  if (!p) throw new EngineReject('no_pending_action', 'Nothing is waiting for confirmation', 'There is nothing waiting for your confirmation right now.');
  return p;
}

function verifyConfirmation(ctx: Ctx, conf: Confirmation) {
  if (conf.source === 'voice' || conf.source === 'text' || conf.source === 'phone') {
    const r = checkAffirmation(conf.transcript);
    ctx.ev('agent', 'verifier', r.ok ? 'consent_verified' : 'consent_rejected', 'consent', null, r.ok ? `Consent verified from the user's own words: “${conf.transcript}”` : `Consent NOT accepted (${r.reason}), user words: “${conf.transcript ?? ''}”`, {
      matched: r.matched,
    });
    if (!r.ok) throw new EngineReject('consent_not_verified', r.reason, 'I did not hear a clear yes. Please say yes, or press the Yes button.');
  } else {
    ctx.ev('human', 'user', 'consent_button', 'consent', null, `Confirmed with ${conf.source}`);
  }
}

function tickPending(ctx: Ctx) {
  for (const p of ctx.s.pending) {
    if (p.state === 'open' && p.expiresAt <= ctx.now) {
      p.state = 'expired';
      ctx.ev('state', 'engine', 'pending_expired', 'pending', p.id, `Unconfirmed request expired: ${p.readback}`);
      if (p.kind === 'permit_clinic_call' && p.relatedId) {
        const a = ctx.s.appointments.find((x) => x.id === p.relatedId);
        if (a && a.state === 'draft') a.state = 'cancelled';
      }
    }
  }
  ctx.s.pending = ctx.s.pending.filter((p) => p.state === 'open' || p.createdAt > ctx.now - DAY);
}

function pendingConfirm(ctx: Ctx, id: string | null, kind: PendingKind | undefined, conf: Confirmation) {
  const p = findPending(ctx, id, kind);
  verifyConfirmation(ctx, conf);
  p.state = 'confirmed';
  switch (p.kind) {
    case 'permit_clinic_call':
      return startAvailability(ctx, p.relatedId!);
    case 'approve_slot':
      return approveSlot(ctx, p.relatedId!, conf);
    case 'call_family':
      return sendFamilyRequest(ctx, p);
    case 'send_memory':
      return memorySend(ctx, p);
    case 'not_taken_contact_helper': {
      const contact = ctx.contact((p.payload.contactId as string) ?? null);
      if (contact) {
        ctx.s.notices.push({ id: ctx.id('ntc'), contactId: contact.id, at: ctx.now, text: `${ctx.s.recipient.addressAs} said she has not taken a scheduled medicine and asked you to help.`, caseId: null });
        ctx.ev('agent', 'engine', 'helper_notified', 'contact', contact.id, `Told ${contact.name} (with consent) that a medicine was not taken`);
      }
      ctx.reply = { ok: true, status: 'helper_notified', sayHint: `I have let ${contact?.name ?? 'your contact'} know.` };
    }
  }
}

function pendingDecline(ctx: Ctx, id: string | null, kind?: PendingKind) {
  const p = findPending(ctx, id, kind);
  p.state = 'declined';
  if (p.relatedId) {
    const a = ctx.s.appointments.find((x) => x.id === p.relatedId);
    if (a && (a.state === 'draft' || a.state === 'awaiting_user_approval')) a.state = 'cancelled';
    const mp = ctx.s.memoryPrompts.find((x) => x.id === p.relatedId);
    if (mp && p.kind === 'send_memory') mp.state = 'kept_private';
  }
  ctx.ev('human', 'user', 'pending_declined', 'pending', p.id, `Declined: ${p.readback}`);
  ctx.reply = { ok: true, status: 'declined', sayHint: 'Okay, I will not do that.' };
}

// ---------------------------------------------------------------- appointments

function appointmentPropose(ctx: Ctx, cmd: Extract<Command, { type: 'appointment.propose' }>) {
  const { s, now, tz } = ctx;
  const clinic = s.clinics.find((c) => c.id === cmd.clinicId);
  if (!clinic) throw new EngineReject('unknown_clinic', 'Unknown clinic', 'I only call clinics you have approved. Which clinic do you mean?');
  if (!clinic.approved) throw new EngineReject('clinic_not_approved', 'Clinic not approved', `${clinic.name} is not on your approved list yet. You or Arjun can add it in Settings.`);
  if (!ctx.consent('clinic_calls') || !ctx.consent('appointment_booking'))
    throw new EngineReject('no_consent', 'Missing consent', 'You have not given me permission to call clinics yet. You can turn it on in Settings.');
  const today = dateIso(now, tz);
  let dateFrom = cmd.dateFrom;
  const dateTo = cmd.dateTo;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) throw new EngineReject('bad_dates', 'Bad date format');
  if (dateFrom < today) dateFrom = today;
  if (dateTo < dateFrom) throw new EngineReject('bad_range', 'Date range is backwards', 'Which days would suit you?');
  if (dateTo > addDaysIso(today, 21)) throw new EngineReject('range_too_far', 'More than 3 weeks ahead', 'I can only look up to three weeks ahead. Which week would you like?');
  const requestKey = [clinic.id, dateFrom, dateTo, cmd.window].join('|');
  const existing = s.appointments.find((a) => a.requestKey === requestKey && !['cancelled', 'failed_needs_help', 'confirmed'].includes(a.state));
  if (existing) {
    ctx.ev('state', 'engine', 'duplicate_request', 'appointment', existing.id, 'Same appointment request already open, reusing it (no duplicate booking)');
    ctx.reply = { ok: true, status: existing.state, sayHint: `I am already working on that request, it is ${existing.state.replace(/_/g, ' ')}.`, data: { requestId: existing.id } };
    return;
  }
  const reasonLabel = { follow_up: 'follow-up', new_concern: 'a new concern', test_results: 'discuss test results', other: 'a consultation' }[cmd.reason];
  const disclosure = clinic.permittedDisclosure.map((d) => (d === 'first_name' ? `first name (${s.recipient.firstName})` : d === 'last_initial' ? `surname initial (${s.recipient.lastName[0]}.)` : `reason: ${reasonLabel}`));
  const a: Appointment = {
    id: ctx.id('apt'),
    clinicId: clinic.id,
    state: 'draft',
    requestKey,
    constraints: { dateFrom, dateTo, window: cmd.window, reason: cmd.reason, note: cmd.note ?? null },
    disclosure,
    createdAt: now,
    callIds: [],
    availabilityAttempts: 0,
    offeredSlot: null,
    alternatives: [],
    verification: [],
    approvedAt: null,
    approvalEvidence: null,
    confirmedAt: null,
    confirmationEvidence: null,
    failureReason: null,
  };
  s.appointments.push(a);
  const winEn = cmd.window === 'any' ? 'any time' : `in the ${cmd.window}`;
  const winHi = { morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम', any: 'किसी भी समय' }[cmd.window];
  const readback = `Call ${clinic.name} to ask for an appointment (${reasonLabel}) between ${spokenDateEn(dateFrom)} and ${spokenDateEn(dateTo)}, ${winEn}. I will share only your ${disclosure.join(' and ')}. Shall I call?`;
  const readbackHi = `${clinic.nameHi} को कॉल करके ${spokenDateHi(dateFrom)} से ${spokenDateHi(dateTo)} के बीच ${winHi} का अपॉइंटमेंट पूछूँ? मैं सिर्फ़ आपका नाम और कारण बताऊँगी। कॉल करूँ?`;
  const p = addPending(ctx, 'permit_clinic_call', a.id, {}, readback, readbackHi);
  ctx.ev('agent', 'nami', 'appointment_proposed', 'appointment', a.id, `Request drafted, waiting for permission to call ${clinic.name}`, { constraints: a.constraints });
  ctx.reply = { ok: true, status: 'needs_confirmation', sayHint: readback, data: { pendingActionId: p.id, requestId: a.id, readbackHi } };
}

function clinicBrief(ctx: Ctx, a: Appointment, goal: 'availability' | 'confirm') {
  const { s } = ctx;
  const clinic = s.clinics.find((c) => c.id === a.clinicId)!;
  return {
    goal,
    clinicName: clinic.name,
    clinicNameHi: clinic.nameHi,
    doctor: clinic.doctor,
    patientFirstName: s.recipient.firstName,
    patientLastInitial: clinic.permittedDisclosure.includes('last_initial') ? s.recipient.lastName[0] : null,
    reason: a.constraints.reason,
    dateFrom: a.constraints.dateFrom,
    dateTo: a.constraints.dateTo,
    dateFromSpoken: spokenDateEn(a.constraints.dateFrom),
    dateToSpoken: spokenDateEn(a.constraints.dateTo),
    window: a.constraints.window,
    permittedFields: a.disclosure,
    approvedSlot: a.offeredSlot ? { dateIso: a.offeredSlot.dateIso, time24h: a.offeredSlot.time24h, spokenEn: spokenEn(a.offeredSlot.startAt, ctx.tz), spokenHi: spokenHi(a.offeredSlot.startAt, ctx.tz) } : null,
    scenario: clinic.simScenario,
    forbiddenDetails: [s.recipient.lastName, s.recipient.phone ?? ''].filter(Boolean),
  };
}

function clinicAdapter(ctx: Ctx, clinicId: string): { adapter: 'sim' | 'twilio'; to: string | null } {
  const clinic = ctx.s.clinics.find((c) => c.id === clinicId)!;
  return clinic.mode === 'phone' && canPhone(ctx.s, clinic.phone) ? { adapter: 'twilio', to: clinic.phone } : { adapter: 'sim', to: null };
}

function startAvailability(ctx: Ctx, apptId: string) {
  const a = ctx.s.appointments.find((x) => x.id === apptId)!;
  if (!['draft', 'finding_availability'].includes(a.state)) throw new EngineReject('bad_state', `Appointment is ${a.state}`);
  a.state = 'finding_availability';
  a.availabilityAttempts += 1;
  const { adapter, to } = clinicAdapter(ctx, a.clinicId);
  const callId = startCall(ctx, 'clinic_availability', a.id, { adapter, to, clinicId: a.clinicId, brief: clinicBrief(ctx, a, 'availability') });
  a.callIds.push(callId);
  const clinic = ctx.s.clinics.find((c) => c.id === a.clinicId)!;
  ctx.ev('agent', 'caller', 'clinic_call_started', 'appointment', a.id, `Caller agent is calling ${clinic.name}${adapter === 'sim' ? ' (simulated clinic)' : ' (real phone call)'}`, { callId });
  ctx.reply = { ok: true, status: 'finding_availability', sayHint: `Thank you. I am calling ${clinic.name} now. I will come back with the options before booking anything.`, data: { requestId: a.id, callId } };
}

function approveSlot(ctx: Ctx, apptId: string, conf: Confirmation) {
  const a = ctx.s.appointments.find((x) => x.id === apptId)!;
  if (a.state !== 'awaiting_user_approval' || !a.offeredSlot) throw new EngineReject('bad_state', `Appointment is ${a.state}`);
  a.state = 'pending_clinic_confirmation';
  a.approvedAt = ctx.now;
  a.approvalEvidence = { source: conf.source, quote: conf.transcript ?? null };
  const { adapter, to } = clinicAdapter(ctx, a.clinicId);
  const callId = startCall(ctx, 'clinic_confirm', a.id, { adapter, to, clinicId: a.clinicId, brief: clinicBrief(ctx, a, 'confirm') });
  a.callIds.push(callId);
  ctx.ev('agent', 'caller', 'clinic_confirm_started', 'appointment', a.id, `Approved by user, calling the clinic to confirm ${spokenEn(a.offeredSlot.startAt, ctx.tz)}. Not booked until the clinic confirms.`);
  ctx.reply = { ok: true, status: 'pending_clinic_confirmation', sayHint: 'Thank you. I am confirming it with the clinic now. It is not booked until they confirm.' };
}

type Extracted = Record<string, unknown> & {
  outcome?: string;
  slot?: { date_iso: string; time_24h: string; weekday_spoken?: string | null; quote: string } | null;
  alternatives?: Array<{ date_iso: string; time_24h: string; quote: string }>;
  confirmed?: boolean;
  quote?: string;
  instructions?: string | null;
  accepted?: 'yes' | 'no' | 'unclear' | 'not_reached';
  voicemail?: boolean;
  responded?: boolean;
};

function callResult(ctx: Ctx, cmd: Extract<Command, { type: 'call.result' }>) {
  const { s } = ctx;
  const key = `${cmd.callId}:${cmd.status}`;
  if (s.handledCallResults.includes(key)) {
    ctx.ev('external', 'system', 'duplicate_callback_ignored', 'call', cmd.callId, 'Duplicate call result ignored (idempotent)');
    return;
  }
  s.handledCallResults.push(key);
  s.handledCallResults = s.handledCallResults.slice(-200);
  const x = (cmd.extracted ?? {}) as Extracted;
  if (cmd.status === 'completed' && cmd.extracted && Object.keys(cmd.extracted).length)
    ctx.ev('agent', 'extractor', 'facts_extracted', 'call', cmd.callId, `Extractor turned the call transcript into quoted facts${x.quote || x.slot?.quote ? `: “${(x.slot?.quote ?? x.quote ?? '').slice(0, 80)}”` : ''}`, { extracted: cmd.extracted });

  // clinic calls
  const appt = s.appointments.find((a) => a.callIds.includes(cmd.callId));
  if (appt) return clinicCallResult(ctx, appt, cmd.callId, cmd.status, x);

  // contact alert calls
  const att = s.attempts.find((a) => a.callId === cmd.callId);
  if (att) {
    const c = s.cases.find((cc) => cc.id === att.caseId)!;
    if (att.contactId === null) {
      // recipient check-in phone fallback
      if (cmd.status === 'completed' && x.responded && x.quote) userResponded(ctx, 'phone', x.quote, false);
      else if (c.evidence) c.evidence.phoneFallback = cmd.status === 'completed' ? 'no_answer' : cmd.status === 'voicemail' ? 'voicemail' : cmd.status === 'busy' ? 'busy' : cmd.status === 'failed' ? 'failed' : 'no_answer';
      if (att.state === 'active') closeAttempt(ctx, att, cmd.status === 'completed' ? (x.responded ? 'responded' : 'no_answer') : (cmd.status as AttemptOutcome));
      return;
    }
    if (att.state !== 'active' || isTerminal(c)) {
      ctx.ev('external', 'system', 'late_call_result', 'attempt', att.id, 'Call result arrived for a closed attempt, no change');
      return;
    }
    if (cmd.status === 'completed' && !x.voicemail && x.accepted === 'yes' && x.quote && checkAffirmation(x.quote).ok) {
      return contactAction(ctx, { type: 'case.contactAction', caseId: c.id, contactId: att.contactId, action: 'accept', source: 'phone', quote: x.quote });
    }
    if (cmd.status === 'completed' && x.accepted === 'no') {
      return contactAction(ctx, { type: 'case.contactAction', caseId: c.id, contactId: att.contactId, action: 'decline', source: 'phone', quote: x.quote ?? null });
    }
    const outcome: AttemptOutcome = x.voicemail || cmd.status === 'voicemail' ? 'voicemail' : cmd.status === 'completed' ? 'no_answer' : (cmd.status as AttemptOutcome);
    closeAttempt(ctx, att, outcome);
    ctx.ev('external', 'system', 'contact_call_' + outcome, 'attempt', att.id, `Call to ${ctx.contact(att.contactId)?.name}: ${outcome.replace('_', ' ')}, not an acknowledgement`);
    if (c.state === 'escalating') escalateNext(ctx, c);
  }
}

function clinicCallResult(ctx: Ctx, a: Appointment, callId: string, status: string, x: Extracted) {
  const { s, now, tz } = ctx;
  const clinic = s.clinics.find((c) => c.id === a.clinicId)!;
  const failCall = status !== 'completed' || x.outcome === 'not_reached';
  if (a.state === 'finding_availability') {
    if (failCall) {
      if (a.availabilityAttempts < 2) {
        ctx.ev('external', 'system', 'clinic_call_failed', 'appointment', a.id, `Clinic call ${status.replace('_', ' ')}, retrying once`);
        return startAvailability(ctx, a.id);
      }
      a.state = 'failed_needs_help';
      a.failureReason = `Could not reach ${clinic.name} (${status.replace('_', ' ')})`;
      ctx.ev('state', 'engine', 'appointment_failed', 'appointment', a.id, a.failureReason);
      return;
    }
    const slot = x.slot ? { dateIso: x.slot.date_iso, time24h: x.slot.time_24h, weekdaySpoken: x.slot.weekday_spoken ?? null, quote: x.slot.quote } : null;
    const v = verifySlot({ slot, constraints: a.constraints, clinic, now, tz, purpose: 'availability' });
    a.verification = v.checks;
    a.alternatives = (x.alternatives ?? []).slice(0, 3).map((alt) => ({ startAt: atLocal(alt.date_iso, alt.time_24h, tz), dateIso: alt.date_iso, time24h: alt.time_24h, weekdaySpoken: null, quote: alt.quote }));
    ctx.ev('agent', 'verifier', v.pass ? 'slot_verified' : 'slot_rejected', 'appointment', a.id, v.pass ? `Verifier: all ${v.checks.length} checks passed` : `Verifier rejected: ${v.checks.filter((c) => !c.pass).map((c) => c.detail).join('; ')}`, {
      checks: v.checks,
    });
    if (!v.pass || !v.offer) {
      a.state = 'failed_needs_help';
      a.failureReason = x.outcome === 'no_slot_in_range' || x.outcome === 'alternatives_only' ? 'No slot in your requested range' : 'The offered slot did not pass verification';
      return;
    }
    a.offeredSlot = v.offer;
    a.state = 'awaiting_user_approval';
    const p = addPending(ctx, 'approve_slot', a.id, {}, `${clinic.name} can see you on ${spokenEn(v.offer.startAt, tz)}. Shall I confirm it?`, `${clinic.nameHi} में ${spokenHi(v.offer.startAt, tz)} का समय मिला है। कन्फर्म कर दूँ?`, 30);
    ctx.ev('agent', 'engine', 'awaiting_user_approval', 'appointment', a.id, `Slot found: ${spokenEn(v.offer.startAt, tz)}, waiting for ${s.recipient.addressAs}'s approval`, { pendingId: p.id });
    return;
  }
  if (a.state === 'pending_clinic_confirmation') {
    if (failCall) {
      a.state = 'failed_needs_help';
      a.failureReason = `Confirmation call ${status.replace('_', ' ')}, the appointment is NOT confirmed`;
      ctx.ev('state', 'engine', 'appointment_failed', 'appointment', a.id, a.failureReason);
      return;
    }
    const slot = x.slot ? { dateIso: x.slot.date_iso, time24h: x.slot.time_24h, weekdaySpoken: x.slot.weekday_spoken ?? null, quote: x.slot.quote ?? x.quote ?? '' } : null;
    const v = verifySlot({ slot, constraints: a.constraints, clinic, now, tz, purpose: 'confirmation', approvedSlot: a.offeredSlot });
    const confirmed = x.confirmed === true && !!x.quote && v.pass;
    a.verification = v.checks.concat([{ check: 'clinic_said_confirmed', pass: x.confirmed === true && !!x.quote, detail: x.quote ? `“${x.quote}”` : 'No explicit confirmation heard' }]);
    if (!confirmed) {
      a.state = 'failed_needs_help';
      a.failureReason = 'The clinic did not clearly confirm the approved slot. NOT booked';
      ctx.ev('agent', 'verifier', 'confirmation_rejected', 'appointment', a.id, a.failureReason, { checks: a.verification });
      return;
    }
    a.state = 'confirmed';
    a.confirmedAt = now;
    a.confirmationEvidence = { quote: x.quote!, callId, instructions: x.instructions ?? null };
    if (clinic.mode === 'sim' && a.offeredSlot?.slotId) {
      const cs = clinic.simCalendar.find((z) => z.id === a.offeredSlot!.slotId);
      if (cs) {
        cs.status = 'booked';
        cs.bookedFor = s.recipient.firstName;
      }
    }
    const start = a.offeredSlot!.startAt;
    const dayBefore = atLocal(addDaysIso(a.offeredSlot!.dateIso, -1), '18:00', tz);
    s.schedules.push({
      id: ctx.id('sch'),
      kind: 'appointment',
      label: `Appointment at ${clinic.name}, ${spokenEn(start, tz)}`,
      labelHi: `${clinic.nameHi}, ${spokenHi(start, tz)}`,
      instructions: x.instructions ?? '',
      times: [],
      onceAt: [dayBefore, start - 60 * MIN].filter((t) => t > now),
      active: true,
      appointmentId: a.id,
    });
    ctx.ev('agent', 'verifier', 'appointment_confirmed', 'appointment', a.id, `Confirmed by the clinic: “${x.quote}”. Reminders added for the evening before and 1 hour before.`, { checks: a.verification });
  }
}

// ---------------------------------------------------------------- family & memory

function familyPropose(ctx: Ctx, cmd: Extract<Command, { type: 'family.propose' }>) {
  const order = [...ctx.s.contacts].sort((a, b) => a.priority - b.priority);
  const contact = cmd.contact === 'backup' ? order[1] : order[0];
  if (!contact) throw new EngineReject('no_contact', 'No contact', 'No family contact is set up yet.');
  const p = addPending(ctx, 'call_family', contact.id, { reason: cmd.reason, message: cmd.message ?? null }, `Shall I ask ${contact.name} to call you${cmd.message ? ` and tell them: “${cmd.message}”` : ''}?`, `क्या मैं ${contact.name} को आपको फ़ोन करने के लिए कहूँ?`);
  ctx.reply = { ok: true, status: 'needs_confirmation', sayHint: p.readback, data: { pendingActionId: p.id } };
}

function sendFamilyRequest(ctx: Ctx, p: PendingAction) {
  const contact = ctx.contact(p.relatedId)!;
  const fr = { id: ctx.id('fam'), contactId: contact.id, reason: String(p.payload.reason ?? 'chat'), message: (p.payload.message as string) ?? null, createdAt: ctx.now, state: 'sent' as const, callId: null as string | null };
  if (canPhone(ctx.s, contact.phone)) {
    fr.callId = startCall(ctx, 'family_request', fr.id, { to: contact.phone, adapter: 'twilio', contactId: contact.id, brief: { contactName: contact.name, recipientName: ctx.s.recipient.addressAs, message: fr.message } });
  }
  ctx.s.familyRequests.push(fr);
  ctx.s.notices.push({ id: ctx.id('ntc'), contactId: contact.id, at: ctx.now, text: `${ctx.s.recipient.addressAs} would love a call from you${fr.message ? `: “${fr.message}”` : ''}.`, caseId: null });
  ctx.ev('agent', 'engine', 'family_request_sent', 'family', fr.id, `Asked ${contact.name} to call ${ctx.s.recipient.addressAs} (sent with her approval)`);
  ctx.reply = { ok: true, status: 'sent', sayHint: `I have asked ${contact.name} to call you.` };
}

function memorySave(ctx: Ctx, text: string, consent: Confirmation) {
  if (!ctx.consent('memory_retention')) throw new EngineReject('no_consent', 'Memory retention off', 'Remembering things is turned off in your settings.');
  verifyConfirmation(ctx, consent);
  const m = { id: ctx.id('mem'), kind: 'preference' as const, text: text.slice(0, 200), sourceQuote: consent.transcript ?? '', consentedAt: ctx.now, deletedAt: null };
  ctx.s.memories.push(m);
  ctx.ev('human', 'user', 'memory_saved', 'memory', m.id, `Remembered with permission: “${m.text}”`);
  ctx.reply = { ok: true, status: 'saved', sayHint: 'I will remember that. You can see or delete it any time in “What Nami remembers”.' };
}

function memoryDelete(ctx: Ctx, id: string | null, text: string | null) {
  const m = ctx.s.memories.find((x) => x.deletedAt === null && (id ? x.id === id : text ? x.text.toLowerCase().includes(text.toLowerCase()) : false));
  if (!m) throw new EngineReject('not_found', 'Memory not found', 'I could not find that in what I remember.');
  m.deletedAt = ctx.now;
  m.text = '[deleted]';
  m.sourceQuote = '';
  ctx.ev('human', 'user', 'memory_deleted', 'memory', m.id, 'Memory deleted at the user’s request');
  ctx.reply = { ok: true, status: 'deleted', sayHint: 'Done. I have forgotten it.' };
}

// ---------------------------------------------------------------- Memory Corner (connection, not replacement)

function memoryPromptAdd(ctx: Ctx, cmd: Extract<Command, { type: 'memory.prompt.add' }>) {
  const c = ctx.contact(cmd.contactId);
  if (!c || !c.permissions.memories) throw new EngineReject('not_authorised', 'This contact cannot share memories');
  const mp = { id: ctx.id('mp'), fromContactId: c.id, photoPath: cmd.photoPath, caption: cmd.caption.slice(0, 140), createdAt: ctx.now, state: 'new' as const, storyText: null, storyQuote: null, sentAt: null };
  ctx.s.memoryPrompts.push(mp);
  ctx.ev('external', `contact:${c.id}`, 'memory_photo_shared', 'memory_prompt', mp.id, `${c.name} shared a photo for Memory Corner: “${mp.caption}”`);
  ctx.reply = { ok: true, status: 'shared', sayHint: '' };
}

function memoryStoryDraft(ctx: Ctx, cmd: Extract<Command, { type: 'memory.story.draft' }>) {
  const mp = cmd.promptId ? ctx.s.memoryPrompts.find((x) => x.id === cmd.promptId) : [...ctx.s.memoryPrompts].reverse().find((x) => x.state === 'new' || x.state === 'story_drafted');
  if (!mp) throw new EngineReject('no_photo', 'No memory photo is waiting', 'There is no photo from your family waiting right now.');
  if (mp.state === 'sent') throw new EngineReject('already_sent', 'Already sent', 'That story was already sent.');
  mp.state = 'story_drafted';
  mp.storyText = cmd.story.slice(0, 600);
  mp.storyQuote = cmd.quote.slice(0, 600);
  const c = ctx.contact(mp.fromContactId);
  const p = addPending(ctx, 'send_memory', mp.id, {}, `Shall I send this story to ${c?.name}? “${mp.storyText}”`, `क्या मैं यह कहानी ${c?.name} को भेज दूँ? “${mp.storyText}”`, 60);
  ctx.ev('agent', 'nami', 'memory_story_drafted', 'memory_prompt', mp.id, `Story drafted from ${ctx.s.recipient.addressAs}'s own words, waiting for her OK before sending`);
  ctx.reply = { ok: true, status: 'needs_confirmation', sayHint: p.readback, data: { pendingActionId: p.id } };
}

function memorySend(ctx: Ctx, p: PendingAction) {
  const mp = ctx.s.memoryPrompts.find((x) => x.id === p.relatedId);
  if (!mp || !mp.storyText) throw new EngineReject('no_story', 'Nothing to send');
  mp.state = 'sent';
  mp.sentAt = ctx.now;
  ctx.s.notices.push({ id: ctx.id('ntc'), contactId: mp.fromContactId, at: ctx.now, text: `${ctx.s.recipient.addressAs} told a story about your photo “${mp.caption}”: “${mp.storyText}”`, caseId: null });
  ctx.ev('agent', 'engine', 'memory_story_sent', 'memory_prompt', mp.id, `Story sent to ${ctx.contact(mp.fromContactId)?.name} with ${ctx.s.recipient.addressAs}'s approval`);
  ctx.reply = { ok: true, status: 'sent', sayHint: `Sent! ${ctx.contact(mp.fromContactId)?.name} will love it.` };
}

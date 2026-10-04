// Acceptance tests (docs/TRD.md §13). Pure engine — no DB, no network, virtual time.
import { describe, expect, it } from 'vitest';
import { decide, nextWakeAt, tick, type Command } from '../lib/engine/engine';
import { EngineReject, type HouseholdState } from '../lib/engine/types';
import { atLocal, MIN } from '../lib/engine/time';
import { seedHousehold, TZ } from '../lib/seed';
import { checkAffirmation } from '../lib/verify/affirmation';
import { checkDisclosure } from '../lib/verify/disclosure';

const DAY0 = '2026-10-05'; // Monday
const t = (hhmm: string, day = DAY0) => atLocal(day, hhmm, TZ);

function setup(opts: Parameters<typeof seedHousehold>[0] extends infer O ? Partial<O> : never = {}) {
  const now = t('08:55');
  let s = seedHousehold({ now, ...opts });
  const effects: ReturnType<typeof decide>['effects'] = [];
  const events: ReturnType<typeof decide>['events'] = [];
  const h = {
    get s() {
      return s;
    },
    effects,
    events,
    run(cmd: Command, at: number) {
      const r = decide(s, cmd, at);
      s = r.state;
      effects.push(...r.effects);
      events.push(...r.events);
      return r;
    },
    tick(at: number) {
      const r = tick(s, at);
      s = r.state;
      effects.push(...r.effects);
      events.push(...r.events);
      return r;
    },
    /** advance through every wake-up until `to` */
    advance(from: number, to: number) {
      let now = from;
      h.tick(now);
      for (let i = 0; i < 500; i++) {
        const w = nextWakeAt(s, now);
        if (w === null || w > to) break;
        now = w;
        h.tick(now);
      }
      h.tick(to);
    },
  };
  return h;
}

const visible = (h: ReturnType<typeof setup>, at: number) => h.run({ type: 'device.heartbeat', visibility: 'visible' }, at);

describe('reminders', () => {
  it('#1 acknowledging twice yields one outcome and a duplicate event', () => {
    const h = setup();
    visible(h, t('08:59'));
    h.tick(t('09:00'));
    const occ = h.s.occurrences.find((o) => o.scheduleId === 'sch_bp' && o.state === 'awaiting_response')!;
    expect(occ).toBeTruthy();
    h.run({ type: 'reminder.respond', occurrenceId: occ.id, response: 'taken', quote: 'haan le li', source: 'voice' }, t('09:01'));
    const r2 = h.run({ type: 'reminder.respond', occurrenceId: occ.id, response: 'not_taken', source: 'button' }, t('09:02'));
    const o = h.s.occurrences.find((x) => x.id === occ.id)!;
    expect(o.outcome).toBe('taken_reported');
    expect(r2.events.some((e) => e.action === 'duplicate_ack_ignored')).toBe(true);
  });

  it('snooze moves the notification, not the prescribed time', () => {
    const h = setup();
    h.tick(t('09:00'));
    const occ = h.s.occurrences.find((o) => o.scheduleId === 'sch_bp')!;
    h.run({ type: 'reminder.respond', occurrenceId: occ.id, response: 'snooze', snoozeMinutes: 15, source: 'button' }, t('09:01'));
    const o = h.s.occurrences.find((x) => x.id === occ.id)!;
    expect(o.dueAt).toBe(t('09:00'));
    expect(o.notifyAt).toBe(t('09:16'));
    expect(o.state).toBe('scheduled');
  });

  it('unanswered reminder on a hidden page is "delivery uncertain", never an emergency', () => {
    const h = setup();
    h.advance(t('09:00'), t('09:31'));
    const o = h.s.occurrences.find((x) => x.scheduleId === 'sch_bp')!;
    expect(o.outcome).toBe('delivery_uncertain');
    expect(h.s.cases.length).toBe(0);
  });
});

describe('check-in ladder', () => {
  it('#3 + escalation: no response → retry → deadline → primary contact, with factual evidence only', () => {
    const h = setup();
    visible(h, t('09:58'));
    h.advance(t('09:58'), t('10:31'));
    const c = h.s.cases.find((x) => x.type === 'checkin')!;
    expect(c.state).toBe('escalating');
    expect(c.pageRetriesUsed).toBe(1);
    expect(c.evidence?.pageLastSeenAt).toBe(t('09:58'));
    const att = h.s.attempts.find((a) => a.caseId === c.id && a.contactId === 'c_arjun')!;
    expect(att.state).toBe('active');
    const allText = h.events.map((e) => e.summary).join(' ').toLowerCase();
    for (const banned of [' is safe', ' is fine', 'may have fallen', 'unconscious']) expect(allText).not.toContain(banned);
  });

  it('#4 quiet hours / planned absence skip the check-in without retries', () => {
    const h = setup();
    h.s.recipient.plannedAbsenceUntil = t('18:00');
    h.advance(t('09:58'), t('10:45'));
    expect(h.s.cases.length).toBe(0);
    expect(h.events.some((e) => e.action === 'checkin_skipped')).toBe(true);
  });

  it('#5 voicemail is not acceptance → next contact', () => {
    const h = setup({ phoneCallsEnabled: true, phones: { arjun: '+919000000001', priya: '+919000000002' } });
    h.advance(t('09:58'), t('10:31'));
    const c = h.s.cases[0];
    const call = h.effects.find((e) => e.kind === 'start_call' && e.payload.purpose === 'contact_alert' && e.payload.contactId === 'c_arjun')!;
    expect(call).toBeTruthy();
    h.run({ type: 'call.result', callId: call.kind === 'start_call' ? call.payload.callId : '', status: 'completed', extracted: { voicemail: true, accepted: 'not_reached' } }, t('10:32'));
    expect(h.s.cases[0].state).toBe('escalating');
    expect(h.s.attempts.find((a) => a.caseId === c.id && a.contactId === 'c_priya' && a.state === 'active')).toBeTruthy();
    expect(h.s.attempts.find((a) => a.contactId === 'c_arjun')!.outcome).toBe('voicemail');
  });

  it('#6 backup accepts → owner shown, case awaits a human outcome', () => {
    const h = setup();
    h.advance(t('09:58'), t('10:31'));
    const c = h.s.cases[0];
    h.run({ type: 'case.contactAction', caseId: c.id, contactId: 'c_arjun', action: 'decline', source: 'link' }, t('10:33'));
    h.run({ type: 'case.contactAction', caseId: c.id, contactId: 'c_priya', action: 'accept', source: 'link' }, t('10:34'));
    expect(h.s.cases[0].state).toBe('owner_accepted');
    expect(h.s.cases[0].ownerContactId).toBe('c_priya');
    h.run({ type: 'case.contactAction', caseId: c.id, contactId: 'c_priya', action: 'spoke', note: 'Spoke to Ma, phone was on silent', source: 'link' }, t('10:40'));
    expect(h.s.cases[0].state).toBe('resolved_human_reported');
  });

  it('#7 user responds during escalation → pending calls cancelled, contact informed', () => {
    const h = setup({ phoneCallsEnabled: true, phones: { arjun: '+919000000001' } });
    h.advance(t('09:58'), t('10:31'));
    h.run({ type: 'checkin.respond', quote: 'main theek hoon', source: 'voice' }, t('10:35'));
    expect(h.s.cases[0].state).toBe('resolved_user_responded');
    expect(h.effects.some((e) => e.kind === 'cancel_call')).toBe(true);
    expect(h.s.notices.some((n) => n.contactId === 'c_arjun' && n.text.includes('responded herself'))).toBe(true);
  });

  it('#8 duplicate provider callback → one transition', () => {
    const h = setup({ phoneCallsEnabled: true, phones: { arjun: '+919000000001' } });
    h.advance(t('09:58'), t('10:31'));
    const call = h.effects.find((e) => e.kind === 'start_call' && e.payload.purpose === 'contact_alert')!;
    const callId = call.kind === 'start_call' ? call.payload.callId : '';
    const res = { type: 'call.result' as const, callId, status: 'completed' as const, extracted: { accepted: 'yes', quote: 'haan main check karta hoon' } };
    h.run(res, t('10:33'));
    const r2 = h.run(res, t('10:33'));
    expect(h.s.cases[0].state).toBe('owner_accepted');
    expect(r2.events.map((e) => e.action)).toEqual(['duplicate_callback_ignored']);
  });

  it('#13 nobody accepts → unresolved, never success; a late acceptance still works', () => {
    const h = setup();
    h.advance(t('09:58'), t('11:00'));
    expect(h.s.cases[0].state).toBe('unresolved');
    expect(h.events.some((e) => e.action === 'case_unresolved')).toBe(true);
    h.run({ type: 'case.contactAction', caseId: h.s.cases[0].id, contactId: 'c_arjun', action: 'accept', source: 'link' }, t('11:05'));
    expect(h.s.cases[0].state).toBe('owner_accepted');
  });

  it('#15 tick twice at the same now produces no new effects', () => {
    const h = setup();
    h.advance(t('09:58'), t('10:31'));
    const r1 = tick(h.s, t('10:31'));
    expect(r1.effects.length).toBe(0);
    expect(r1.events.length).toBe(0);
  });

  it('#2 restart: reloading a serialized snapshot mid-flow loses nothing and repeats nothing', () => {
    const h = setup();
    h.advance(t('09:58'), t('10:31'));
    const reloaded = JSON.parse(JSON.stringify(h.s)) as HouseholdState;
    const r = tick(reloaded, t('10:31'));
    expect(r.effects.length).toBe(0);
    expect(r.state.cases[0].state).toBe('escalating');
  });
});

describe('help', () => {
  it('Get Help escalates immediately and #14 "by mistake" cancels and informs', () => {
    const h = setup();
    const r = h.run({ type: 'help.open', kind: 'explicit_help', source: 'button' }, t('14:00'));
    expect(r.reply?.sayHint).toContain('112');
    const c = h.s.cases.find((x) => x.type === 'help')!;
    expect(c.state).toBe('escalating');
    h.run({ type: 'help.mistake', caseId: c.id, source: 'button' }, t('14:00') + 5000);
    expect(h.s.cases.find((x) => x.id === c.id)!.state).toBe('cancelled_mistake');
    expect(h.s.notices.some((n) => n.text.includes('by mistake'))).toBe(true);
  });

  it('a contact acceptance never marks the person safe — only a human report resolves', () => {
    const h = setup();
    h.run({ type: 'help.open', kind: 'explicit_help', source: 'voice', quote: 'mujhe madad chahiye' }, t('14:00'));
    const c = h.s.cases[0];
    h.run({ type: 'case.contactAction', caseId: c.id, contactId: 'c_arjun', action: 'accept', source: 'link' }, t('14:02'));
    expect(h.s.cases[0].state).toBe('owner_accepted');
    expect(h.s.cases[0].resolution).toBeNull();
  });
});

describe('appointments', () => {
  function proposeAndPermit(h: ReturnType<typeof setup>) {
    const r = h.run({ type: 'appointment.propose', clinicId: 'cl_mehta', dateFrom: '2026-10-06', dateTo: '2026-10-10', window: 'morning', reason: 'follow_up' }, t('09:10'));
    expect(r.reply?.status).toBe('needs_confirmation');
    h.run({ type: 'pending.confirm', kind: 'permit_clinic_call', confirmation: { source: 'voice', transcript: 'haan kar do' } }, t('09:11'));
    const apt = h.s.appointments[0];
    expect(apt.state).toBe('finding_availability');
    return apt;
  }
  const freeMorning = (h: ReturnType<typeof setup>) => h.s.clinics[0].simCalendar.find((s) => s.status === 'free' && s.start > t('00:00', '2026-10-06') && new Date(s.start).getUTCHours() + 5.5 < 12 && s.start < t('23:00', '2026-10-10'))!;

  it('happy path: permit → slot verified → user approves → clinic confirms → reminders created', () => {
    const h = setup();
    const apt = proposeAndPermit(h);
    const slot = freeMorning(h);
    const d = new Date(slot.start + 5.5 * 3600_000);
    const dateIso = d.toISOString().slice(0, 10);
    const time = d.toISOString().slice(11, 16);
    h.run({ type: 'call.result', callId: apt.callIds[0], status: 'completed', extracted: { outcome: 'slot_offered', slot: { date_iso: dateIso, time_24h: time, weekday_spoken: null, quote: `${dateIso} ${time} available hai` } } }, t('09:13'));
    expect(h.s.appointments[0].state).toBe('awaiting_user_approval');
    h.run({ type: 'pending.confirm', kind: 'approve_slot', confirmation: { source: 'button' } }, t('09:14'));
    expect(h.s.appointments[0].state).toBe('pending_clinic_confirmation');
    const a2 = h.s.appointments[0];
    h.run({ type: 'call.result', callId: a2.callIds[1], status: 'completed', extracted: { confirmed: true, quote: 'Haan, confirm ho gaya', slot: { date_iso: dateIso, time_24h: time, quote: 'confirm ho gaya' } } }, t('09:16'));
    expect(h.s.appointments[0].state).toBe('confirmed');
    expect(h.s.schedules.some((s) => s.kind === 'appointment')).toBe(true);
    expect(h.s.clinics[0].simCalendar.find((s) => s.id === slot.id)!.status).toBe('booked');
  });

  it('#9 clinic call fails twice → failed_needs_help, never confirmed', () => {
    const h = setup();
    const apt = proposeAndPermit(h);
    h.run({ type: 'call.result', callId: apt.callIds[0], status: 'no_answer' }, t('09:13'));
    const a = h.s.appointments[0];
    expect(a.callIds.length).toBe(2);
    h.run({ type: 'call.result', callId: a.callIds[1], status: 'busy' }, t('09:15'));
    expect(h.s.appointments[0].state).toBe('failed_needs_help');
  });

  it('#10 non-affirmative transcript cannot confirm', () => {
    const h = setup();
    h.run({ type: 'appointment.propose', clinicId: 'cl_mehta', dateFrom: '2026-10-06', dateTo: '2026-10-10', window: 'morning', reason: 'follow_up' }, t('09:10'));
    expect(() => h.run({ type: 'pending.confirm', kind: 'permit_clinic_call', confirmation: { source: 'voice', transcript: 'nahi abhi mat karo' } }, t('09:11'))).toThrow(EngineReject);
    expect(() => h.run({ type: 'pending.confirm', kind: 'permit_clinic_call', confirmation: { source: 'voice', transcript: 'hmm pata nahi' } }, t('09:11'))).toThrow(EngineReject);
    expect(h.s.appointments[0].state).toBe('draft');
  });

  it('#11 slot outside window → verifier rejects', () => {
    const h = setup();
    const apt = proposeAndPermit(h);
    h.run({ type: 'call.result', callId: apt.callIds[0], status: 'completed', extracted: { outcome: 'slot_offered', slot: { date_iso: '2026-10-08', time_24h: '18:30', weekday_spoken: 'Thursday', quote: 'Thursday shaam 6:30' } } }, t('09:13'));
    const a = h.s.appointments[0];
    expect(a.state).toBe('failed_needs_help');
    expect(a.verification.find((c) => c.check === 'in_time_window')?.pass).toBe(false);
  });

  it('weekday mismatch is caught', () => {
    const h = setup();
    const apt = proposeAndPermit(h);
    h.run({ type: 'call.result', callId: apt.callIds[0], status: 'completed', extracted: { outcome: 'slot_offered', slot: { date_iso: '2026-10-08', time_24h: '10:30', weekday_spoken: 'Friday', quote: 'Friday 10:30' } } }, t('09:13'));
    expect(h.s.appointments[0].verification.find((c) => c.check === 'weekday_consistent')?.pass).toBe(false);
  });

  it('#12 duplicate proposal returns the existing request', () => {
    const h = setup();
    h.run({ type: 'appointment.propose', clinicId: 'cl_mehta', dateFrom: '2026-10-06', dateTo: '2026-10-10', window: 'morning', reason: 'follow_up' }, t('09:10'));
    const r = h.run({ type: 'appointment.propose', clinicId: 'cl_mehta', dateFrom: '2026-10-06', dateTo: '2026-10-10', window: 'morning', reason: 'follow_up' }, t('09:11'));
    expect(h.s.appointments.length).toBe(1);
    expect(r.reply?.data?.requestId).toBe(h.s.appointments[0].id);
  });

  it('confirmation of a different slot than approved is rejected', () => {
    const h = setup();
    const apt = proposeAndPermit(h);
    const slot = freeMorning(h);
    const d = new Date(slot.start + 5.5 * 3600_000);
    const dateIso = d.toISOString().slice(0, 10);
    const time = d.toISOString().slice(11, 16);
    h.run({ type: 'call.result', callId: apt.callIds[0], status: 'completed', extracted: { outcome: 'slot_offered', slot: { date_iso: dateIso, time_24h: time, quote: 'available' } } }, t('09:13'));
    h.run({ type: 'pending.confirm', kind: 'approve_slot', confirmation: { source: 'button' } }, t('09:14'));
    h.run({ type: 'call.result', callId: h.s.appointments[0].callIds[1], status: 'completed', extracted: { confirmed: true, quote: 'confirm ho gaya', slot: { date_iso: dateIso, time_24h: '11:45', quote: 'confirm' } } }, t('09:16'));
    expect(h.s.appointments[0].state).toBe('failed_needs_help');
  });
});

describe('verifiers', () => {
  it('affirmation lexicon', () => {
    expect(checkAffirmation('haan kar do na').ok).toBe(true);
    expect(checkAffirmation('जी हाँ, कर दीजिए').ok).toBe(true);
    expect(checkAffirmation('Yes please').ok).toBe(true);
    expect(checkAffirmation('nahi').ok).toBe(false);
    expect(checkAffirmation('abhi nahi, baad mein').ok).toBe(false);
    expect(checkAffirmation('मत करो').ok).toBe(false);
    expect(checkAffirmation('what time is it').ok).toBe(false);
    expect(checkAffirmation('').ok).toBe(false);
  });
  it('disclosure checker flags phone numbers and DOB', () => {
    expect(checkDisclosure(['Her number is 98290 12345']).length).toBeGreaterThan(0);
    expect(checkDisclosure(['DOB 12/03/1954']).length).toBeGreaterThan(0);
    expect(checkDisclosure(['Namaste, main Nami hoon, Meera ji ki taraf se call kar rahi hoon.']).length).toBe(0);
  });
});

it('a 3-day simulated run with random responses never violates invariants', () => {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const h = setup();
  let now = t('08:55');
  const end = t('08:55', '2026-10-08');
  while (now < end) {
    const w = nextWakeAt(h.s, now) ?? end;
    now = Math.min(w, end);
    h.tick(now);
    if (rnd() < 0.3) visible(h, now);
    const occ = h.s.occurrences.find((o) => o.state === 'awaiting_response');
    if (occ && rnd() < 0.6) h.run({ type: 'reminder.respond', occurrenceId: occ.id, response: rnd() < 0.8 ? 'taken' : 'snooze', snoozeMinutes: 15, source: 'button' }, now + MIN);
    const c = h.s.cases.find((x) => x.state === 'escalating');
    if (c && rnd() < 0.5) h.run({ type: 'case.contactAction', caseId: c.id, contactId: c.contactOrder[Math.max(0, c.step)] ?? 'c_arjun', action: rnd() < 0.7 ? 'accept' : 'decline', source: 'link' }, now + MIN);
    now += MIN;
  }
  const open = (type: string) => h.s.cases.filter((c) => c.type === type && !['resolved_user_responded', 'resolved_human_reported', 'cancelled_mistake', 'unresolved'].includes(c.state));
  expect(open('checkin').length).toBeLessThanOrEqual(1);
  for (const c of h.s.cases) {
    const active = h.s.attempts.filter((a) => a.caseId === c.id && a.state === 'active' && a.contactId);
    expect(active.length).toBeLessThanOrEqual(1);
  }
  const occKeys = h.s.occurrences.map((o) => `${o.scheduleId}@${o.dueAt}`);
  expect(new Set(occKeys).size).toBe(occKeys.length);
});

import { crisisMatch } from '../lib/verify/crisis';
it('crisis safety net matches explicit phrases in en/hi/Hinglish only', () => {
  expect(crisisMatch('Ab jeene ka mann nahi karta')).toBeTruthy();
  expect(crisisMatch('मुझे सीने में दर्द है')).toBeTruthy();
  expect(crisisMatch('I fell down in the bathroom')).toBeTruthy();
  expect(crisisMatch('I fell asleep early')).toBeNull();
  expect(crisisMatch('dawai gir gayi')).toBeNull();
  expect(crisisMatch('aaj mausam accha hai')).toBeNull();
});

describe('memory corner', () => {
  it('story is drafted from her words and sent only after her approval; decline keeps it private', () => {
    const h = setup();
    const r = h.run({ type: 'memory.story.draft', story: 'In 1998 we rode the toy train to Shimla and Arjun would not stop waving at the tunnels.', quote: 'haan, toy train mein gaye the...' }, t('11:00'));
    expect(r.reply?.status).toBe('needs_confirmation');
    expect(h.s.notices.length).toBe(0);
    h.run({ type: 'pending.confirm', kind: 'send_memory', confirmation: { source: 'voice', transcript: 'haan bhej do' } }, t('11:01'));
    expect(h.s.memoryPrompts[0].state).toBe('sent');
    expect(h.s.notices.some((n) => n.contactId === 'c_arjun' && n.text.includes('toy train'))).toBe(true);
  });
});

describe('caregiver action guards', () => {
  it('family cannot accept before they were asked, and only the owner can report an outcome', () => {
    const h = setup();
    h.advance(t('09:58'), t('10:05'));
    const c = h.s.cases[0];
    expect(c.state).toBe('awaiting_response');
    expect(() => h.run({ type: 'case.contactAction', caseId: c.id, contactId: 'c_arjun', action: 'accept', source: 'link' }, t('10:06'))).toThrow(EngineReject);
    h.advance(t('10:06'), t('10:31'));
    h.run({ type: 'case.contactAction', caseId: c.id, contactId: 'c_arjun', action: 'accept', source: 'link' }, t('10:32'));
    expect(() => h.run({ type: 'case.contactAction', caseId: c.id, contactId: 'c_priya', action: 'spoke', source: 'link' }, t('10:33'))).toThrow(EngineReject);
    expect(h.s.cases[0].state).toBe('owner_accepted');
  });

  it('call ids carry the household id so they are globally unique', () => {
    const h = setup({ phoneCallsEnabled: true, phones: { arjun: '+919000000001' } });
    h.s.hid = 'hh_test';
    h.advance(t('09:58'), t('10:31'));
    const call = h.effects.find((e) => e.kind === 'start_call');
    expect(call && call.kind === 'start_call' && call.payload.callId.startsWith('call_hh_test_')).toBe(true);
  });
});

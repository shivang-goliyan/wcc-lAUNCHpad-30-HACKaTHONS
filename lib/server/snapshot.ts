// Shapes household state into DTOs for the UI. The caregiver view only gets authorised fields.
import { loadHousehold, recentCalls, recentEvents, virtualNow } from '../db/repo';
import { nextWakeAt } from '../engine/engine';
import { dateIso, spokenEn, spokenHi, time24 } from '../engine/time';
import type { HouseholdState } from '../engine/types';
import { contactToken } from './session';

export async function appSnapshot(hh: string, opts: { origin?: string } = {}) {
  const row = await loadHousehold(hh);
  if (!row) return null;
  const s = row.state;
  const offset = Number(row.clock_offset_ms);
  const now = virtualNow(offset);
  const tz = s.recipient.timezone;
  const [events, calls] = await Promise.all([recentEvents(hh, 80), recentCalls(hh, 6)]);
  const today = dateIso(now, tz);
  const sch = (id: string) => s.schedules.find((x) => x.id === id);
  const occurrences = s.occurrences
    .filter((o) => dateIso(o.dueAt, tz) === today || o.state === 'awaiting_response')
    .sort((a, b) => a.dueAt - b.dueAt)
    .map((o) => ({ ...o, label: sch(o.scheduleId)?.label ?? 'Reminder', labelHi: sch(o.scheduleId)?.labelHi ?? '', kind: sch(o.scheduleId)?.kind ?? 'medication', time: time24(o.dueAt, tz) }));
  const tokens: Record<string, string> = {};
  for (const c of s.contacts) tokens[c.id] = await contactToken(hh, c.id);
  return {
    householdId: hh,
    kind: row.kind,
    now,
    clock: { now, time: time24(now, tz), date: today, spokenEn: spokenEn(now, tz), spokenHi: spokenHi(now, tz), offset, nextWakeAt: nextWakeAt(s, now) },
    recipient: s.recipient,
    contacts: s.contacts.map((c) => ({ id: c.id, name: c.name, relation: c.relation, priority: c.priority, hasPhone: !!c.phone, careUrl: `${opts.origin ?? ''}/care/${tokens[c.id]}` })),
    clinics: s.clinics.map((c) => ({ id: c.id, name: c.name, nameHi: c.nameHi, doctor: c.doctor, mode: c.mode, approved: c.approved, scenario: c.simScenario })),
    occurrences,
    cases: s.cases.slice(-5).map((c) => ({ ...c, attempts: s.attempts.filter((a) => a.caseId === c.id) })),
    appointments: s.appointments.slice(-4),
    pending: s.pending.filter((p) => p.state === 'open' && p.expiresAt > now),
    memories: s.memories.filter((m) => !m.deletedAt),
    familyRequests: s.familyRequests.slice(-5),
    memoryPrompts: (s.memoryPrompts ?? []).slice(-3).map((m) => ({ ...m, fromName: s.contacts.find((c) => c.id === m.fromContactId)?.name ?? '' })),
    device: s.device,
    ui: s.ui,
    consents: s.consents,
    policy: s.policy,
    calls,
    events,
  };
}

export type AppSnapshot = NonNullable<Awaited<ReturnType<typeof appSnapshot>>>;

/** Caregiver view: only what this contact is authorised to see. No transcripts, no health score. */
export async function careSnapshot(hh: string, contactId: string) {
  const row = await loadHousehold(hh);
  if (!row) return null;
  const s: HouseholdState = row.state;
  const contact = s.contacts.find((c) => c.id === contactId);
  if (!contact) return null;
  const now = virtualNow(row.clock_offset_ms);
  const tz = s.recipient.timezone;
  const share = (p: string) => s.consents.some((c) => c.purpose === p && c.revokedAt === null);
  const cases = s.cases
    .filter((c) => c.contactOrder.includes(contactId) && (c.type === 'help' ? contact.permissions.help : contact.permissions.checkins && share('share_checkins')))
    .slice(-4)
    .map((c) => ({
      id: c.id,
      type: c.type,
      state: c.state,
      openedAt: c.openedAt,
      openedTime: time24(c.openedAt, tz),
      ownerContactId: c.ownerContactId,
      ownerName: s.contacts.find((x) => x.id === c.ownerContactId)?.name ?? null,
      isMyTurn: c.contactOrder[c.step] === contactId,
      evidence: c.evidence,
      resolution: c.resolution,
      history: s.attempts
        .filter((a) => a.caseId === c.id && a.contactId)
        .map((a) => ({ who: s.contacts.find((x) => x.id === a.contactId)?.name, outcome: a.outcome, state: a.state, at: time24(a.startedAt, tz) })),
    }));
  return {
    now,
    time: time24(now, tz),
    contact: { id: contact.id, name: contact.name, relation: contact.relation },
    recipient: { name: s.recipient.displayName, addressAs: s.recipient.addressAs, city: s.recipient.city },
    device: { lastSeen: s.device.lastSeenAt ? time24(s.device.lastSeenAt, tz) : null, lastExplicitResponse: s.device.lastExplicitResponseAt ? time24(s.device.lastExplicitResponseAt, tz) : null },
    cases,
    notices: s.notices.filter((n) => n.contactId === contactId).slice(-8).reverse().map((n) => ({ ...n, time: time24(n.at, tz) })),
    reminders: contact.permissions.reminders && share('share_reminders')
      ? s.occurrences.filter((o) => o.state === 'resolved' && dateIso(o.dueAt, tz) === dateIso(now, tz)).map((o) => ({ label: s.schedules.find((x) => x.id === o.scheduleId)?.label, outcome: o.outcome, time: time24(o.dueAt, tz) }))
      : [],
    appointments: contact.permissions.appointments && share('share_appointments')
      ? s.appointments.slice(-3).map((a) => ({ id: a.id, state: a.state, clinic: s.clinics.find((c) => c.id === a.clinicId)?.name, when: a.offeredSlot ? spokenEn(a.offeredSlot.startAt, tz) : null, failureReason: a.failureReason }))
      : [],
    familyRequests: s.familyRequests.filter((f) => f.contactId === contactId).slice(-3),
    canShareMemories: contact.permissions.memories,
    memoryPrompts: (s.memoryPrompts ?? []).filter((m) => m.fromContactId === contactId).slice(-3).map((m) => ({ id: m.id, caption: m.caption, photoPath: m.photoPath, state: m.state, story: m.state === 'sent' ? m.storyText : null, sentAt: m.sentAt ? time24(m.sentAt, tz) : null })),
  };
}

export type CareSnapshot = NonNullable<Awaited<ReturnType<typeof careSnapshot>>>;

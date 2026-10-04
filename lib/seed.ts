// Seed data for a demo household (Meera Sharma, Jaipur). All names are fictional.
import type { ClinicScenario, HouseholdState, SimSlot } from './engine/types';
import { addDaysIso, atLocal, dateIso, weekdayOfIso } from './engine/time';

export const TZ = 'Asia/Kolkata';

/** Deterministic clinic calendar for the next 21 days (Mon–Sat, 09:00–19:30, 30-min slots). */
export function buildSimCalendar(fromMs: number, scenario: ClinicScenario): SimSlot[] {
  const slots: SimSlot[] = [];
  const start = dateIso(fromMs, TZ);
  for (let d = 0; d <= 21; d++) {
    const day = addDaysIso(start, d);
    if (weekdayOfIso(day) === 0) continue; // closed Sunday
    for (let m = 9 * 60; m <= 19 * 60 + 30; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const isMorning = m < 12 * 60;
      const idx = d * 31 + m / 30;
      let free = idx % 4 === 1; // ~25% free
      if (scenario === 'evening_only') free = !isMorning && m >= 17 * 60 && idx % 3 === 0;
      if (scenario === 'no_slots') free = false;
      slots.push({ id: `slot_${day.replace(/-/g, '')}_${hh}${mm}`, start: atLocal(day, `${hh}:${mm}`, TZ), durationMin: 30, status: free ? 'free' : 'booked' });
    }
  }
  return slots;
}

export type SeedOptions = { now: number; scenario?: ClinicScenario; phoneCallsEnabled?: boolean; phones?: { recipient?: string | null; arjun?: string | null; priya?: string | null; clinic?: string | null } };

export function seedHousehold(opts: SeedOptions): HouseholdState {
  const { now } = opts;
  const scenario = opts.scenario ?? 'cooperative';
  const grant = (purpose: HouseholdState['consents'][number]['purpose']) => ({ purpose, grantedAt: now, revokedAt: null });
  const all = { checkins: true, help: true, appointments: true, reminders: true, memories: true };
  return {
    schemaVersion: 1,
    seq: 0,
    createdAt: now,
    phoneCallsEnabled: !!opts.phoneCallsEnabled,
    recipient: {
      displayName: 'Meera Sharma',
      firstName: 'Meera',
      lastName: 'Sharma',
      addressAs: 'Meera ji',
      city: 'Jaipur',
      language: 'auto',
      timezone: TZ,
      quietStart: '21:30',
      quietEnd: '07:00',
      plannedAbsenceUntil: null,
      phone: opts.phones?.recipient ?? null,
      prefs: { textScale: 1, reducedMotion: false, captions: true },
    },
    contacts: [
      { id: 'c_arjun', name: 'Arjun', relation: 'son · Bengaluru', priority: 1, phone: opts.phones?.arjun ?? null, email: null, permissions: { ...all }, participationConfirmed: true },
      { id: 'c_priya', name: 'Priya', relation: 'daughter · Pune', priority: 2, phone: opts.phones?.priya ?? null, email: null, permissions: { ...all, memories: false }, participationConfirmed: true },
    ],
    consents: [
      grant('automated_contact_calls'),
      grant('clinic_calls'),
      grant('appointment_booking'),
      grant('share_reminders'),
      grant('share_appointments'),
      grant('share_checkins'),
      grant('memory_retention'),
    ],
    clinics: [
      {
        id: 'cl_mehta',
        name: 'Dr. Mehta Clinic',
        nameHi: 'डॉ. मेहता क्लिनिक',
        doctor: 'Dr. Anil Mehta',
        phone: opts.phones?.clinic ?? null,
        mode: opts.phones?.clinic ? 'phone' : 'sim',
        approved: true,
        permittedDisclosure: ['first_name', 'last_initial', 'reason'],
        simCalendar: buildSimCalendar(now, scenario),
        simScenario: scenario,
      },
    ],
    schedules: [
      { id: 'sch_bp', kind: 'medication', label: 'BP tablet (Amlodipine 5 mg) after breakfast', labelHi: 'BP की गोली (Amlodipine 5 mg) नाश्ते के बाद', instructions: 'As prescribed by Dr. Mehta — checked by Arjun', times: ['09:00'], onceAt: [], active: true, appointmentId: null },
      { id: 'sch_walk', kind: 'walk', label: 'Evening walk in the colony park', labelHi: 'कॉलोनी पार्क में शाम की सैर', instructions: '', times: ['17:30'], onceAt: [], active: true, appointmentId: null },
      { id: 'sch_water', kind: 'water', label: 'A glass of water', labelHi: 'एक गिलास पानी', instructions: '', times: ['11:30', '15:30'], onceAt: [], active: true, appointmentId: null },
    ],
    occurrences: [],
    policy: { times: ['10:00'], responseWindowMin: 15, pageRetries: 1, retryWindowMin: 5, phoneFallback: true, deadlineMin: 30, contactAckTimeoutMin: 10, reminderWindowMin: 30 },
    checkinsCreated: [],
    cases: [],
    attempts: [],
    appointments: [],
    pending: [],
    memories: [{ id: 'mem_garden', kind: 'preference', text: 'Loves gardening — her tulsi and money plant on the balcony', sourceQuote: 'haan, yaad rakhna', consentedAt: now, deletedAt: null }],
    familyRequests: [],
    memoryPrompts: [{ id: 'mp_shimla', fromContactId: 'c_arjun', photoPath: '/memory/shimla-1998.svg', caption: 'Ma, remember our Shimla trip in 1998? Tell Nami the story!', createdAt: now, state: 'new', storyText: null, storyQuote: null, sentAt: null }],
    notices: [],
    device: { lastSeenAt: null, visibility: null, lastExplicitResponseAt: null },
    ui: { quietUntil: null },
    handledCallResults: [],
  };
}

/** Virtual-clock offset so the demo starts at `hhmm` today (IST). */
export function demoOffsetFor(realNow: number, hhmm = '08:55') {
  const target = atLocal(dateIso(realNow, TZ), hhmm, TZ);
  return target - realNow;
}

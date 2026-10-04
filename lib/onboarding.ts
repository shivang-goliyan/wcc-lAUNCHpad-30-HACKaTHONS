// Onboarding (docs/DECISIONS.md D22): what the family tells Nami at /start, validated, and
// applied on top of a freshly seeded household. Pure: no clock, no I/O.
import { z } from 'zod';
import type { HouseholdState, ReminderSchedule } from './engine/types';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time as HH:MM');
const name = z.string().trim().min(1).max(40);
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{7,16}$/, 'phone number')
  .optional()
  .or(z.literal(''));

export const OnboardProfile = z.object({
  setupBy: z.enum(['child', 'self', 'together']),
  parent: z.object({
    firstName: name,
    lastName: z.string().trim().max(40).optional().or(z.literal('')),
    addressAs: z.string().trim().min(1).max(30),
    city: z.string().trim().min(1).max(40),
    language: z.enum(['hi', 'en', 'auto']),
  }),
  checkinTime: hhmm,
  medicines: z.array(z.object({ label: z.string().trim().min(1).max(60), time: hhmm })).max(5),
  water: z.boolean(),
  walk: z.boolean(),
  contacts: z.array(z.object({ name, relation: z.string().trim().min(1).max(40), phone })).min(1).max(2),
  clinic: z.object({ name: z.string().trim().min(1).max(60), doctor: z.string().trim().max(60).optional().or(z.literal('')) }),
  // the parent's own yes, given on the last step; spoken answers are checked by the affirmation verifier
  consent: z.object({ source: z.enum(['button', 'voice']), quote: z.string().max(300).optional() }),
});
export type OnboardProfile = z.infer<typeof OnboardProfile>;

/** The household as the family described it. Contacts' phones are kept but never dialled in sandboxes. */
export function applyProfile(state: HouseholdState, p: OnboardProfile): HouseholdState {
  const first = p.parent.firstName;
  const last = p.parent.lastName ?? '';
  const schedules: ReminderSchedule[] = p.medicines.map((m, i) => ({
    id: `sch_med_${i + 1}`,
    kind: 'medication',
    label: m.label,
    labelHi: m.label,
    instructions: 'As prescribed, entered by the family',
    times: [m.time],
    onceAt: [],
    active: true,
    appointmentId: null,
  }));
  if (p.water)
    schedules.push({ id: 'sch_water', kind: 'water', label: 'A glass of water', labelHi: 'एक गिलास पानी', instructions: '', times: ['11:30', '15:30'], onceAt: [], active: true, appointmentId: null });
  if (p.walk)
    schedules.push({ id: 'sch_walk', kind: 'walk', label: 'An evening walk', labelHi: 'शाम की सैर', instructions: '', times: ['17:30'], onceAt: [], active: true, appointmentId: null });

  const base = state.contacts[0];
  const contacts = p.contacts.map((c, i) => ({
    ...base,
    id: `c_${i + 1}`,
    name: c.name,
    relation: c.relation,
    priority: i + 1,
    phone: null, // sandboxes never dial; a real phone is only used once it's allow-listed
    participationConfirmed: true,
  }));

  return {
    ...state,
    recipient: {
      ...state.recipient,
      firstName: first,
      lastName: last,
      displayName: last ? `${first} ${last}` : first,
      addressAs: p.parent.addressAs,
      city: p.parent.city,
      language: p.parent.language,
    },
    contacts,
    clinics: state.clinics.map((c, i) => (i === 0 ? { ...c, name: p.clinic.name, nameHi: p.clinic.name, doctor: p.clinic.doctor || p.clinic.name } : c)),
    schedules,
    policy: { ...state.policy, times: [p.checkinTime] },
    // nothing of the demo family carries over
    memories: [],
    memoryPrompts: [],
  };
}

// Deterministic verification of a clinic slot extracted from a call transcript.
import type { Clinic, SlotOffer, TimeWindow, VerificationCheck } from '../engine/types';
import { atLocal, weekdayOfIso, WEEKDAYS_EN, WINDOWS } from '../engine/time';

const WEEKDAY_ALIASES: Record<number, string[]> = {
  0: ['sunday', 'sun', 'ravivar', 'itvaar', 'itwar', 'रविवार', 'इतवार'],
  1: ['monday', 'mon', 'somvar', 'somwar', 'सोमवार'],
  2: ['tuesday', 'tue', 'mangalvar', 'mangalwar', 'मंगलवार'],
  3: ['wednesday', 'wed', 'budhvar', 'budhwar', 'बुधवार'],
  4: ['thursday', 'thu', 'guruvar', 'guruwar', 'brihaspativar', 'veervar', 'गुरुवार', 'बृहस्पतिवार', 'वीरवार'],
  5: ['friday', 'fri', 'shukravar', 'shukrawar', 'शुक्रवार'],
  6: ['saturday', 'sat', 'shanivar', 'shaniwar', 'शनिवार'],
};

export function weekdayFromWord(word: string | null | undefined): number | null {
  if (!word) return null;
  const w = word.toLowerCase().trim();
  for (const [d, names] of Object.entries(WEEKDAY_ALIASES)) if (names.some((n) => w.includes(n))) return +d;
  return null;
}

export type SlotVerifyInput = {
  slot: { dateIso: string; time24h: string; weekdaySpoken: string | null; quote: string; slotId?: string } | null;
  constraints: { dateFrom: string; dateTo: string; window: TimeWindow };
  clinic: Clinic;
  now: number;
  tz: string;
  purpose: 'availability' | 'confirmation';
  approvedSlot?: SlotOffer | null;
};

export type SlotVerifyResult = { pass: boolean; checks: VerificationCheck[]; offer: SlotOffer | null };

export function verifySlot(input: SlotVerifyInput): SlotVerifyResult {
  const { slot, constraints, clinic, now, tz } = input;
  const checks: VerificationCheck[] = [];
  const add = (check: string, pass: boolean, detail: string) => checks.push({ check, pass, detail });

  add('clinic_approved', clinic.approved, clinic.approved ? `${clinic.name} is on the approved list` : `${clinic.name} is not approved`);
  if (!slot) {
    add('slot_present', false, 'No concrete slot was extracted from the call');
    return { pass: false, checks, offer: null };
  }
  add('quote_present', !!slot.quote && slot.quote.trim().length >= 4, slot.quote ? `“${slot.quote}”` : 'No supporting quote from the transcript');

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(slot.dateIso);
  const timeOk = /^\d{2}:\d{2}$/.test(slot.time24h);
  add('parses', dateOk && timeOk, dateOk && timeOk ? `${slot.dateIso} ${slot.time24h}` : `Unparseable date/time: ${slot.dateIso} ${slot.time24h}`);
  if (!dateOk || !timeOk) return { pass: false, checks, offer: null };

  const startAt = atLocal(slot.dateIso, slot.time24h, tz);
  add('not_in_past', startAt > now, startAt > now ? 'Slot is in the future' : 'Slot is in the past');

  const inRange = slot.dateIso >= constraints.dateFrom && slot.dateIso <= constraints.dateTo;
  add('in_date_range', inRange, `${slot.dateIso} ${inRange ? 'is within' : 'is outside'} ${constraints.dateFrom} → ${constraints.dateTo}`);

  if (constraints.window !== 'any') {
    const [h, m] = slot.time24h.split(':').map(Number);
    const mins = h * 60 + m;
    const [s, e] = WINDOWS[constraints.window];
    const ok = mins >= s && mins < e;
    add('in_time_window', ok, `${slot.time24h} ${ok ? 'is in' : 'is not in'} the ${constraints.window} window`);
  }

  const actualWd = weekdayOfIso(slot.dateIso);
  const spokenWd = weekdayFromWord(slot.weekdaySpoken);
  if (spokenWd === null) {
    add('weekday_consistent', true, `${WEEKDAYS_EN[actualWd]} (no weekday stated on the call)`);
  } else {
    const ok = spokenWd === actualWd;
    add('weekday_consistent', ok, ok ? `Stated ${WEEKDAYS_EN[spokenWd]} matches ${slot.dateIso}` : `Stated ${WEEKDAYS_EN[spokenWd]} but ${slot.dateIso} is a ${WEEKDAYS_EN[actualWd]}`);
  }

  let slotId: string | undefined;
  if (clinic.mode === 'sim') {
    const found = clinic.simCalendar.find((s) => s.start === startAt);
    slotId = found?.id;
    const ok =
      !!found &&
      found.status !== 'booked';
    add('exists_in_clinic_calendar', ok, found ? `Calendar slot ${found.id} is ${found.status}` : 'No such slot in the clinic calendar');
  }

  if (input.purpose === 'confirmation' && input.approvedSlot) {
    const ok = input.approvedSlot.startAt === startAt;
    add('matches_approved_slot', ok, ok ? 'Same slot the user approved' : 'Clinic confirmed a different slot than the one approved');
  }

  const pass = checks.every((c) => c.pass);
  return {
    pass,
    checks,
    offer: { startAt, dateIso: slot.dateIso, time24h: slot.time24h, weekdaySpoken: slot.weekdaySpoken, quote: slot.quote, slotId },
  };
}

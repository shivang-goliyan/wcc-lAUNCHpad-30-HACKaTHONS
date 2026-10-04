// Timezone-aware helpers that never read the wall clock (pure: callers pass `now`).

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zoned(ms: number, tz: string): ZonedParts & { second: number } {
  const parts = Object.fromEntries(fmt(tz).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour,
    minute: +parts.minute,
    second: +parts.second,
    weekday: WD[parts.weekday as string],
  };
}

/** Offset (ms) of tz from UTC at instant ms. */
function offsetAt(ms: number, tz: string) {
  const p = zoned(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Convert a wall-clock time in tz to epoch ms. */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = offsetAt(guess, tz);
  const t1 = guess - off1;
  const off2 = offsetAt(t1, tz);
  return off1 === off2 ? t1 : guess - off2;
}

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function dateIso(ms: number, tz: string) {
  const p = zoned(ms, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function time24(ms: number, tz: string) {
  const p = zoned(ms, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function parseHHMM(s: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`bad time ${s}`);
  return [+m[1], +m[2]];
}

/** Epoch ms for a "YYYY-MM-DD" + "HH:MM" in tz. */
export function atLocal(dateIsoStr: string, hhmm: string, tz: string) {
  const [y, mo, d] = dateIsoStr.split('-').map(Number);
  const [h, mi] = parseHHMM(hhmm);
  return zonedToUtc(y, mo, d, h, mi, tz);
}

export function addDaysIso(dateIsoStr: string, days: number) {
  const [y, m, d] = dateIsoStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekdayOfIso(dateIsoStr: string) {
  const [y, m, d] = dateIsoStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_HI = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];

/** "Thursday, 8 October, 10:30 AM" */
export function spokenEn(ms: number, tz: string) {
  const p = zoned(ms, tz);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const ampm = p.hour < 12 ? 'AM' : 'PM';
  return `${WEEKDAYS_EN[p.weekday]}, ${p.day} ${MONTHS_EN[p.month - 1]}, ${h12}:${pad(p.minute)} ${ampm}`;
}

/** "गुरुवार, 8 अक्टूबर, सुबह 10:30" */
export function spokenHi(ms: number, tz: string) {
  const p = zoned(ms, tz);
  const part = p.hour < 12 ? 'सुबह' : p.hour < 16 ? 'दोपहर' : p.hour < 20 ? 'शाम' : 'रात';
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${WEEKDAYS_HI[p.weekday]}, ${p.day} ${MONTHS_HI[p.month - 1]}, ${part} ${h12}:${pad(p.minute)}`;
}

export function spokenDateEn(dateIsoStr: string) {
  const [, m, d] = dateIsoStr.split('-').map(Number);
  return `${WEEKDAYS_EN[weekdayOfIso(dateIsoStr)]} ${d} ${MONTHS_EN[m - 1]}`;
}

export function spokenDateHi(dateIsoStr: string) {
  const [, m, d] = dateIsoStr.split('-').map(Number);
  return `${WEEKDAYS_HI[weekdayOfIso(dateIsoStr)]} ${d} ${MONTHS_HI[m - 1]}`;
}

export function inQuietHours(ms: number, tz: string, start: string, end: string) {
  const p = zoned(ms, tz);
  const cur = p.hour * 60 + p.minute;
  const [sh, sm] = parseHHMM(start);
  const [eh, em] = parseHHMM(end);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
}

export const WINDOWS: Record<'morning' | 'afternoon' | 'evening', [number, number]> = {
  morning: [8 * 60, 12 * 60],
  afternoon: [12 * 60, 16 * 60],
  evening: [16 * 60, 20 * 60],
};

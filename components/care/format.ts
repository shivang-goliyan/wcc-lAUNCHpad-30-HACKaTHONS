// Display helpers for the caregiver page. Times are virtual (demo) epoch ms rendered in the recipient's zone.
// The care snapshot does not carry the recipient's timezone yet, so this uses the seeded household's zone.
const RECIPIENT_TZ = 'Asia/Kolkata';

const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: RECIPIENT_TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: RECIPIENT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export function time24(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return hhmm.format(new Date(ms));
}

export function sameDay(a: number, b: number) {
  return dayFmt.format(new Date(a)) === dayFmt.format(new Date(b));
}

export const OPEN_CASE_STATES = ['awaiting_response', 'retrying_page', 'phone_fallback', 'escalating', 'owner_accepted', 'unresolved'] as const;

export function isOpenCase(state: string) {
  return (OPEN_CASE_STATES as readonly string[]).includes(state);
}

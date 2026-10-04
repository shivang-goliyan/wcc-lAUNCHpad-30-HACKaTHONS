import { createHousehold } from '@/lib/db/repo';
import { OnboardProfile } from '@/lib/onboarding';
import { handleError, json } from '@/lib/server/http';
import { ipHash } from '@/lib/server/limits';
import { setHouseholdCookie } from '@/lib/server/session';

// generous on purpose: judges on one venue wifi share an IP. This only stops a script.
const recent = new Map<string, number[]>();
const PER_HOUR = 30;

function allowed(ip: string) {
  const cut = Date.now() - 3600_000;
  const hits = (recent.get(ip) ?? []).filter((t) => t > cut);
  if (hits.length >= PER_HOUR) return false;
  hits.push(Date.now());
  recent.set(ip, hits);
  return true;
}

// the demo clock follows real IST time, except at night when Nami would just be quiet
function startAt() {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number);
  const mins = h * 60 + m;
  if (mins < 7 * 60 + 30 || mins > 20 * 60 + 30) return '08:55';
  return `${String(h).padStart(2, '0')}:${String(m - (m % 5)).padStart(2, '0')}`;
}

export async function POST(req: Request) {
  try {
    if (!allowed(ipHash(req))) return json({ ok: false, error: 'rate_limited', message: 'Too many setups from here in the last hour. Try again a bit later.' }, 429);
    const body = await req.json().catch(() => null);
    const parsed = OnboardProfile.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return json({ ok: false, error: 'invalid_input', message: `Something in the form isn't right (${issue?.path.join('.') || 'body'}: ${issue?.message ?? 'invalid'}).` }, 400);
    }
    const id = await createHousehold({ profile: parsed.data, startAt: startAt() });
    await setHouseholdCookie(id);
    return json({ ok: true, next: '/app' });
  } catch (e) {
    return handleError(e);
  }
}

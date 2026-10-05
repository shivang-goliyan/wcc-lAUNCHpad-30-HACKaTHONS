// "Talk to Nami on your phone": a judge plays the elder, and Nami calls their own phone.
// Every guard on spending lives in realCallGate (lib/calls/runtime.ts); this adds a
// per-IP limit and makes sure the visitor said the phone is theirs.
import { z } from 'zod';
import { startCompanionCall } from '@/lib/calls/runtime';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const Body = z.object({ to: z.string().min(8).max(20), lang: z.enum(['en', 'hi']), mine: z.literal(true) });

const byIp = new Map<string, number[]>();

function normalise(raw: string) {
  const d = raw.replace(/[^\d+]/g, '');
  if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (/^0[6-9]\d{9}$/.test(d)) return `+91${d.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(d)) return `+${d}`;
  return d.startsWith('+') ? d : `+${d}`;
}

export async function POST(req: Request) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ ok: false, error: 'Please enter your number and tick the box to say it is your phone.' }, 400);
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
    const now = Date.now();
    const recent = (byIp.get(ip) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= 4) return json({ ok: false, error: 'Too many calls from here this hour. Please try again later.' }, 429);
    const to = normalise(parsed.data.to);
    const r = await startCompanionCall(hh, to, parsed.data.lang);
    if (!r.ok) return json({ ok: false, error: `Nami can’t call right now: ${r.reason}.` }, 409);
    byIp.set(ip, [...recent, now]);
    return json({ ok: true, callId: r.callId });
  } catch (e) {
    return handleError(e);
  }
}

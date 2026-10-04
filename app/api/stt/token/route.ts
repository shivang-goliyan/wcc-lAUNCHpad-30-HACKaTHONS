// A short-lived Deepgram token for one listening turn. The API key never leaves the server.
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const PER_HOUR = Number(process.env.STT_TOKENS_PER_HOUSEHOLD_PER_HOUR || 120);
const used = new Map<string, { hour: number; n: number }>();

export async function POST() {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key || process.env.KILL_SWITCH_STT === 'true') return json({ ok: false, error: 'stt_not_configured' }, 503);

    const hour = Math.floor(Date.now() / 3_600_000);
    const u = used.get(hh);
    const n = u && u.hour === hour ? u.n : 0;
    if (n >= PER_HOUR) return json({ ok: false, error: 'stt_rate_limited' }, 429);
    used.set(hh, { hour, n: n + 1 });

    // one retry: Deepgram's grant endpoint occasionally stalls for a few seconds
    let r: Response | null = null;
    for (let attempt = 0; attempt < 2 && !r?.ok; attempt++) {
      r = await fetch('https://api.deepgram.com/v1/auth/grant', {
        method: 'POST',
        headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl_seconds: 60 }),
        signal: AbortSignal.timeout(6000),
      }).catch(() => null);
    }
    if (!r?.ok) return json({ ok: false, error: `stt_${r?.status ?? 'timeout'}` }, 502);
    const j = (await r.json()) as { access_token: string; expires_in: number };
    return json({ ok: true, token: j.access_token, expiresIn: j.expires_in });
  } catch (e) {
    return handleError(e);
  }
}

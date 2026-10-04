// Nami's spoken voice (Fish Audio). The key stays here; the browser only gets audio.
// Cached on disk by text, so repeated lines (reminders, greetings) cost nothing.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const Body = z.object({ text: z.string().min(1).max(400) });

const VOICE = process.env.NAMI_VOICE_ID || '4d7609058bd34213b1378b29efbde1f1';
const MODEL = process.env.FISH_MODEL || 's2.1-pro-free';
const CACHE = path.join(process.env.TTS_CACHE_DIR || tmpdir(), 'nami-tts');
const PER_HOUR = Number(process.env.TTS_PER_HOUSEHOLD_PER_HOUR || 120);

const used = new Map<string, { hour: number; n: number }>();

export async function POST(req: Request) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    if (!process.env.FISH_API_KEY || process.env.KILL_SWITCH_TTS === 'true') return json({ ok: false, error: 'tts_not_configured' }, 503);
    const { text } = Body.parse(await req.json());

    const key = createHash('sha256').update(`${MODEL}|${VOICE}|${text}`).digest('hex');
    const file = path.join(CACHE, `${key}.mp3`);
    const hit = await readFile(file).catch(() => null);
    if (hit) return audio(hit);

    const hour = Math.floor(Date.now() / 3_600_000);
    const u = used.get(hh);
    const n = u && u.hour === hour ? u.n : 0;
    if (n >= PER_HOUR) return json({ ok: false, error: 'tts_rate_limited' }, 429);
    used.set(hh, { hour, n: n + 1 });

    const r = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.FISH_API_KEY}`, 'Content-Type': 'application/json', model: MODEL },
      body: JSON.stringify({ text, reference_id: VOICE, format: 'mp3', latency: 'balanced' }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) return json({ ok: false, error: `tts_${r.status}` }, 502);
    const buf = Buffer.from(await r.arrayBuffer());
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, buf).catch(() => {});
    return audio(buf);
  } catch (e) {
    return handleError(e);
  }
}

const audio = (buf: Buffer) =>
  new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400' } });

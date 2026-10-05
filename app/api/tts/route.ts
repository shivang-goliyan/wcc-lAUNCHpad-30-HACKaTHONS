// Nami's spoken voice. Gemini TTS first (most natural in Hindi, D24), the Fish voice as the
// backup when Gemini is slow or out of quota. Keys stay here; the browser only gets audio.
// Cached on disk by provider+voice+text, so repeated lines (reminders, greetings) cost nothing.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after } from 'next/server';
import { z } from 'zod';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';
import { detectLang, fishTts, geminiReady, geminiTts, type Clip } from '@/lib/server/tts';

const Body = z.object({ text: z.string().min(1).max(400) });

const VOICE = process.env.NAMI_VOICE_ID || '4d7609058bd34213b1378b29efbde1f1';
const MODEL = process.env.FISH_MODEL || 's2.1-pro-free';
const GEM_MODELS = (process.env.GEMINI_TTS_MODELS || 'gemini-3.8-flash-tts,gemini-3.1-flash-tts-preview,gemini-3.8-flash-lite-tts').split(',').map((s) => s.trim());
const GEM_VOICE = process.env.GEMINI_TTS_VOICE || 'Vindemiatrix';
// which languages go to Gemini (hi = Devanagari, hing = Roman Hindi, en); "" puts everything on Fish.
// English stays on Fish by default to save the small free Gemini quota for Hindi.
const GEM_LANGS = (process.env.TTS_GEMINI_LANGS ?? '').split(',').map((s) => s.trim());
// the client gives up on a sentence after 4.5 s, so Fish has to be ready before that
const GEM_WAIT = Number(process.env.TTS_GEMINI_WAIT_MS || 3800);
const FISH_DELAY = 800;
const CACHE = path.join(process.env.TTS_CACHE_DIR || tmpdir(), 'nami-tts');
const PER_HOUR = Number(process.env.TTS_PER_HOUSEHOLD_PER_HOUR || 120);

const used = new Map<string, { hour: number; n: number }>();

const wait = (ms: number) => new Promise<null>((r) => setTimeout(() => r(null), ms));

const cacheFile = (provider: string, model: string, voice: string, text: string, ext: string) =>
  path.join(CACHE, `${createHash('sha256').update(`${provider}|${model}|${voice}|${text}`).digest('hex')}.${ext}`);

async function save(file: string, clip: Clip) {
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, clip.buf).catch(() => {});
  return clip;
}

export async function POST(req: Request) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    if (process.env.KILL_SWITCH_TTS === 'true') return json({ ok: false, error: 'tts_not_configured' }, 503);
    const { text } = Body.parse(await req.json());

    const fishOn = !!process.env.FISH_API_KEY;
    const gemOn = GEM_LANGS.includes(detectLang(text)) && geminiReady(GEM_MODELS);
    if (!fishOn && !gemOn) return json({ ok: false, error: 'tts_not_configured' }, 503);

    const gemFile = cacheFile('gemini', 'tts', GEM_VOICE, text, 'wav');
    const fishFile = cacheFile('fish', MODEL, VOICE, text, 'mp3');
    if (gemOn) {
      const hit = await readFile(gemFile).catch(() => null);
      if (hit) return audio({ buf: hit, type: 'audio/wav' }, 'gemini');
    }
    const fishHit = fishOn ? await readFile(fishFile).catch(() => null) : null;
    if (fishHit && !gemOn) return audio({ buf: fishHit, type: 'audio/mpeg' }, 'fish');

    const hour = Math.floor(Date.now() / 3_600_000);
    const u = used.get(hh);
    const n = u && u.hour === hour ? u.n : 0;
    if (n >= PER_HOUR) return json({ ok: false, error: 'tts_rate_limited' }, 429);
    used.set(hh, { hour, n: n + 1 });

    const fish = () =>
      fishHit ? Promise.resolve<Clip>({ buf: fishHit, type: 'audio/mpeg' }) : fishTts(text, VOICE, MODEL, AbortSignal.timeout(25_000)).then((c) => save(fishFile, c));

    if (!gemOn) return audio(await fish(), 'fish');

    const gem = geminiTts(text, GEM_MODELS, GEM_VOICE, AbortSignal.timeout(20_000)).then((c) => save(gemFile, c));
    const gemOrNull = gem.catch((e) => {
      console.warn('[tts] gemini failed, using fish:', String(e?.message ?? e));
      return null;
    });
    // if Gemini loses the race it still finishes and lands in the cache for next time
    after(() => gemOrNull);

    // start the backup a little late, or straight away if Gemini already failed
    const backup = fishOn ? Promise.race([gemOrNull, wait(FISH_DELAY)]).then((g) => (g ? null : fish().catch(() => null))) : Promise.resolve(null);

    const first = await Promise.race([gemOrNull, wait(GEM_WAIT)]);
    if (first) return audio(first, 'gemini');
    const fallback = await backup;
    if (fallback) return audio(fallback, 'fish');
    const late = await gemOrNull;
    if (late) return audio(late, 'gemini');
    return json({ ok: false, error: 'tts_failed' }, 502);
  } catch (e) {
    return handleError(e);
  }
}

const audio = (clip: Clip, voice: string) =>
  new Response(new Uint8Array(clip.buf), { headers: { 'Content-Type': clip.type, 'Cache-Control': 'private, max-age=86400', 'X-Nami-Voice': voice } });

/**
 * GET /api/tts?t=… streams the Fish voice straight through as it is generated, so the
 * browser starts playing after ~0.6 s instead of waiting for the whole sentence. The
 * stream is copied into the same disk cache on the way past.
 */
export async function GET(req: Request) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    if (process.env.KILL_SWITCH_TTS === 'true') return json({ ok: false, error: 'tts_not_configured' }, 503);
    const { text } = Body.parse({ text: new URL(req.url).searchParams.get('t') ?? '' });
    if (!process.env.FISH_API_KEY) return json({ ok: false, error: 'tts_not_configured' }, 503);
    // a Gemini-voiced language goes through the non-streaming path
    if (GEM_LANGS.includes(detectLang(text)) && geminiReady(GEM_MODELS))
      return POST(new Request(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify({ text }) }));

    const fishFile = cacheFile('fish', MODEL, VOICE, text, 'mp3');
    const hit = await readFile(fishFile).catch(() => null);
    if (hit) return audio({ buf: hit, type: 'audio/mpeg' }, 'fish');

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
    if (!r.ok || !r.body) return json({ ok: false, error: 'tts_failed' }, 502);
    const [toClient, toCache] = r.body.tee();
    after(async () => {
      const buf = Buffer.from(await new Response(toCache).arrayBuffer());
      if (buf.length > 1000) await save(fishFile, { buf, type: 'audio/mpeg' });
    });
    return new Response(toClient, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Nami-Voice': 'fish-stream' } });
  } catch (e) {
    return handleError(e);
  }
}

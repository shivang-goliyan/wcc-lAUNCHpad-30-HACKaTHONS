// Mints a short-lived realtime credential. Provider keys never reach the browser.
import { randomBytes } from 'node:crypto';
import { sql } from '@/lib/db/client';
import { ensureSchema } from '@/lib/db/client';
import { namiInstructions } from '@/lib/agents/namiPrompt';
import { toolJsonSchemas } from '@/lib/agents/tools';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';
import { ipHash, LIMITS, voiceAllowed } from '@/lib/server/limits';

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const key = process.env.OPENAI_API_KEY;
    if (!key) return json({ ok: false, error: 'voice_not_configured' }, 503);
    const ip = ipHash(req);
    const blocked = await voiceAllowed(ip);
    if (blocked) return json({ ok: false, error: blocked }, 429);
    const model = process.env.VOICE_MODEL || 'gpt-realtime-2.1';
    const instructions = await namiInstructions(hh, 'voice');
    const tools = toolJsonSchemas().map((t) => ({ type: 'function', ...t }));
    const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: 120 },
        session: {
          type: 'realtime',
          model,
          instructions,
          output_modalities: ['audio'],
          tools,
          tool_choice: 'auto',
          audio: {
            input: { transcription: { model: process.env.VOICE_TRANSCRIBE_MODEL || 'gpt-4o-transcribe' }, turn_detection: { type: 'semantic_vad' } },
            output: { voice: process.env.VOICE_NAME || 'marin', speed: 0.95 },
          },
        },
      }),
    });
    if (!r.ok) {
      console.error('client_secrets failed', r.status, await r.text());
      return json({ ok: false, error: 'voice_provider_error' }, 502);
    }
    const data = (await r.json()) as { value: string; expires_at: number };
    const id = `vs_${randomBytes(8).toString('hex')}`;
    await sql()`INSERT INTO voice_sessions (id, household_id, ip_hash, provider) VALUES (${id}, ${hh}, ${ip}, 'openai')`;
    return json({ ok: true, provider: 'openai', model, clientSecret: data.value, sessionId: id, maxSeconds: LIMITS.maxSessionSec });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  // end of session: record seconds used (for the daily cap)
  try {
    const hh = await currentHousehold();
    const { sessionId, seconds } = (await req.json()) as { sessionId: string; seconds: number };
    await sql()`UPDATE voice_sessions SET ended_at = now(), seconds = ${Math.max(0, Math.min(3600, Math.round(seconds)))} WHERE id = ${sessionId} AND household_id = ${hh}`;
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

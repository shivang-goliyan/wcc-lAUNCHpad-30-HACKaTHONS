// Voice providers for /api/tts. Gemini TTS sounds the most like a native Hindi speaker (D24),
// Fish is quicker and stays as the backup voice.

export type Lang = 'hi' | 'hing' | 'en';

const HINGLISH = new Set(
  'aap aapka aapki aapke aapko hai hain kya nahi nahin haan kaise kaisi theek thik ho gaya gayi gayin kar karo kariye kijiye dijiye bataiye batayiye bata accha acha achha chaliye bahut abhi aaj kal subah shaam raat dawai dawa goli khana beta beti namaste shukriya dhanyavaad toh lekin aur wala wali mujhe mera meri hum humko apna apni yaad samay ji'.split(
    ' ',
  ),
);

export function detectLang(text: string): Lang {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  // "ji" alone shows up in English replies too ("Good morning Meera ji"), so ask for two hits
  const hits = new Set(words.filter((w) => HINGLISH.has(w)));
  return hits.size >= 2 ? 'hing' : 'en';
}

export type Clip = { buf: Buffer; type: 'audio/mpeg' | 'audio/wav' };

export async function fishTts(text: string, voice: string, model: string, signal: AbortSignal): Promise<Clip> {
  const r = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.FISH_API_KEY}`, 'Content-Type': 'application/json', model },
    body: JSON.stringify({ text, reference_id: voice, format: 'mp3', latency: 'balanced' }),
    signal,
  });
  if (!r.ok) throw new Error(`fish ${r.status}`);
  return { buf: Buffer.from(await r.arrayBuffer()), type: 'audio/mpeg' };
}

// Only real Gemini keys; LLM_API_KEYS may point at another provider one day.
export const geminiKeys = () =>
  (process.env.GEMINI_TTS_KEYS || process.env.LLM_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.startsWith('AIza'));

// The free tier allows ~20 requests a day per key per model, so we walk a ladder of models
// and park any key+model that says it's out of quota until Google says it's back.
const parked = new Map<string, number>();
const free = (model: string, key: string) => (parked.get(`${model}|${key}`) ?? 0) <= Date.now();
let turn = Math.floor(Math.random() * 100);

export const geminiReady = (models: string[]) => geminiKeys().some((k) => models.some((m) => free(m, k)));

type GemReply = {
  candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
  error?: { details?: { retryDelay?: string }[] };
};

export async function geminiTts(text: string, models: string[], voice: string, signal: AbortSignal): Promise<Clip> {
  const keys = geminiKeys();
  let tries = 0;
  let last = 'gemini has no free key';
  for (const model of models) {
    for (let i = 0; i < keys.length && tries < 4; i++) {
      const key = keys[(turn + i) % keys.length];
      if (!free(model, key)) continue;
      tries++;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
        }),
        signal,
      });
      const j = (await r.json().catch(() => ({}))) as GemReply;
      last = `gemini ${model} ${r.status}`;
      if (r.status === 429) {
        const secs = parseFloat(j.error?.details?.find((d) => d.retryDelay)?.retryDelay ?? '') || 60;
        parked.set(`${model}|${key}`, Date.now() + Math.min(Math.max(secs, 20), 86_400) * 1000);
        continue;
      }
      if (r.status === 403 || r.status === 404) {
        parked.set(`${model}|${key}`, Date.now() + 3_600_000);
        continue;
      }
      if (r.status >= 500) continue;
      // a 400 is about the text (e.g. the model answered instead of reading), so try the next model
      if (!r.ok) break;
      const data = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!data) break;
      turn = (turn + i + 1) % keys.length;
      const raw = Buffer.from(data.data, 'base64');
      // newer models send a WAV already; older ones send bare 16-bit PCM
      if (/wav/i.test(data.mimeType)) return { buf: raw, type: 'audio/wav' };
      const rate = Number(/rate=(\d+)/i.exec(data.mimeType)?.[1] || 24000);
      return { buf: wav(quieter(raw), rate), type: 'audio/wav' };
    }
  }
  throw new Error(last);
}

// Gemini comes out ~9 dB hotter than the Fish voice; match them so a reply that mixes the two doesn't jump
const GAIN = 0.3;
function quieter(pcm: Buffer) {
  const out = Buffer.alloc(pcm.length - (pcm.length % 2));
  for (let i = 0; i < out.length; i += 2) out.writeInt16LE(Math.round(pcm.readInt16LE(i) * GAIN), i);
  return out;
}

function wav(pcm: Buffer, rate: number) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

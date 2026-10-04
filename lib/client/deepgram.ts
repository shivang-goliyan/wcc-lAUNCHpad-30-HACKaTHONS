'use client';
// One listening turn through Deepgram Nova-3 (Hindi and English mixed): the mic is
// captured as 16 kHz PCM, streamed over a WebSocket opened with a 60 s token from
// /api/stt/token, and the turn ends when Deepgram says the speaker has finished.

export type Listen = {
  /** resolves with the full utterance ('' if she said nothing before the timeout) */
  done: Promise<string>;
  abort: () => void;
};

const RATE = 16000;

export async function deepgramListen(onInterim: (text: string) => void, maxMs = 20_000): Promise<Listen | null> {
  const t = await fetch('/api/stt/token', { method: 'POST' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!t?.token) return null;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  // ScriptProcessor is old but runs everywhere (Safari included) with no worklet file
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const params = new URLSearchParams({
    model: 'nova-3',
    language: 'multi',
    encoding: 'linear16',
    sample_rate: String(RATE),
    interim_results: 'true',
    smart_format: 'true',
    endpointing: '600',
    utterance_end_ms: '1200',
  });
  const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['bearer', t.token]);

  let finals = '';
  let ended = false;
  let resolve!: (s: string) => void;
  const done = new Promise<string>((r) => (resolve = r));

  const finish = () => {
    if (ended) return;
    ended = true;
    proc.disconnect();
    src.disconnect();
    stream.getTracks().forEach((tr) => tr.stop());
    void ctx.close().catch(() => {});
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'CloseStream' }));
      ws.close();
    }
    resolve(finals.trim());
  };

  ws.onmessage = (m) => {
    const d = JSON.parse(m.data as string);
    if (d.type === 'UtteranceEnd' && finals.trim()) return finish();
    if (d.type !== 'Results') return;
    const text: string = d.channel?.alternatives?.[0]?.transcript ?? '';
    if (d.is_final && text) finals += ' ' + text;
    onInterim((finals + ' ' + (d.is_final ? '' : text)).trim());
    if (d.speech_final && finals.trim()) finish();
  };
  ws.onerror = () => finish();
  ws.onclose = () => finish();

  proc.onaudioprocess = (e) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(downsample(e.inputBuffer.getChannelData(0), ctx.sampleRate));
  };
  src.connect(proc);
  proc.connect(ctx.destination);

  setTimeout(finish, maxMs);
  return { done, abort: finish };
}

/** float32 at the device rate -> 16-bit PCM at 16 kHz */
function downsample(input: Float32Array, from: number): ArrayBuffer {
  const ratio = from / RATE;
  const n = Math.floor(input.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

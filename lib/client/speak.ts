'use client';
// Text-mode fallback voice using the browser's speechSynthesis (hi-IN / en-IN where available).

export function hasDevanagari(s: string) {
  return /[ऀ-ॿ]/.test(s);
}

let voices: SpeechSynthesisVoice[] = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const load = () => (voices = window.speechSynthesis.getVoices());
  load();
  window.speechSynthesis.onvoiceschanged = load;
}

export function speak(text: string, opts: { lang?: 'hi' | 'en'; rate?: number; onStart?: () => void; onEnd?: () => void; onBoundary?: () => void } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
    opts.onEnd?.();
    return null;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const lang = opts.lang ?? (hasDevanagari(text) ? 'hi' : 'en');
  const want = lang === 'hi' ? ['hi-IN', 'hi'] : ['en-IN', 'en-GB', 'en-US', 'en'];
  u.voice = want.map((l) => voices.find((v) => v.lang.toLowerCase().startsWith(l.toLowerCase()))).find(Boolean) ?? null;
  u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  u.rate = opts.rate ?? 0.92;
  u.onstart = () => opts.onStart?.();
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  u.onboundary = () => opts.onBoundary?.();
  window.speechSynthesis.speak(u);
  return u;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

let ctx: AudioContext | null = null;
/** Soft two-note chime for reminders (no alarms). */
export function chime() {
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    [659.25, 880].forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, now + i * 0.18);
      g.gain.linearRampToValueAtTime(0.08, now + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.6);
      o.connect(g).connect(ctx!.destination);
      o.start(now + i * 0.18);
      o.stop(now + i * 0.18 + 0.7);
    });
  } catch {
    /* audio blocked until user gesture */
  }
}

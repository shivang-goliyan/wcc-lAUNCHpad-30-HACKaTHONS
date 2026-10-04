/**
 * Speech-reactive mouth movement for Nami (docs/DESIGN.md §7).
 *
 * This is honest "speech-reactive movement", not phoneme-accurate lip-sync:
 * we follow the loudness envelope of Nami's OUTPUT audio (never the user's
 * microphone) and map it to a 0..1 `mouthOpen` value.
 *
 *   const stop = createLipSync(remoteAudioEl, (v) => mouth.set(v));
 *   …
 *   stop(); // on interrupt/turn change: mouth closes immediately
 */

export type MouthCallback = (mouthOpen: number) => void;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** DESIGN.md §7 step 4. */
export function rmsToMouth(rms: number): number {
  return clamp01((rms - 0.02) / 0.18);
}

type Ctor = typeof AudioContext;
let sharedCtx: AudioContext | null = null;
function getContext(): AudioContext {
  if (sharedCtx && sharedCtx.state !== "closed") return sharedCtx;
  const W = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  const AC = W.AudioContext ?? W.webkitAudioContext;
  if (!AC) throw new Error("Web Audio is not available");
  sharedCtx = new AC();
  return sharedCtx;
}

// A media element can only be wrapped by ONE MediaElementSourceNode per context, ever.
const elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

export type LipSyncOptions = {
  /** Reuse an existing AudioContext (e.g. the one playing the audio). */
  audioContext?: AudioContext;
  /** Envelope attack/release in ms (defaults 30 / 90). */
  attackMs?: number;
  releaseMs?: number;
};

/**
 * Follow the loudness of `source` and report `mouthOpen` (0..1) every frame.
 *
 * - `HTMLMediaElement`: routed through the analyser AND on to the speakers,
 *   so playback stays audible. Pause/ended/emptied/error close the mouth at once.
 * - `MediaStream` (e.g. a WebRTC remote track): analysed only. Play it through
 *   an <audio> element as usual (Chrome needs that for remote WebRTC audio).
 *
 * Returns `stop()`, which disconnects, cancels the frame loop and sends 0.
 */
export function createLipSync(
  source: MediaStream | HTMLMediaElement,
  onValue: MouthCallback,
  options: LipSyncOptions = {},
): () => void {
  if (typeof window === "undefined") return () => {};
  const ctx = options.audioContext ?? getContext();
  const attack = (options.attackMs ?? 30) / 1000;
  const release = (options.releaseMs ?? 90) / 1000;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0; // we shape the envelope ourselves
  const buf = new Float32Array(analyser.fftSize);

  let node: AudioNode;
  let isElement = false;
  if (source instanceof HTMLMediaElement) {
    isElement = true;
    let src = elementSources.get(source);
    if (!src || src.context !== ctx) {
      src = ctx.createMediaElementSource(source);
      elementSources.set(source, src);
    }
    node = src;
    // Keep the element audible: source → destination, plus a tap to the analyser.
    try {
      src.connect(ctx.destination);
    } catch {
      /* already connected */
    }
    src.connect(analyser);
  } else {
    node = ctx.createMediaStreamSource(source);
    node.connect(analyser);
  }

  if (ctx.state === "suspended") void ctx.resume().catch(() => {});

  let env = 0;
  let last = performance.now();
  let raf = 0;
  let stopped = false;
  let lastSent = -1;

  const send = (v: number) => {
    // Avoid flooding React/motion with identical values.
    if (Math.abs(v - lastSent) < 0.005 && !(v === 0 && lastSent !== 0)) return;
    lastSent = v;
    onValue(v);
  };

  const closeNow = () => {
    env = 0;
    send(0);
  };

  const tick = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
    last = now;
    const paused = isElement && (source as HTMLMediaElement).paused;
    if (paused) {
      if (env !== 0) closeNow();
    } else {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const tau = rms > env ? attack : release;
      env += (rms - env) * (1 - Math.exp(-dt / tau));
      send(rmsToMouth(env));
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const events = ["pause", "ended", "emptied", "error", "abort", "stalled"] as const;
  if (isElement) {
    for (const e of events) (source as HTMLMediaElement).addEventListener(e, closeNow);
  }

  return function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    if (isElement) {
      for (const e of events) (source as HTMLMediaElement).removeEventListener(e, closeNow);
      // Leave source → destination connected so the element keeps playing; drop our tap.
      try {
        node.disconnect(analyser);
      } catch {}
    } else {
      try {
        node.disconnect();
      } catch {}
    }
    try {
      analyser.disconnect();
    } catch {}
    onValue(0);
  };
}

/**
 * Text-mode fallback (DESIGN.md §7 step 7): a plausible synthetic envelope
 * while `window.speechSynthesis` speaks `utterance`.
 *
 * Browsers don't expose TTS audio, so we fake syllable-like pulses (~5–6 per
 * second, jittered), re-sync to `boundary` events at each word (a fresh, strong
 * pulse; a short dip between words; longer pauses at punctuation), and close
 * the mouth on end/error/pause/cancel. Voices that never fire boundary events
 * still get the free-running pulses.
 *
 * Attach BEFORE calling `speechSynthesis.speak(utterance)`. Returns `stop()`.
 */
export function speechSynthesisEnvelope(
  utterance: SpeechSynthesisUtterance,
  onValue: MouthCallback,
): () => void {
  if (typeof window === "undefined") return () => {};
  const synth = window.speechSynthesis;
  const text = utterance.text ?? "";
  let speaking = false;
  let paused = false;
  let stopped = false;
  let raf = 0;
  let last = 0;
  let env = 0;

  // Current syllable pulse.
  let pulseStart = 0;
  let pulseLen = 0.17;
  let pulsePeak = 0.7;
  let gapUntil = 0; // inter-word / punctuation silence (seconds, performance clock)

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const newPulse = (t: number, strong = false) => {
    pulseStart = t;
    pulseLen = rand(0.12, 0.22);
    pulsePeak = strong ? rand(0.65, 1) : rand(0.3, 0.85);
  };

  const tick = (now: number) => {
    if (stopped) return;
    const t = now / 1000;
    const dt = last ? Math.min(0.1, t - last) : 0.016;
    last = t;
    let target = 0;
    if (speaking && !paused && (synth.speaking || synth.pending)) {
      if (t < gapUntil) {
        target = 0;
      } else {
        const p = (t - pulseStart) / pulseLen;
        if (p >= 1) newPulse(t);
        const q = Math.min(1, Math.max(0, (t - pulseStart) / pulseLen));
        // Fast open, slower close: sin^0.7 shape plus a little shimmer.
        target = pulsePeak * Math.pow(Math.sin(Math.PI * q), 0.7) + rand(-0.04, 0.04);
      }
    } else if (speaking && !synth.speaking && !synth.pending) {
      // Missed `end` event (some engines): close up.
      speaking = false;
    }
    const tau = target > env ? 0.03 : 0.09;
    env += (target - env) * (1 - Math.exp(-dt / tau));
    if (target === 0 && env < 0.01) env = 0;
    onValue(clamp01(env));
    raf = requestAnimationFrame(tick);
  };

  const onStart = () => {
    speaking = true;
    paused = false;
    newPulse(performance.now() / 1000, true);
  };
  const onBoundary = (e: SpeechSynthesisEvent) => {
    const t = performance.now() / 1000;
    if (e.name && e.name !== "word") {
      // sentence boundary
      gapUntil = t + 0.12;
      return;
    }
    // Look back at the character before this word: punctuation means a pause.
    const prev = text.slice(Math.max(0, e.charIndex - 2), e.charIndex);
    const pause = /[,;:]/.test(prev) ? 0.16 : /[.!?।]/.test(prev) ? 0.28 : 0.045;
    gapUntil = t + pause;
    newPulse(gapUntil, true);
  };
  const close = () => {
    speaking = false;
    env = 0;
    onValue(0);
  };
  const onPause = () => {
    paused = true;
    env = 0;
    onValue(0);
  };
  const onResume = () => {
    paused = false;
  };

  utterance.addEventListener("start", onStart);
  utterance.addEventListener("boundary", onBoundary);
  utterance.addEventListener("end", close);
  utterance.addEventListener("error", close);
  utterance.addEventListener("pause", onPause);
  utterance.addEventListener("resume", onResume);
  raf = requestAnimationFrame(tick);

  return function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    utterance.removeEventListener("start", onStart);
    utterance.removeEventListener("boundary", onBoundary);
    utterance.removeEventListener("end", close);
    utterance.removeEventListener("error", close);
    utterance.removeEventListener("pause", onPause);
    utterance.removeEventListener("resume", onResume);
    onValue(0);
  };
}

/** Pick the best available voice for a BCP-47 list, e.g. ["hi-IN", "en-IN"]. */
export function pickVoice(langs: string[]): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const norm = (l: string) => l.toLowerCase().replace("_", "-");
  for (const lang of langs) {
    const exact = voices.find((v) => norm(v.lang) === lang.toLowerCase());
    if (exact) return exact;
  }
  for (const lang of langs) {
    const base = lang.toLowerCase().split("-")[0];
    const near = voices.find((v) => norm(v.lang).split("-")[0] === base);
    if (near) return near;
  }
  return null;
}

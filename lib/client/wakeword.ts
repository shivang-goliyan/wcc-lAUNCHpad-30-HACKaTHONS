// "Hey Nami", heard on the device. openWakeWord's three small ONNX models run in the browser:
// 16 kHz audio → mel spectrogram → speech embeddings → our hey_nami classifier.
// No audio leaves the page; only a detection starts the normal voice loop.
import type * as Ort from 'onnxruntime-web';

const ORT_VERSION = '1.30.0';
const BASE = '/wakeword';
const CHUNK = 1280; // 80 ms at 16 kHz
const MEL_WINDOW = 76; // mel frames per embedding
const EMB_WINDOW = 16; // embeddings per prediction

export type WakeOptions = {
  onWake: (score: number) => void;
  onLevel?: (score: number) => void;
  threshold?: number;
};

type Models = { ort: typeof Ort; mel: Ort.InferenceSession; emb: Ort.InferenceSession; ww: Ort.InferenceSession };
let loading: Promise<Models> | null = null;

function loadModels(): Promise<Models> {
  loading ??= (async () => {
    const ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
    ort.env.wasm.numThreads = 1;
    const opt: Ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'] };
    const [mel, emb, ww] = await Promise.all([
      ort.InferenceSession.create(`${BASE}/melspectrogram.onnx`, opt),
      ort.InferenceSession.create(`${BASE}/embedding_model.onnx`, opt),
      ort.InferenceSession.create(`${BASE}/hey_nami.onnx`, opt),
    ]);
    return { ort, mel, emb, ww };
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

export const wakeWordSupported = () =>
  typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof WebAssembly !== 'undefined';

export class WakeWord {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private pending: number[] = [];
  private raw: Float32Array = new Float32Array(0); // last few chunks, for mel context
  private mel: Float32Array[] = [];
  private emb: Float32Array[] = [];
  private busy = false;
  private hot = 0;
  private coolUntil = 0;
  private stopped = false;

  constructor(private opts: WakeOptions) {}

  async start() {
    const m = await loadModels();
    if (this.stopped) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    if (this.stopped) return this.release();
    const ctx = new AudioContext({ sampleRate: 16000 });
    this.ctx = ctx;
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(this.stream);
    const node = ctx.createScriptProcessor(2048, 1, 1);
    this.node = node;
    // the models start from a neutral history, as in openWakeWord
    this.mel = Array.from({ length: MEL_WINDOW }, () => new Float32Array(32).fill(1));
    this.emb = [];
    node.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) this.pending.push(Math.max(-32768, Math.min(32767, d[i] * 32767)));
      if (!this.busy && this.pending.length >= CHUNK) void this.step(m);
    };
    src.connect(node);
    // ScriptProcessor only runs when connected; a muted gain keeps it silent
    const mute = ctx.createGain();
    mute.gain.value = 0;
    node.connect(mute);
    mute.connect(ctx.destination);
  }

  /** resume after a page gesture if the browser started the audio suspended */
  resume() {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  private async step(m: Models) {
    this.busy = true;
    try {
      while (this.pending.length >= CHUNK && !this.stopped) {
        const chunk = Float32Array.from(this.pending.splice(0, CHUNK));
        // mel needs 3 hops (480 samples) of left context
        const ctxLen = Math.min(this.raw.length, 480);
        const input = new Float32Array(ctxLen + CHUNK);
        input.set(this.raw.subarray(this.raw.length - ctxLen));
        input.set(chunk, ctxLen);
        this.raw = input.slice(-CHUNK * 2);

        const melOut = await m.mel.run({ [m.mel.inputNames[0]]: new m.ort.Tensor('float32', input, [1, input.length]) });
        const spec = melOut[m.mel.outputNames[0]].data as Float32Array;
        const frames = spec.length / 32;
        for (let f = 0; f < frames; f++) {
          const row = new Float32Array(32);
          for (let k = 0; k < 32; k++) row[k] = spec[f * 32 + k] / 10 + 2;
          this.mel.push(row);
        }
        if (this.mel.length > MEL_WINDOW + 20) this.mel.splice(0, this.mel.length - (MEL_WINDOW + 20));

        // one embedding per 80 ms, from the last 76 mel frames
        const win = new Float32Array(MEL_WINDOW * 32);
        const tail = this.mel.slice(-MEL_WINDOW);
        tail.forEach((r, i) => win.set(r, i * 32));
        const embOut = await m.emb.run({ [m.emb.inputNames[0]]: new m.ort.Tensor('float32', win, [1, MEL_WINDOW, 32, 1]) });
        this.emb.push(Float32Array.from(embOut[m.emb.outputNames[0]].data as Float32Array));
        if (this.emb.length > EMB_WINDOW) this.emb.shift();
        if (this.emb.length < EMB_WINDOW) continue;

        const feats = new Float32Array(EMB_WINDOW * 96);
        this.emb.forEach((e, i) => feats.set(e, i * 96));
        const out = await m.ww.run({ [m.ww.inputNames[0]]: new m.ort.Tensor('float32', feats, [1, EMB_WINDOW, 96]) });
        const score = (out[m.ww.outputNames[0]].data as Float32Array)[0];
        this.opts.onLevel?.(score);
        const now = performance.now();
        // two frames in a row over the line, then a short cool-down so one phrase fires once
        this.hot = score >= (this.opts.threshold ?? 0.5) ? this.hot + 1 : 0;
        if (this.hot >= 2 && now > this.coolUntil) {
          this.hot = 0;
          this.coolUntil = now + 2500;
          this.opts.onWake(score);
        }
      }
    } catch (e) {
      console.warn('wake word step failed', e);
    } finally {
      this.busy = false;
    }
  }

  private release() {
    this.node?.disconnect();
    this.node = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  stop() {
    this.stopped = true;
    this.pending = [];
    this.release();
  }
}

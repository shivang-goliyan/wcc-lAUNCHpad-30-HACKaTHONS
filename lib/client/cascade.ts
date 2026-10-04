'use client';
// Voice without a speech-to-speech model: Deepgram Nova-3 listens (Hindi and
// English mixed; the browser's own recognition if Deepgram is unavailable), the text agent answers through /api/chat, and Nami speaks the
// reply sentence by sentence through /api/tts (Fish Audio), prefetching the next
// sentence while one plays. If the server voice is slow or missing, the browser's
// own voice takes over, so she is never silent. She never listens while she
// speaks (no echo); pressing Talk again interrupts her.

import { createLipSync } from '@/components/nami/lipsync';
import { speak, stopSpeaking } from './speak';
import { deepgramListen, type Listen } from './deepgram';
import type { VoiceState } from './realtime';

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

type W = Window & { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };

const browserSR = () => typeof window !== 'undefined' && !!((window as W).SpeechRecognition || (window as W).webkitSpeechRecognition);
export const cascadeSupported = () => browserSR() || (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);

export type CascadeHandlers = {
  onState: (st: VoiceState, detail?: string) => void;
  onUserText: (text: string, final: boolean) => void;
  onNamiText: (text: string) => void;
  onMouth: (v: number) => void;
  /** send what Meera said to the agent; resolves to Nami's reply (null on failure) */
  ask: (text: string) => Promise<string | null>;
  lang: () => 'en' | 'hi';
};

/** split a reply into speakable sentences (English and Hindi punctuation) */
export function sentences(text: string) {
  return text
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export class CascadeVoice {
  connected = false;
  private rec: Rec | null = null;
  private dg: Listen | null = null;
  private useDeepgram = true;
  private dgFailures = 0;
  private audio: HTMLAudioElement | null = null;
  private stopLip: (() => void) | null = null;
  private turn = 0;
  private muted = false;

  constructor(private h: CascadeHandlers) {}

  async connect() {
    if (!cascadeSupported()) throw new Error('voice_unsupported_browser');
    this.connected = true;
    this.listen();
  }

  disconnect() {
    this.connected = false;
    this.turn++;
    this.rec?.abort();
    this.rec = null;
    this.dg?.abort();
    this.dg = null;
    this.hush();
    this.h.onState('off');
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m) this.hush();
  }

  /** stop talking now (barge-in) and listen again */
  interrupt() {
    this.turn++;
    this.dg?.abort();
    this.dg = null;
    this.hush();
    if (this.connected) this.listen();
  }

  private hush() {
    this.audio?.pause();
    this.audio = null;
    this.stopLip?.();
    this.stopLip = null;
    stopSpeaking();
    this.h.onMouth(0);
  }

  private listen() {
    if (!this.connected) return;
    if (this.useDeepgram) return void this.listenDeepgram();
    this.listenBrowser();
  }

  private async listenDeepgram() {
    const turn = this.turn;
    this.h.onState('listening');
    let l: Listen | null = null;
    try {
      l = await deepgramListen((text) => this.h.onUserText(text, false));
    } catch {
      // mic refused or Deepgram unreachable
      l = null;
    }
    if (!l) {
      // a blip uses the browser for this turn only; two in a row and we stop trying Deepgram
      if (++this.dgFailures >= 2) this.useDeepgram = false;
      if (browserSR()) return this.listenBrowser();
      if (this.useDeepgram) return void setTimeout(() => this.connected && this.listen(), 800);
      return this.h.onState('error', 'mic_unavailable');
    }
    this.dgFailures = 0;
    if (!this.connected || turn !== this.turn) return l.abort();
    this.dg = l;
    const text = await l.done;
    if (this.dg !== l || !this.connected || turn !== this.turn) return;
    this.dg = null;
    if (text) void this.respond(text);
    else this.listen();
  }

  private listenBrowser() {
    if (!this.connected) return;
    const Ctor = (window as W).SpeechRecognition || (window as W).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = this.h.lang() === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    let final = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      this.h.onUserText((final + interim).trim(), false);
    };
    rec.onerror = (e) => {
      // "no-speech" and "aborted" are normal; anything else is worth telling her about
      if (e.error !== 'no-speech' && e.error !== 'aborted') this.h.onState('error', e.error === 'not-allowed' ? 'mic_blocked' : e.error);
    };
    rec.onend = () => {
      if (this.rec !== rec || !this.connected) return;
      const text = final.trim();
      if (text) void this.respond(text);
      else setTimeout(() => this.connected && this.rec === rec && this.listenBrowser(), 250);
    };
    this.rec = rec;
    this.h.onState('listening');
    try {
      rec.start();
    } catch {
      this.h.onState('error', 'mic_unavailable');
    }
  }

  private async respond(text: string) {
    const turn = ++this.turn;
    this.h.onUserText(text, true);
    this.h.onState('thinking');
    const reply = await this.h.ask(text);
    if (turn !== this.turn || !this.connected) return; // interrupted meanwhile
    if (reply) {
      this.h.onNamiText(reply);
      await this.say(reply, turn);
    }
    if (turn === this.turn && this.connected) this.listen();
  }

  /** speak with the server voice, sentence by sentence; falls back to the browser voice */
  async say(text: string, turn = ++this.turn) {
    if (this.muted) return;
    const parts = sentences(text);
    this.h.onState('speaking');
    let next = parts.length ? fetchTts(parts[0]) : null;
    for (let i = 0; i < parts.length; i++) {
      if (turn !== this.turn) return;
      const blob = await Promise.race([next, wait(4500).then(() => null)]);
      next = i + 1 < parts.length ? fetchTts(parts[i + 1]) : null;
      if (turn !== this.turn) return;
      if (blob) await this.play(blob);
      else {
        // server voice unavailable: say the rest with the browser voice
        await browserSay(parts.slice(i).join(' '), this.h.onMouth);
        break;
      }
    }
    this.h.onMouth(0);
  }

  private play(blob: Blob) {
    return new Promise<void>((resolve) => {
      const a = new Audio(URL.createObjectURL(blob));
      this.audio = a;
      try {
        this.stopLip = createLipSync(a, this.h.onMouth);
      } catch {
        this.stopLip = null;
      }
      const done = () => {
        this.stopLip?.();
        this.stopLip = null;
        URL.revokeObjectURL(a.src);
        resolve();
      };
      a.onended = done;
      a.onerror = done;
      a.onpause = done;
      a.play().catch(done);
    });
  }
}

async function fetchTts(text: string): Promise<Blob | null> {
  try {
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!r.ok || !r.headers.get('content-type')?.includes('audio')) return null;
    return await r.blob();
  } catch {
    return null;
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function browserSay(text: string, onMouth: (v: number) => void) {
  return new Promise<void>((resolve) => {
    const u = speak(text, {
      onEnd: () => {
        onMouth(0);
        resolve();
      },
      onBoundary: () => {
        onMouth(0.4 + Math.random() * 0.5);
        setTimeout(() => onMouth(0.1), 120);
      },
    });
    if (!u) resolve();
  });
}

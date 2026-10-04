'use client';
// Browser side of the realtime voice agent (OpenAI Realtime over WebRTC).
// The browser talks to the provider directly with a short-lived key minted by /api/voice/session.
// Tool calls are bridged to /api/tools/:name — the server validates and runs the engine.

export type VoiceState = 'off' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export type VoiceCallbacks = {
  onState: (s: VoiceState, detail?: string) => void;
  onUserText: (text: string, final: boolean) => void;
  onNamiText: (text: string, final: boolean) => void;
  onToolResult: (name: string, ok: boolean, status: string) => void;
  onRemoteStream: (stream: MediaStream, el: HTMLAudioElement) => void;
  onEnded: (reason: string) => void;
};

type FnCall = { type: 'function_call'; name: string; arguments: string; call_id: string };

export class RealtimeVoice {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private sessionId: string | null = null;
  private startedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private namiBuf = '';
  private lastUser = '';
  private muted = false;
  state: VoiceState = 'off';

  constructor(private cb: VoiceCallbacks) {}

  private set(s: VoiceState, detail?: string) {
    this.state = s;
    this.cb.onState(s, detail);
  }

  get connected() {
    return this.dc?.readyState === 'open';
  }

  async connect(greet = true) {
    this.set('connecting');
    const r = await fetch('/api/voice/session', { method: 'POST' });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      this.set('error', data.error ?? 'voice_unavailable');
      throw new Error(data.error ?? 'voice_unavailable');
    }
    this.sessionId = data.sessionId;
    const pc = new RTCPeerConnection();
    this.pc = pc;
    const audio = document.createElement('audio');
    audio.autoplay = true;
    this.audio = audio;
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0];
      this.cb.onRemoteStream(e.streams[0], audio);
    };
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    for (const t of this.mic.getTracks()) pc.addTrack(t, this.mic);
    const dc = pc.createDataChannel('oai-events');
    this.dc = dc;
    dc.onmessage = (m) => this.onEvent(JSON.parse(m.data));
    dc.onopen = () => {
      this.set('listening');
      if (greet) this.sendResponse("Greet them warmly by the name in your instructions, in one short sentence in their language, say you are Nami, an AI companion, and ask whether they would like to hear today's plan.");
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') this.disconnect('connection_lost');
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const sdp = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      body: offer.sdp,
      headers: { Authorization: `Bearer ${data.clientSecret}`, 'Content-Type': 'application/sdp' },
    });
    if (!sdp.ok) {
      this.disconnect('provider_error');
      throw new Error('provider_error');
    }
    await pc.setRemoteDescription({ type: 'answer', sdp: await sdp.text() });
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.disconnect('time_limit'), (data.maxSeconds ?? 300) * 1000);
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.mic?.getTracks().forEach((t) => (t.enabled = !m));
  }

  /** Ask Nami to say something now (e.g. a reminder or a clinic result arrived). */
  sendResponse(instructions?: string) {
    this.send({ type: 'response.create', ...(instructions ? { response: { instructions } } : {}) });
  }

  /** Inject an app update as a system message, then let Nami speak about it. */
  notify(text: string, speak = true) {
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text }] } });
    if (speak) this.sendResponse();
  }

  private send(ev: unknown) {
    if (this.dc?.readyState === 'open') this.dc.send(JSON.stringify(ev));
  }

  private async onEvent(ev: Record<string, unknown> & { type: string }) {
    switch (ev.type) {
      case 'input_audio_buffer.speech_started':
        this.set('listening');
        break;
      case 'conversation.item.input_audio_transcription.delta':
        this.cb.onUserText(String(ev.delta ?? ''), false);
        break;
      case 'conversation.item.input_audio_transcription.completed':
        this.lastUser = String(ev.transcript ?? '').trim();
        this.cb.onUserText(this.lastUser, true);
        break;
      case 'response.created':
        this.namiBuf = '';
        this.set('thinking');
        break;
      case 'output_audio_buffer.started':
        this.set('speaking');
        break;
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        this.set('listening');
        break;
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        this.namiBuf += String(ev.delta ?? '');
        this.cb.onNamiText(this.namiBuf, false);
        break;
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        this.cb.onNamiText(String(ev.transcript ?? this.namiBuf), true);
        break;
      case 'response.done': {
        const resp = ev.response as { status?: string; output?: Array<FnCall | { type: string }> } | undefined;
        // Tool calls from a cancelled (interrupted) response are never executed.
        if (resp?.status !== 'completed') break;
        const calls = (resp.output ?? []).filter((o): o is FnCall => o.type === 'function_call');
        if (!calls.length) break;
        for (const c of calls) {
          let reply: { ok: boolean; status: string } & Record<string, unknown>;
          try {
            const r = await fetch(`/api/tools/${c.name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ args: c.arguments, lastUserTranscript: this.lastUser || null }),
            });
            reply = await r.json();
          } catch {
            reply = { ok: false, status: 'network_error', sayHint: 'Sorry, I could not reach the server.' };
          }
          this.cb.onToolResult(c.name, !!reply.ok, String(reply.status));
          this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: c.call_id, output: JSON.stringify(reply) } });
        }
        this.sendResponse();
        break;
      }
      case 'error':
        console.warn('realtime error', ev);
        break;
    }
  }

  disconnect(reason = 'user') {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const secs = this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
    if (this.sessionId) {
      void fetch('/api/voice/session', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: this.sessionId, seconds: secs }) });
      this.sessionId = null;
    }
    this.dc?.close();
    this.pc?.close();
    this.mic?.getTracks().forEach((t) => t.stop());
    if (this.audio) this.audio.srcObject = null;
    this.dc = null;
    this.pc = null;
    this.mic = null;
    this.startedAt = 0;
    if (this.state !== 'off') {
      this.set('off');
      this.cb.onEnded(reason);
    }
  }
}

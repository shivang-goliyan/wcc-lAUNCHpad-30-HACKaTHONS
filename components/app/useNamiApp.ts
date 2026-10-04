'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import type { AppSnapshot } from '@/lib/server/snapshot';
import { RealtimeVoice, type VoiceState } from '@/lib/client/realtime';
import { chime, speak, stopSpeaking } from '@/lib/client/speak';
import { STRINGS, type UILang } from '@/lib/client/i18n';

export type Caption = { id: string; who: 'nami' | 'meera' | 'system'; text: string; final: boolean };
export type Snap = AppSnapshot & { ok: true };

const fetcher = async (u: string) => {
  const r = await fetch(u, { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.error ?? 'error'), { status: r.status });
  return j;
};

export async function post(url: string, body?: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.json().catch(() => ({}));
}

const TERMINAL = ['resolved_user_responded', 'resolved_human_reported', 'cancelled_mistake'];

export function useNamiApp() {
  const { data, error, mutate } = useSWR<Snap>('/api/state', fetcher, { refreshInterval: 1500, revalidateOnFocus: true });
  const [lang, setLang] = useState<UILang>('hi');
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [voice, setVoice] = useState<VoiceState>('off');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [mouth, setMouth] = useState(0);
  const [muted, setMuted] = useState(false);
  const [textSpeaking, setTextSpeaking] = useState(false);
  const [ack, setAck] = useState(0);
  const [busy, setBusy] = useState(false);
  const rt = useRef<RealtimeVoice | null>(null);
  const lipStop = useRef<(() => void) | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);
  const history = useRef<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const t = STRINGS[lang];

  useEffect(() => {
    try {
      const l = localStorage.getItem('nami_lang');
      if (l === 'en' || l === 'hi') setLang(l);
    } catch {}
  }, []);
  const switchLang = useCallback((l: UILang) => {
    setLang(l);
    try {
      localStorage.setItem('nami_lang', l);
    } catch {}
  }, []);

  const addCaption = useCallback((who: Caption['who'], text: string, final: boolean, key?: string) => {
    setCaptions((cs) => {
      const id = key ?? `${who}-${Date.now()}-${Math.random()}`;
      const last = cs[cs.length - 1];
      if (last && !last.final && last.who === who) return [...cs.slice(0, -1), { ...last, text, final }].slice(-8);
      return [...cs, { id, who, text, final }].slice(-8);
    });
  }, []);

  // ---- heartbeat (device availability = "Nami page last seen") -------------------------------
  useEffect(() => {
    const beat = () => void post('/api/heartbeat', { visibility: document.visibilityState === 'visible' ? 'visible' : 'hidden' });
    beat();
    const id = setInterval(beat, 10_000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', beat);
    };
  }, []);

  // ---- speaking helpers -----------------------------------------------------------------------
  const sayLocal = useCallback(
    (text: string) => {
      if (muted) return;
      speak(text, {
        onStart: () => setTextSpeaking(true),
        onEnd: () => {
          setTextSpeaking(false);
          setMouth(0);
        },
        onBoundary: () => {
          setMouth(0.4 + Math.random() * 0.5);
          setTimeout(() => setMouth(0.1), 120);
        },
      });
    },
    [muted],
  );

  /** Tell Nami about an app event: realtime voice if connected, else a local spoken line + caption. */
  const announce = useCallback(
    (systemNote: string, local: { en: string; hi: string }) => {
      if (rt.current?.connected) rt.current.notify(systemNote);
      else {
        const line = lang === 'hi' ? local.hi : local.en;
        addCaption('nami', line, true);
        sayLocal(line);
      }
    },
    [addCaption, lang, sayLocal],
  );

  // ---- react to engine state changes -----------------------------------------------------------
  useEffect(() => {
    if (!data?.ok) return;
    const s = seen.current;
    const mark = (k: string) => {
      if (s.has(k)) return false;
      s.add(k);
      return !first.current;
    };
    for (const o of data.occurrences) {
      if (o.state === 'awaiting_response' && mark(`occ:${o.id}:${o.notifyAt}`)) {
        chime();
        announce(`App update (not spoken by Meera): the reminder "${o.label}" is due now. Gently remind her in her language and ask whether she has done it. Use record_reminder_response with occurrence_id ${o.id} when she answers.`, {
          en: `${data.recipient.addressAs}, it's time for: ${o.label}. Have you done it?`,
          hi: `${data.recipient.addressAs}, ${o.labelHi} का समय हो गया है। क्या आपने ले ली?`,
        });
      }
      if (o.state === 'resolved' && o.outcome && ['taken_reported', 'done_reported'].includes(o.outcome) && mark(`ack:${o.id}`)) setAck((n) => n + 1);
    }
    for (const c of data.cases) {
      if (c.type === 'checkin' && c.state === 'awaiting_response' && mark(`chk:${c.id}`)) {
        chime();
        announce('App update: it is time for the agreed daily check-in. Warmly ask Meera ji to just say she is here. When she answers, call respond_to_checkin with her words.', {
          en: `Good morning ${data.recipient.addressAs} — daily check-in. Just tell me you're here.`,
          hi: `नमस्ते ${data.recipient.addressAs}, आज का चेक-इन है। बस बोल दीजिए "मैं हूँ"।`,
        });
      }
      if (c.state === 'owner_accepted' && mark(`own:${c.id}:${c.ownerContactId}`)) {
        const who = data.contacts.find((x) => x.id === c.ownerContactId)?.name ?? 'Your contact';
        announce(`App update: ${who} has accepted and is following up with Meera ji. Tell her kindly. Do not say she is safe.`, {
          en: `${who} has seen it and is checking on you now.`,
          hi: `${who} ने देख लिया है और अभी आपसे संपर्क कर रहे हैं।`,
        });
      }
    }
    for (const p of data.pending) {
      if (p.kind === 'approve_slot' && mark(`pa:${p.id}`)) {
        chime();
        announce(`App update: the clinic call finished. ${p.readback} Ask Meera ji to confirm. If she clearly says yes, call confirm_pending_action with pending_action_id ${p.id} and her exact words.`, { en: p.readback, hi: p.readbackHi });
      }
    }
    for (const a of data.appointments) {
      if (a.state === 'confirmed' && mark(`apt:${a.id}`)) {
        setAck((n) => n + 1);
        announce('App update: the clinic has confirmed the appointment. Tell Meera ji the confirmed time and any instructions, and that reminders are set.', {
          en: 'The clinic has confirmed your appointment. I have set reminders.',
          hi: 'क्लिनिक ने अपॉइंटमेंट कन्फर्म कर दिया है। मैंने याद दिलाने के लिए रिमाइंडर लगा दिए हैं।',
        });
      }
      if (a.state === 'failed_needs_help' && mark(`aptf:${a.id}`)) {
        announce(`App update: the appointment request could not be completed: ${a.failureReason}. Tell her plainly and offer to try other dates.`, {
          en: `I couldn't book it: ${a.failureReason}. Shall I try other dates?`,
          hi: `अपॉइंटमेंट नहीं हो पाया: ${a.failureReason}। क्या मैं दूसरी तारीख़ें देखूँ?`,
        });
      }
    }
    first.current = false;
  }, [data, announce]);

  // ---- voice ------------------------------------------------------------------------------------
  const startVoice = useCallback(async () => {
    setVoiceError(null);
    stopSpeaking();
    const v = new RealtimeVoice({
      onState: (st, detail) => {
        setVoice(st);
        if (st === 'error') setVoiceError(detail ?? 'error');
      },
      onUserText: (text, final) => addCaption('meera', text, final),
      onNamiText: (text, final) => addCaption('nami', text, final),
      onToolResult: () => void mutate(),
      onRemoteStream: async (stream) => {
        lipStop.current?.();
        try {
          const mod = await import('@/components/nami/lipsync');
          const stop = mod.createLipSync(stream, (val: number) => setMouth(val));
          lipStop.current = typeof stop === 'function' ? stop : (stop as { stop: () => void })?.stop;
        } catch {
          /* lip-sync optional */
        }
      },
      onEnded: (reason) => {
        lipStop.current?.();
        setMouth(0);
        if (reason === 'time_limit') addCaption('system', 'Voice time limit reached — you can keep typing to Nami.', true);
      },
    });
    rt.current = v;
    try {
      await v.connect();
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : 'voice_error');
    }
  }, [addCaption, mutate]);

  const stopVoice = useCallback(() => {
    rt.current?.disconnect('user');
    rt.current = null;
  }, []);

  useEffect(() => () => rt.current?.disconnect('unmount'), []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      rt.current?.setMuted(!m);
      if (!m) stopSpeaking();
      return !m;
    });
  }, []);

  // ---- text mode -------------------------------------------------------------------------------
  const sendText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      addCaption('meera', text, true);
      if (rt.current?.connected) {
        rt.current.notify(`Meera typed: "${text}"`);
        return;
      }
      setBusy(true);
      const r = await post('/api/chat', { history: history.current.slice(-10), message: text });
      setBusy(false);
      history.current.push({ role: 'user', text });
      if (r.ok) {
        history.current.push({ role: 'assistant', text: r.text });
        addCaption('nami', r.text, true);
        sayLocal(r.text);
      } else {
        addCaption('system', r.error === 'llm_not_configured' ? 'Text chat needs an API key on the server — use the buttons meanwhile.' : 'Sorry, something went wrong. Please use the buttons.', true);
      }
      void mutate();
    },
    [addCaption, mutate, sayLocal],
  );

  // ---- commands from buttons ------------------------------------------------------------------
  const command = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await post('/api/command', body);
      if (r?.reply?.sayHint && !rt.current?.connected && body.type !== 'pending.confirm') addCaption('nami', r.reply.sayHint, true);
      await mutate();
      return r;
    },
    [addCaption, mutate],
  );

  // ---- derived mascot state ---------------------------------------------------------------------
  const derived = useMemo(() => {
    if (!data?.ok) return null;
    const openHelp = data.cases.find((c) => c.type === 'help' && !TERMINAL.includes(c.state)) ?? null;
    const openCheckin = data.cases.find((c) => c.type === 'checkin' && !TERMINAL.includes(c.state)) ?? null;
    const activeCall = data.calls.find((c) => ['queued', 'ringing', 'in_progress'].includes(c.state as string)) ?? null;
    const dueReminder = data.occurrences.find((o) => o.state === 'awaiting_response') ?? null;
    const quiet = !!data.ui.quietUntil && data.ui.quietUntil > data.now;
    let interaction: 'idle' | 'listening' | 'thinking' | 'speaking' | 'reminder' | 'calling' | 'help' | 'quiet' = 'idle';
    if (openHelp) interaction = 'help';
    else if (activeCall) interaction = 'calling';
    else if (voice === 'speaking' || textSpeaking) interaction = 'speaking';
    else if (voice === 'listening') interaction = 'listening';
    else if (voice === 'thinking' || voice === 'connecting' || busy) interaction = 'thinking';
    else if (dueReminder || openCheckin?.state === 'awaiting_response') interaction = 'reminder';
    else if (quiet) interaction = 'quiet';
    return { openHelp, openCheckin, activeCall, dueReminder, interaction };
  }, [data, voice, textSpeaking, busy]);

  return { data, error, mutate, lang, switchLang, t, captions, voice, voiceError, startVoice, stopVoice, mouth, muted, toggleMute, sendText, command, derived, ack, busy };
}

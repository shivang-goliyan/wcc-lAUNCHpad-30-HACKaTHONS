'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  Activity,
  BellRing,
  CalendarDays,
  Check,
  CircleAlert,
  FastForward,
  HeartHandshake,
  Keyboard,
  LifeBuoy,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  RotateCcw,
  Send,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { NamiImage } from '@/components/nami/NamiImage';
import type { PoseName } from '@/lib/nami/poses';
import { useNamiApp, post, type Snap } from './useNamiApp';
import { useWakeWord } from './useWakeWord';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

export default function AppScreen() {
  const app = useNamiApp();
  const { data, error, t, lang } = app;
  const [pose, setPose] = useState<PoseName>('greeting');
  const [look, setLook] = useState<{ x: number; y: number } | null>(null);
  // one greeting wave on mount, then follow the real state
  useEffect(() => {
    const id = setTimeout(() => setPose('idle'), 2200);
    return () => clearTimeout(id);
  }, []);
  const interaction = app.derived?.interaction ?? 'idle';
  const [ackPose, setAckPose] = useState(false);
  useEffect(() => {
    if (!app.ack) return;
    const on = setTimeout(() => setAckPose(true), 0);
    const off = setTimeout(() => setAckPose(false), 1100);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [app.ack]);
  const effectivePose: PoseName = interaction === 'help' ? 'help' : ackPose ? 'acknowledged' : pose === 'greeting' ? 'greeting' : (interaction as PoseName);

  // keyboard shortcuts (docs/PRD.md §8)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (app.voice === 'off' || app.voice === 'error') void app.startVoice();
        else app.stopVoice();
      } else if (e.key.toLowerCase() === 'h') void app.command({ type: 'help.open', kind: 'explicit_help', source: 'keyboard' });
      else if (e.key.toLowerCase() === 'm') app.toggleMute();
      else if (e.key.toLowerCase() === 'd') document.getElementById('my-day')?.scrollIntoView({ behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app]);

  if (error && (error as { status?: number }).status === 401) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md rounded-[20px] bg-card p-8 text-center shadow-[0_8px_30px_rgba(23,61,56,.1)]">
          <NamiImage pose="greeting" className="mx-auto h-40 w-40" title="Nami waving" />
          <h1 className="mt-4 font-display text-3xl text-teal-900">Meet Nami</h1>
          <p className="mt-2 text-ink-600">Start a private demo household as Meera ji. Nothing real is called unless you set it up.</p>
          <a href="/try" className="mt-6 inline-flex rounded-full bg-teal-900 px-6 py-3 text-lg font-semibold text-ivory-50">Start the demo</a>
        </div>
      </main>
    );
  }
  if (!data?.ok || !app.derived) {
    return (
      <main className="grid min-h-screen place-items-center">
        <NamiImage pose="thinking" className="h-40 w-40 opacity-80" title="Loading" />
      </main>
    );
  }
  const d = data as Snap;
  const { openHelp, openCheckin, activeCall, dueReminder } = app.derived;
  const escalation = openHelp ?? (openCheckin && ['escalating', 'owner_accepted', 'unresolved', 'phone_fallback'].includes(openCheckin.state) ? openCheckin : null);
  const statusText =
    app.voice === 'connecting' ? t.connecting : app.voice === 'listening' ? t.listening : app.voice === 'thinking' ? t.thinking : app.voice === 'speaking' ? t.speaking : activeCall ? (lang === 'hi' ? 'क्लिनिक से बात चल रही है…' : 'On a call for you…') : t.idle;

  return (
    <div
      className="min-h-screen bg-ivory-50 text-ink-900"
      onPointerMove={(e) => setLook({ x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 })}
      style={{ fontSize: `${(d.recipient.prefs.textScale ?? 1) * 100}%` }}
    >
      <Header app={app} d={d} />

      <AnimatePresence>{escalation && <HelpBanner d={d} c={escalation} app={app} />}</AnimatePresence>

      <main className="mx-auto grid max-w-[1400px] gap-5 px-4 pb-16 pt-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-6">
        <section className="flex min-w-0 flex-col gap-4">
          {/* Stage: conversation + Nami */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#e9f1ec] via-ivory-50 to-[#f3e9da] p-5 shadow-[0_8px_30px_rgba(23,61,56,.10)] ring-1 ring-line sm:p-7">
            <Lake />
            <div className="relative grid min-h-[380px] gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="flex min-w-0 flex-col">
                <div className="mb-3 flex items-center gap-2 text-sm text-ink-600" aria-live="polite">
                  <span className={cx('h-2.5 w-2.5 rounded-full', app.voice === 'listening' ? 'animate-pulse bg-ok-600' : app.voice === 'speaking' ? 'bg-sea-500' : activeCall ? 'animate-pulse bg-warn-600' : 'bg-line')} />
                  <span className="font-medium">{statusText}</span>
                  {app.muted && <span className="rounded-full bg-ink-900/80 px-2 py-0.5 text-xs text-white">{t.mute}</span>}
                </div>
                <Captions captions={app.captions} lang={lang} name={d.recipient.addressAs} />
                <div className="mt-auto flex flex-col gap-3 pt-4">
                  <AnimatePresence>
                    {d.pending.map((p) => (
                      <ApprovalCard key={p.id} p={p} lang={lang} t={t} onAnswer={(yes) => app.command({ type: yes ? 'pending.confirm' : 'pending.decline', pendingId: p.id, source: 'button' })} />
                    ))}
                    {dueReminder && <ReminderCard key={dueReminder.id} o={dueReminder} lang={lang} t={t} app={app} />}
                    {openCheckin && ['awaiting_response', 'retrying_page'].includes(openCheckin.state) && <CheckinCard key={openCheckin.id} t={t} app={app} />}
                  </AnimatePresence>
                </div>
              </div>
              <div className="relative flex items-end justify-center">
                <motion.div layout className="w-[240px] sm:w-[280px]">
                  <NamiImage pose={effectivePose} mouth={app.mouth} lookAt={look} reducedMotion={d.recipient.prefs.reducedMotion} title={`Nami, ${statusText}`} className="h-auto w-full drop-shadow-[0_18px_24px_rgba(23,61,56,.18)]" />
                </motion.div>
              </div>
            </div>
            {activeCall && <CallTranscript call={activeCall} />}
          </div>

          <Controls app={app} />
          <Composer app={app} />
          <p className="flex items-center gap-2 text-sm text-ink-600">
            <ShieldCheck className="h-4 w-4" /> {t.aiDisclosure} <span className="hidden sm:inline">· Keys: Space talk · H help · M mute</span>
          </p>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <MyDay d={d} lang={lang} />
          <MemoryCorner d={d} app={app} />
          <Appointments d={d} />
          <ActivityFeed d={d} t={t} />
          <DemoPanel d={d} app={app} />
        </aside>
      </main>
    </div>
  );
}

type App = ReturnType<typeof useNamiApp>;

function Header({ app, d }: { app: App; d: Snap }) {
  const { t, lang } = app;
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ivory-50/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-sea-200">
            <NamiImage pose="idle" className="h-12 w-12 translate-y-1" blink="off" reducedMotion />
          </span>
          <span className="font-display text-2xl font-semibold text-teal-900">Raynet</span>
        </Link>
        <span className="hidden text-ink-600 sm:inline">· {d.recipient.addressAs}, {d.recipient.city}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-warn-600/30 bg-[#fbf3e3] py-1 pl-3 pr-1 text-sm" title="Labelled demo clock, time can be skipped to show what happens later">
            <span className="font-semibold text-warn-600">{t.demoTime}</span>
            <span className="tabular-nums">{lang === 'hi' ? d.clock.spokenHi : d.clock.spokenEn}</span>
            <button onClick={async () => { await post('/api/demo/skip'); await app.mutate(); }} className="flex items-center gap-1 rounded-full bg-warn-600 px-3 py-1.5 font-semibold text-white hover:bg-[#9c6619]">
              <FastForward className="h-4 w-4" /> <span className="hidden md:inline">{t.skip}</span>
            </button>
          </div>
          <div className="flex rounded-full border border-line bg-card p-0.5 text-sm" role="group" aria-label="Language">
            {(['en', 'hi'] as const).map((l) => (
              <button key={l} onClick={() => app.switchLang(l)} aria-pressed={lang === l} className={cx('rounded-full px-3 py-1.5 font-semibold', lang === l ? 'bg-teal-900 text-ivory-50' : 'text-ink-600')}>
                {l === 'en' ? 'EN' : 'हिं'}
              </button>
            ))}
          </div>
          <Link href="/console" className="rounded-full border border-line bg-card px-3 py-1.5 text-sm font-semibold text-teal-900 hover:bg-ivory-100">
            Agent console
          </Link>
        </div>
      </div>
    </header>
  );
}

function Lake() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full opacity-60" viewBox="0 0 1200 160" preserveAspectRatio="none">
      <path d="M0 70 C 200 40, 380 90, 600 60 S 1000 40, 1200 70 L1200 160 L0 160 Z" fill="#cfe0d8" />
      <path d="M0 100 C 220 80, 420 120, 640 96 S 1020 80, 1200 104 L1200 160 L0 160 Z" fill="#b9d3c8" />
    </svg>
  );
}

function Captions({ captions, lang, name }: { captions: App['captions']; lang: string; name: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [captions]);
  if (!captions.length)
    return (
      <div className="rounded-2xl bg-card/80 p-5 text-xl leading-relaxed text-teal-900 ring-1 ring-line">
        {lang === 'hi' ? `नमस्ते ${name}! मैं नामी हूँ, एक AI साथी। बात करने के लिए "नामी से बात करें" दबाइए।` : `Namaste ${name}! I'm Nami, an AI companion. Press “Talk to Nami” to start.`}
      </div>
    );
  return (
    <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1" aria-live="polite" aria-label="Captions">
      {captions.map((c) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: c.final ? 1 : 0.75, y: 0 }}
          className={cx(
            'max-w-[92%] rounded-2xl px-4 py-3 text-lg leading-snug',
            c.who === 'nami' && 'self-start bg-card text-teal-900 ring-1 ring-line',
            c.who === 'meera' && 'self-end bg-teal-900 text-ivory-50',
            c.who === 'system' && 'self-center bg-[#fbf3e3] text-sm text-warn-600',
          )}
        >
          <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide opacity-60">{c.who === 'nami' ? 'Nami' : c.who === 'meera' ? 'You' : 'Note'}</span>
          {c.text}
        </motion.div>
      ))}
      <div ref={end} />
    </div>
  );
}

function CardShell({ children, tone = 'teal' }: { children: React.ReactNode; tone?: 'teal' | 'warn' }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      className={cx('rounded-2xl bg-card p-4 shadow-[0_8px_30px_rgba(23,61,56,.10)] ring-2', tone === 'warn' ? 'ring-warn-600/40' : 'ring-sea-500/60')}
    >
      {children}
    </motion.div>
  );
}

function ApprovalCard({ p, lang, t, onAnswer }: { p: Snap['pending'][number]; lang: string; t: App['t']; onAnswer: (yes: boolean) => void }) {
  const icon = p.kind === 'approve_slot' || p.kind === 'permit_clinic_call' ? <Stethoscope className="h-6 w-6" /> : <Users className="h-6 w-6" />;
  return (
    <CardShell>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sea-200 text-teal-900">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-700">{p.kind === 'approve_slot' ? 'Approve this slot?' : p.kind === 'permit_clinic_call' ? 'May Nami call the clinic?' : p.kind === 'send_memory' ? 'Send this story?' : 'Confirm'}</p>
          <p className="mt-1 text-lg leading-snug text-ink-900">{lang === 'hi' ? p.readbackHi : p.readback}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => onAnswer(true)} className="flex min-h-14 items-center gap-2 rounded-full bg-teal-900 px-6 text-lg font-semibold text-ivory-50 hover:bg-teal-700">
              <Check className="h-5 w-5" /> {t.yesConfirm}
            </button>
            <button onClick={() => onAnswer(false)} className="flex min-h-14 items-center gap-2 rounded-full border-2 border-line bg-card px-6 text-lg font-semibold text-ink-900 hover:bg-ivory-100">
              <X className="h-5 w-5" /> {t.no}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-600">Nothing happens until you say yes or press Yes.</p>
        </div>
      </div>
    </CardShell>
  );
}

function ReminderCard({ o, lang, t, app }: { o: Snap['occurrences'][number]; lang: string; t: App['t']; app: App }) {
  const r = (response: string, extra: Record<string, unknown> = {}) => app.command({ type: 'reminder.respond', occurrenceId: o.id, response, source: 'button', ...extra });
  return (
    <CardShell tone="warn">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fbf3e3] text-warn-600">
          <BellRing className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-warn-600">Reminder · {o.time}</p>
          <p className="mt-1 text-xl font-semibold leading-snug">{lang === 'hi' ? o.labelHi : o.label}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => r(o.kind === 'medication' ? 'taken' : 'done')} className="min-h-14 rounded-full bg-teal-900 px-5 text-lg font-semibold text-ivory-50">{o.kind === 'medication' ? t.taken : '✓ Done'}</button>
            {o.kind === 'medication' && <button onClick={() => r('not_taken')} className="min-h-14 rounded-full border-2 border-line px-5 text-lg font-semibold">{t.notTaken}</button>}
            <button onClick={() => r('snooze', { snoozeMinutes: 15 })} className="min-h-14 rounded-full border-2 border-line px-5 text-lg font-semibold">{t.later}</button>
          </div>
          <p className="mt-2 text-xs text-ink-600">Nami records what you say. She cannot check whether a medicine was taken.</p>
        </div>
      </div>
    </CardShell>
  );
}

function CheckinCard({ t, app }: { t: App['t']; app: App }) {
  return (
    <CardShell>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sea-200 text-teal-900">
          <HeartHandshake className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Daily check-in</p>
          <p className="mt-1 text-xl font-semibold">{app.lang === 'hi' ? 'नमस्ते! आज का चेक-इन, बस बता दीजिए आप यहाँ हैं।' : "Good morning! Daily check-in, just let me know you're here."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => app.command({ type: 'checkin.respond', source: 'button' })} className="min-h-14 rounded-full bg-teal-900 px-6 text-lg font-semibold text-ivory-50">{t.imHere}</button>
            <button onClick={() => app.command({ type: 'help.open', kind: 'explicit_help', source: 'button' })} className="min-h-14 rounded-full border-2 border-help-600/60 px-5 text-lg font-semibold text-help-600">{t.needHelp}</button>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function HelpBanner({ d, c, app }: { d: Snap; c: Snap['cases'][number]; app: App }) {
  const name = (id: string | null) => d.contacts.find((x) => x.id === id)?.name ?? 'contact';
  const active = c.attempts.find((a) => a.state === 'active' && a.contactId);
  let line = '';
  if (c.state === 'owner_accepted') line = `${name(c.ownerContactId)} accepted and is following up. Waiting for their report. Nobody is marked “safe” automatically.`;
  else if (c.state === 'unresolved') line = 'Nobody has accepted yet. Links stay open for a late reply. Please call 112 if this is an emergency.';
  else if (c.state === 'phone_fallback') line = 'Check-in not answered, trying the agreed phone fallback before contacting family.';
  else if (active) line = `Contacting ${name(active.contactId)}… waiting for an explicit “I'll check”.`;
  else line = 'Contacting your chosen person…';
  const help = c.type === 'help';
  const showMistake = help && c.state === 'escalating' && d.now - c.openedAt < 60_000;
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={cx('overflow-hidden text-white', help ? 'bg-help-600' : c.state === 'owner_accepted' ? 'bg-teal-700' : 'bg-[#8a5a1c]')} role="status" aria-live="assertive">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <LifeBuoy className="h-6 w-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{help ? 'Help requested' : 'Check-in follow-up'} · {c.state.replace(/_/g, ' ')}</p>
          <p className="text-white/90">{line}</p>
        </div>
        {showMistake && (
          <button onClick={() => app.command({ type: 'help.mistake', caseId: c.id, source: 'button' })} className="rounded-full bg-white/15 px-4 py-2 font-semibold ring-1 ring-white/40 hover:bg-white/25">
            {app.t.mistake}
          </button>
        )}
        {!help && c.state !== 'owner_accepted' && (
          <button onClick={() => app.command({ type: 'checkin.respond', source: 'button' })} className="rounded-full bg-white px-4 py-2 font-semibold text-teal-900">{app.t.imHere}</button>
        )}
        <a href="tel:112" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold text-help-600">
          <Phone className="h-4 w-4" /> {app.t.emergency}
        </a>
      </div>
    </motion.div>
  );
}

function Controls({ app }: { app: App }) {
  const { t } = app;
  const on = app.voice !== 'off' && app.voice !== 'error';
  const wake = useWakeWord({ voiceOn: on, start: () => void app.startVoice() });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <button onClick={() => (on ? app.stopVoice() : app.startVoice())} className={cx('col-span-2 flex min-h-16 items-center justify-center gap-3 rounded-2xl text-xl font-semibold shadow-[0_8px_30px_rgba(23,61,56,.10)] sm:col-span-1', on ? 'bg-sea-500 text-teal-900' : 'bg-teal-900 text-ivory-50 hover:bg-teal-700')}>
        <Mic className="h-6 w-6" /> {on ? t.stopTalking : t.talk}
      </button>
      <button onClick={() => document.getElementById('my-day')?.scrollIntoView({ behavior: 'smooth' })} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-card text-lg font-semibold ring-1 ring-line hover:bg-ivory-100">
        <CalendarDays className="h-5 w-5" /> {t.myDay}
      </button>
      <button onClick={() => app.command({ type: 'family.propose', contact: 'primary', reason: 'chat' })} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-card text-lg font-semibold ring-1 ring-line hover:bg-ivory-100">
        <Users className="h-5 w-5" /> {t.callFamily}
      </button>
      <button onClick={() => app.command({ type: 'help.open', kind: 'explicit_help', source: 'button' })} className="col-span-2 flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-help-600 text-xl font-bold text-white shadow-[0_8px_30px_rgba(184,70,59,.25)] hover:bg-[#a03c33] sm:col-span-1">
        <LifeBuoy className="h-6 w-6" /> {t.getHelp}
      </button>
      {app.voiceError && (
        <p className="col-span-full rounded-xl bg-[#fbf3e3] px-4 py-2 text-sm text-warn-600">
          {app.voiceError === 'voice_not_configured' ? 'Live voice is not configured on this server yet. Type to Nami below; she will answer aloud.' : app.voiceError === 'rate_limited' || app.voiceError === 'daily_cap' ? 'Voice demo limit reached for now, type to Nami below.' : `Voice unavailable (${app.voiceError}), type to Nami below.`}
        </p>
      )}
      {wake.status !== 'unavailable' && (
        <button
          onClick={wake.toggle}
          aria-pressed={wake.status !== 'off'}
          className="col-span-full flex items-center justify-center gap-2 text-sm font-semibold text-ink-600 sm:col-span-2 sm:justify-start"
        >
          <span className={cx('h-2.5 w-2.5 rounded-full', wake.status === 'listening' ? 'animate-pulse bg-sea-500' : wake.status === 'error' ? 'bg-help-600' : 'bg-line')} aria-hidden />
          {wake.status === 'off'
            ? app.lang === 'hi' ? '“Hey Nami” सुनना चालू करें' : 'Turn on “Hey Nami”'
            : wake.status === 'loading'
              ? app.lang === 'hi' ? 'तैयार हो रही हूँ…' : 'Getting ready…'
              : wake.status === 'error'
                ? app.lang === 'hi' ? 'माइक नहीं मिला · फिर कोशिश करें' : 'No microphone · tap to retry'
                : wake.status === 'paused'
                  ? app.lang === 'hi' ? 'बात चल रही है' : 'In a conversation'
                  : app.lang === 'hi' ? 'बोलिए “Hey Nami” · यहीं फ़ोन पर सुनती हूँ' : 'Say “Hey Nami” · listening on this device only'}
        </button>
      )}
      <button onClick={app.toggleMute} className="col-span-full flex items-center justify-center gap-2 text-sm font-semibold text-ink-600 sm:col-span-1 sm:col-start-4">
        {app.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {app.muted ? t.unmute : t.mute}
      </button>
    </div>
  );
}

function Composer({ app }: { app: App }) {
  const [v, setV] = useState('');
  const examples = app.lang === 'hi' ? ['अगले हफ्ते डॉक्टर से सुबह का अपॉइंटमेंट बुक कर दो', 'आज का प्लान बताओ', 'हाँ, दवाई ले ली'] : ['Book a morning follow-up with my doctor next week', "What's my plan today?", 'Yes, I took my tablet'];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void app.sendText(v);
        setV('');
      }}
      className="rounded-2xl bg-card p-3 ring-1 ring-line"
    >
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="composer">{app.t.typeHere}</label>
        <Keyboard className="mt-3 h-5 w-5 shrink-0 text-ink-600" />
        <input id="composer" value={v} onChange={(e) => setV(e.target.value)} placeholder={app.t.typeHere} className="min-h-12 flex-1 bg-transparent text-lg outline-none placeholder:text-ink-600/60" />
        <button disabled={!v.trim() || app.busy} className="flex min-h-12 items-center gap-2 rounded-full bg-teal-900 px-5 font-semibold text-ivory-50 disabled:opacity-40">
          <Send className="h-4 w-4" /> {app.t.send}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {examples.map((x) => (
          <button type="button" key={x} onClick={() => void app.sendText(x)} className="rounded-full bg-ivory-100 px-3 py-1.5 text-sm text-ink-600 hover:bg-sea-200">
            “{x}”
          </button>
        ))}
      </div>
    </form>
  );
}

const OUTCOME: Record<string, string> = {
  taken_reported: 'You said you took it',
  done_reported: 'Done',
  not_taken_reported: 'Not taken (you said)',
  unacknowledged: 'No response',
  delivery_uncertain: 'Not delivered, page closed',
  help_requested: 'Help requested',
};

const OUTCOME_HI: Record<string, string> = {
  taken_reported: 'आपने बताया: ले ली',
  done_reported: 'हो गया',
  not_taken_reported: 'नहीं ली (आपने बताया)',
  unacknowledged: 'जवाब नहीं मिला',
  delivery_uncertain: 'पेज बंद था',
  help_requested: 'मदद माँगी',
};

function MyDay({ d, lang }: { d: Snap; lang: string }) {
  return (
    <section id="my-day" className="rounded-[20px] bg-card p-5 ring-1 ring-line">
      <h2 className="flex items-center gap-2 font-display text-xl text-teal-900">
        <CalendarDays className="h-5 w-5" /> {lang === 'hi' ? 'आज का दिन' : 'My day'}
      </h2>
      <ul className="mt-3 space-y-2">
        {d.occurrences.map((o) => (
          <li key={o.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="w-12 shrink-0 font-semibold tabular-nums text-ink-600">{o.time}</span>
            <span className="min-w-0 flex-1 truncate">{lang === 'hi' ? o.labelHi : o.label}</span>
            <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', o.state === 'awaiting_response' ? 'bg-[#fbf3e3] text-warn-600' : o.outcome === 'taken_reported' || o.outcome === 'done_reported' ? 'bg-[#e3f1ea] text-ok-600' : o.state === 'resolved' ? 'bg-ivory-100 text-ink-600' : 'text-ink-600')}>
              {o.state === 'awaiting_response' ? (lang === 'hi' ? 'अभी' : 'Now') : o.outcome ? (lang === 'hi' ? OUTCOME_HI[o.outcome] : OUTCOME[o.outcome]) ?? o.outcome : lang === 'hi' ? 'बाद में' : 'Later'}
            </span>
          </li>
        ))}
        {!d.occurrences.length && <li className="text-ink-600">Nothing else today.</li>}
      </ul>
    </section>
  );
}

const APT_STATE: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Waiting for your OK to call', tone: 'text-warn-600' },
  finding_availability: { label: 'Calling the clinic…', tone: 'text-warn-600' },
  awaiting_user_approval: { label: 'Slot found, needs your approval', tone: 'text-warn-600' },
  pending_clinic_confirmation: { label: 'Confirming with clinic, not booked yet', tone: 'text-warn-600' },
  confirmed: { label: 'Confirmed by the clinic', tone: 'text-ok-600' },
  failed_needs_help: { label: 'Not booked', tone: 'text-bad-600' },
  cancelled: { label: 'Cancelled', tone: 'text-ink-600' },
};

function Appointments({ d }: { d: Snap }) {
  const list = [...d.appointments].reverse();
  if (!list.length) return null;
  return (
    <section className="rounded-[20px] bg-card p-5 ring-1 ring-line">
      <h2 className="flex items-center gap-2 font-display text-xl text-teal-900">
        <Stethoscope className="h-5 w-5" /> Appointments
      </h2>
      <ul className="mt-3 space-y-3">
        {list.map((a) => {
          const st = APT_STATE[a.state] ?? { label: a.state, tone: '' };
          return (
            <li key={a.id} className="rounded-xl bg-ivory-50 p-3">
              <p className={cx('font-semibold', st.tone)}>{st.label}</p>
              {a.offeredSlot && <p className="text-ink-900">{new Date(a.offeredSlot.startAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</p>}
              {a.failureReason && <p className="text-sm text-bad-600">{a.failureReason}</p>}
              {a.verification.length > 0 && (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-teal-700">Verifier checks ({a.verification.filter((v) => v.pass).length}/{a.verification.length} passed)</summary>
                  <ul className="mt-1 space-y-0.5">
                    {a.verification.map((v) => (
                      <li key={v.check} className={v.pass ? 'text-ok-600' : 'text-bad-600'}>
                        {v.pass ? '✓' : '✗'} {v.detail}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CallTranscript({ call }: { call: Snap['calls'][number] }) {
  const turns = (call.transcript as Array<{ speaker: string; text: string }>) ?? [];
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [turns.length]);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative mt-4 rounded-2xl bg-teal-900 p-4 text-ivory-50">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <PhoneCall className="h-4 w-4 animate-pulse" />
        {call.purpose.startsWith('clinic') ? 'Nami is on the phone with the clinic' : 'Nami is calling'} · {call.adapter === 'sim' ? 'Simulated clinic (demo)' : 'Real phone call'} · {String(call.state).replace('_', ' ')}
      </p>
      <div className="max-h-48 space-y-1.5 overflow-y-auto text-[15px]">
        {turns.map((x, i) => (
          <p key={i} className={x.speaker === 'nami' ? 'text-sea-200' : x.speaker === 'system' ? 'text-white/60 italic' : 'text-white'}>
            <span className="mr-2 text-xs font-bold uppercase opacity-70">{x.speaker === 'nami' ? 'Nami' : x.speaker === 'clinic' ? 'Clinic' : x.speaker}</span>
            {x.text}
          </p>
        ))}
        {!turns.length && <p className="text-white/70">Ringing…</p>}
        <div ref={end} />
      </div>
    </motion.div>
  );
}

const CAT: Record<string, string> = { agent: 'bg-sea-200 text-teal-900', state: 'bg-ivory-100 text-ink-600', external: 'bg-[#fbf3e3] text-warn-600', human: 'bg-[#e3f1ea] text-ok-600' };

function ActivityFeed({ d, t }: { d: Snap; t: App['t'] }) {
  const ev = d.events.slice(0, 14);
  return (
    <section className="rounded-[20px] bg-card p-5 ring-1 ring-line">
      <h2 className="flex items-center gap-2 font-display text-xl text-teal-900">
        <Activity className="h-5 w-5" /> {t.activity}
      </h2>
      <ol className="mt-3 space-y-2.5">
        {ev.map((e) => (
          <li key={String(e.id)} className="flex gap-2 text-sm">
            <span className="w-11 shrink-0 tabular-nums text-ink-600">{new Date(e.at_virtual as string).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            <span className="min-w-0 flex-1">
              <span className={cx('mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold uppercase', CAT[e.category as string])}>{String(e.actor).startsWith('contact:') ? 'family' : (e.actor as string)}</span>
              {e.summary as string}
            </span>
          </li>
        ))}
      </ol>
      <Link href="/console" className="mt-3 inline-block text-sm font-semibold text-teal-700 underline">Open the full agent console →</Link>
    </section>
  );
}

function DemoPanel({ d, app }: { d: Snap; app: App }) {
  const arjun = d.contacts.find((c) => c.priority === 1);
  const clinic = d.clinics[0];
  return (
    <section className="rounded-[20px] border-2 border-dashed border-warn-600/40 bg-[#fffaf0] p-5">
      <h2 className="flex items-center gap-2 font-display text-xl text-warn-600">
        <CircleAlert className="h-5 w-5" /> Demo controls
      </h2>
      {arjun && (
        <div className="mt-3 flex items-center gap-4">
          <a href={arjun.careUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-white p-2 ring-1 ring-line">
            <QRCodeSVG value={arjun.careUrl} size={104} fgColor="#173D38" />
          </a>
          <p className="text-sm text-ink-600">
            <b className="text-ink-900">Be {arjun.name} (her son).</b> Scan with your phone to open the caregiver view. When a check-in is missed, you will be asked to accept follow-up.
          </p>
        </div>
      )}
      <button
        onClick={() => {
          const d0 = new Date(d.clock.date + 'T00:00:00Z');
          const iso = (n: number) => new Date(d0.getTime() + n * 86400000).toISOString().slice(0, 10);
          void app.command({ type: 'appointment.propose', clinicId: clinic?.id ?? 'cl_mehta', dateFrom: iso(2), dateTo: iso(6), window: 'morning', reason: 'follow_up' });
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 font-semibold text-teal-900 ring-1 ring-line hover:bg-ivory-100"
      >
        <Stethoscope className="h-4 w-4" /> Try: “Book {clinic?.doctor ?? 'the doctor'}, a morning next week”
      </button>
      <label className="mt-4 block text-sm font-semibold text-ink-900" htmlFor="scenario">Simulated clinic behaviour</label>
      <select
        id="scenario"
        defaultValue={clinic?.scenario}
        onChange={async (e) => {
          await post('/api/demo/scenario', { scenario: e.target.value });
          await app.mutate();
        }}
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
      >
        <option value="cooperative">Cooperative receptionist</option>
        <option value="busy_then_cooperative">Busy, then helpful</option>
        <option value="evening_only">Only evening slots (verifier should reject a morning request)</option>
        <option value="asks_for_extra_info">Asks for phone/DOB (Nami must refuse)</option>
        <option value="no_slots">Fully booked</option>
        <option value="voicemail">Goes to voicemail</option>
      </select>
      <button
        onClick={async () => {
          await post('/api/demo/reset');
          window.location.reload();
        }}
        className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-ink-900"
      >
        <RotateCcw className="h-4 w-4" /> Reset demo household
      </button>
    </section>
  );
}

function MemoryCorner({ d, app }: { d: Snap; app: App }) {
  const mp = [...(d.memoryPrompts ?? [])].reverse()[0];
  if (!mp) return null;
  const hi = app.lang === 'hi';
  return (
    <section className="overflow-hidden rounded-[20px] bg-card ring-1 ring-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mp.photoPath} alt={mp.caption} className="aspect-[48/34] w-full object-cover" />
      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-cocoa-500">Memory Corner · from {mp.fromName}</p>
        <p className="mt-1 font-display text-lg leading-snug text-teal-900">“{mp.caption}”</p>
        {mp.state === 'new' && (
          <button onClick={() => app.startStory(mp)} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-cocoa-500 px-4 font-semibold text-white hover:bg-[#74503a]">
            <HeartHandshake className="h-5 w-5" /> {hi ? 'नामी को कहानी सुनाइए' : 'Tell Nami the story'}
          </button>
        )}
        {mp.state === 'story_drafted' && <p className="mt-2 text-sm text-warn-600">{hi ? 'कहानी तैयार है, भेजने से पहले आपकी अनुमति चाहिए।' : 'Story drafted, waiting for your OK before sending.'}</p>}
        {mp.state === 'sent' && <p className="mt-2 text-sm font-semibold text-ok-600">✓ {hi ? `${mp.fromName} को भेज दी गई` : `Sent to ${mp.fromName}`}</p>}
        {mp.state === 'kept_private' && <p className="mt-2 text-sm text-ink-600">{hi ? 'निजी रखी गई' : 'Kept private'}</p>}
        <p className="mt-2 text-xs text-ink-600">{hi ? 'नामी कुछ भी आपकी हाँ के बिना नहीं भेजती।' : 'Nothing is sent without your yes. Nami never imitates family voices.'}</p>
      </div>
    </section>
  );
}

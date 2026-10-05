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
  ClipboardList,
  ExternalLink,
  FastForward,
  HeartHandshake,
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
import '@/components/care/paper.css';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

export default function AppScreen() {
  const app = useNamiApp();
  const { data, error, t, lang } = app;
  const [pose, setPose] = useState<PoseName>('greeting');
  const [look, setLook] = useState<{ x: number; y: number } | null>(null);
  const [judges, setJudges] = useState(false);
  // header + help banner height, so the talk column can fill exactly what's left of the screen
  const topRef = useRef<HTMLDivElement>(null);
  const [topH, setTopH] = useState(72);
  const ready = !!(data?.ok && app.derived);
  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTopH(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);
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
      if (e.key === 'Escape') return setJudges(false);
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') {
        if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return;
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
      <main className="pp-paper grid min-h-screen place-items-center p-6">
        <div className="pp-note pp-tape relative max-w-md rounded-sm p-8 text-center" style={{ ['--tilt' as string]: '-1deg' }}>
          <NamiImage pose="greeting" className="mx-auto h-40 w-40" title="Nami waving" />
          <h1 className="mt-4 font-display text-3xl text-teal-900">Meet Nami</h1>
          <p className="mt-2 text-lg text-ink-600">Start a private demo household as Meera ji. Nothing real is called unless you set it up.</p>
          <a href="/try" className="mt-6 inline-flex min-h-14 items-center rounded-full bg-cocoa-500 px-7 text-lg font-semibold text-ivory-50 hover:bg-[#7a4a32]">
            Start the demo
          </a>
        </div>
      </main>
    );
  }
  if (!data?.ok || !app.derived) {
    return (
      <main className="pp-paper grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-2">
          <NamiImage pose="thinking" className="h-40 w-40 opacity-80" title="Loading" />
          <p className="font-hand text-xl text-cocoa-500" role="status">
            Getting Meera ji&rsquo;s day ready…
          </p>
        </div>
      </main>
    );
  }
  const d = data as Snap;
  const { openHelp, openCheckin, activeCall, dueReminder } = app.derived;
  const escalation = openHelp ?? (openCheckin && ['escalating', 'owner_accepted', 'unresolved', 'phone_fallback'].includes(openCheckin.state) ? openCheckin : null);
  const hasCard = d.pending.length > 0 || !!dueReminder || !!(openCheckin && ['awaiting_response', 'retrying_page'].includes(openCheckin.state));
  const statusText =
    app.voice === 'connecting' ? t.connecting : app.voice === 'listening' ? t.listening : app.voice === 'thinking' ? t.thinking : app.voice === 'speaking' ? t.speaking : activeCall ? (lang === 'hi' ? 'क्लिनिक से बात चल रही है…' : 'On a call for you…') : t.idle;

  return (
    <div
      className="pp-paper flex min-h-screen flex-1 flex-col text-ink-900"
      onPointerMove={(e) => setLook({ x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 })}
      style={{ fontSize: `${(d.recipient.prefs.textScale ?? 1) * 100}%`, ['--top' as string]: `${topH}px` }}
    >
      <div ref={topRef} className="z-30 lg:sticky lg:top-0">
        <Header app={app} d={d} judges={judges} onJudges={() => setJudges((v) => !v)} />
        <AnimatePresence>{escalation && <HelpBanner d={d} c={escalation} app={app} />}</AnimatePresence>
      </div>

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-6 px-4 pt-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:px-8 lg:pt-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label={lang === 'hi' ? 'नामी से बात' : 'Talk with Nami'} className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-[calc(var(--top)+20px)] lg:h-[calc(100dvh-var(--top)-40px)] lg:min-h-[600px] lg:self-start">
          {/* Nami at Meera's breakfast table */}
          <div className="relative flex flex-col overflow-hidden rounded-[28px] bg-[#f6efe2] shadow-[0_18px_44px_rgba(70,45,20,.16)] ring-1 ring-[#e3d5bd] md:min-h-[500px] lg:min-h-0 lg:flex-1">
            <div className="relative h-[200px] shrink-0 sm:h-[240px] md:absolute md:inset-0 md:h-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/scenes/day-morning.webp"
                srcSet="/scenes/day-morning-sm.webp 960w, /scenes/day-morning.webp 1920w"
                sizes="(min-width: 1024px) 66vw, 100vw"
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-[30%_70%] md:object-[60%_75%]"
              />
              <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(246,239,226,0)_55%,#f6efe2_100%)] md:bg-[linear-gradient(90deg,rgba(246,239,226,.97)_0%,rgba(246,239,226,.93)_44%,rgba(246,239,226,.35)_66%,rgba(246,239,226,0)_82%)]" />
              {/* Nami steps back a little when a note needs Meera's answer, so the note has room */}
              <div className={cx('absolute right-1 bottom-0 w-[170px] transition-[width] duration-500 sm:w-[200px] md:right-2', hasCard ? 'md:w-[min(24%,230px)]' : 'md:w-[min(34%,300px)]')}>
                <NamiImage pose={effectivePose} mouth={app.mouth} lookAt={look} reducedMotion={d.recipient.prefs.reducedMotion} title={`Nami, ${statusText}`} className="h-auto w-full drop-shadow-[0_18px_22px_rgba(70,45,20,.28)]" />
              </div>
            </div>

            <div className={cx('pp-scroll relative flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 transition-[width] duration-500 sm:px-6 sm:pb-6 md:pt-6 lg:overflow-y-auto', hasCard ? 'md:w-[78%]' : 'md:w-[64%] lg:w-[62%]')}>
              <div className="-mt-12 flex flex-wrap items-center gap-2 md:mt-0" aria-live="polite">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#fffaf0] px-3.5 py-2 text-[16px] font-semibold text-teal-900 shadow-[0_4px_14px_rgba(70,45,20,.12)] ring-1 ring-[#e3d5bd]">
                  <span className={cx('h-2.5 w-2.5 rounded-full', app.voice === 'listening' ? 'animate-pulse bg-ok-600' : app.voice === 'speaking' ? 'bg-sea-500' : activeCall ? 'animate-pulse bg-warn-600' : 'bg-cocoa-300')} />
                  {statusText}
                </span>
                {app.muted && <span className="rounded-full bg-ink-900/85 px-3 py-1.5 text-sm font-semibold text-white">{t.mute}</span>}
              </div>
              <Captions captions={app.captions} lang={lang} name={d.recipient.addressAs} quiet={hasCard} />
              <AnimatePresence>
                {d.pending.map((p) => (
                  <ApprovalCard key={p.id} p={p} lang={lang} t={t} onAnswer={(yes) => app.command({ type: yes ? 'pending.confirm' : 'pending.decline', pendingId: p.id, source: 'button' })} />
                ))}
                {dueReminder && <ReminderCard key={dueReminder.id} o={dueReminder} lang={lang} t={t} app={app} />}
                {openCheckin && ['awaiting_response', 'retrying_page'].includes(openCheckin.state) && <CheckinCard key={openCheckin.id} t={t} app={app} />}
              </AnimatePresence>
              {activeCall && <CallTranscript call={activeCall} />}
            </div>
          </div>

          <Controls app={app} />
          <Composer app={app} />
          <p className="flex items-center gap-2 px-1 text-[15px] text-ink-600">
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700" aria-hidden /> {t.aiDisclosure}
          </p>
        </section>

        <aside className="grid min-w-0 content-start gap-7 pt-3 md:grid-cols-2 lg:grid-cols-1 lg:pt-1">
          <MyDay d={d} lang={lang} />
          <MemoryCorner d={d} app={app} />
          <Appointments d={d} />
          <ActivityFeed d={d} t={t} />
        </aside>
      </main>

      <AnimatePresence>{judges && <JudgesPanel d={d} app={app} onClose={() => setJudges(false)} />}</AnimatePresence>
    </div>
  );
}

type App = ReturnType<typeof useNamiApp>;

function Header({ app, d, judges, onJudges }: { app: App; d: Snap; judges: boolean; onJudges: () => void }) {
  const { t, lang } = app;
  const first = d.recipient.firstName ?? d.recipient.addressAs;
  return (
    <header className="border-b border-[#e3d5bd] bg-[#f6efe2]/92 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:gap-5 lg:px-8">
        <Link href="/" className="flex shrink-0 flex-col rounded-lg leading-none sm:flex-row sm:items-baseline sm:gap-2" aria-label="Raynet home">
          <span className="font-display text-[26px] font-semibold tracking-tight text-teal-900">Raynet</span>
          <span className="font-hand text-[15px] text-cocoa-500 sm:text-[17px] lg:hidden">for {d.recipient.addressAs}</span>
          <span className="font-hand hidden text-[17px] text-cocoa-500 lg:inline">with Nami</span>
        </Link>
        <span aria-hidden className="hidden h-9 w-px bg-[#e3d5bd] lg:block" />
        <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
          {first === 'Meera' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/people/meera-160.webp" alt="" className="size-10 shrink-0 rounded-full object-cover ring-2 ring-[#fffaf0]" />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sea-200 font-display text-lg font-semibold text-teal-900">{first.slice(0, 1)}</span>
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[16px] font-semibold text-teal-900">{lang === 'hi' ? `${d.recipient.addressAs} की स्क्रीन` : `${first}’s screen`}</p>
            <p className="truncate text-[14px] text-ink-600">
              {d.recipient.city}
              <span className="hidden lg:inline"> · lives alone, talks with Nami</span>
            </p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-[#fbe9a6]/70 px-2.5 py-2 text-[14px] ring-1 ring-warn-600/30 sm:gap-2 sm:px-3" title="A labelled demo clock. Judges can skip it forward to show what happens later in the day.">
            <span className="font-semibold text-[#8a5a12]">
              <span className="sm:hidden">{lang === 'hi' ? 'डेमो' : 'Demo'}</span>
              <span className="hidden sm:inline">{t.demoTime}</span>
            </span>
            <span className="font-semibold tabular-nums text-ink-900 xl:hidden">{d.clock.time}</span>
            <span className="hidden tabular-nums text-ink-900 xl:inline">{lang === 'hi' ? d.clock.spokenHi : d.clock.spokenEn}</span>
            <SkipChip app={app} />
          </div>
          <div className="flex rounded-full bg-[#fffaf0] p-0.5 text-sm ring-1 ring-[#e3d5bd]" role="group" aria-label="Language">
            {(['en', 'hi'] as const).map((l) => (
              <button key={l} onClick={() => app.switchLang(l)} aria-pressed={lang === l} className={cx('min-h-9 rounded-full px-2.5 font-semibold sm:px-3', lang === l ? 'bg-teal-900 text-ivory-50' : 'text-ink-600 hover:text-teal-900')}>
                {l === 'en' ? 'EN' : 'हिं'}
              </button>
            ))}
          </div>
          <button
            onClick={onJudges}
            aria-expanded={judges}
            aria-controls="judges-panel"
            className={cx(
              'flex min-h-10 items-center gap-2 rounded-full border-2 border-dashed px-3 text-[15px] font-semibold transition',
              judges ? 'border-cocoa-500 bg-cocoa-500 text-ivory-50' : 'border-cocoa-300 bg-[#fffaf0] text-cocoa-500 hover:border-cocoa-500',
            )}
          >
            <ClipboardList className="h-[18px] w-[18px]" aria-hidden />
            <span className="sr-only sm:not-sr-only">For judges</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function Captions({ captions, lang, name, quiet }: { captions: App['captions']; lang: string; name: string; quiet: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [captions, quiet]);
  const shown = captions.filter((c) => c.text.trim());
  // the hello bubble steps aside while something needs her answer
  if (!shown.length && quiet) return null;
  if (!shown.length)
    return (
      <div className="pp-note relative max-w-[30rem] self-start rounded-[22px] rounded-tl-md px-5 py-4">
        <p className="font-hand text-[16px] text-cocoa-500">Nami</p>
        <p className="mt-0.5 font-display text-[22px] leading-snug text-teal-900 sm:text-[24px]">
          {lang === 'hi' ? `नमस्ते ${name}! मैं नामी हूँ, एक AI साथी। बात करने के लिए "नामी से बात करें" दबाइए।` : `Namaste ${name}! I'm Nami, an AI companion. Press “Talk to Nami” to start.`}
        </p>
      </div>
    );
  return (
    <div ref={box} className={cx('pp-scroll -mx-1 flex max-h-[42dvh] min-h-0 flex-col gap-2.5 overflow-y-auto px-1 py-1 lg:max-h-none', quiet ? 'shrink-0 lg:sr-only [&>*:not(:last-child)]:hidden' : 'flex-1')} aria-live="polite" aria-label="Captions">
      {shown.map((c) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: c.final ? 1 : 0.75, y: 0 }}
          className={cx(
            'max-w-[92%] text-[19px] leading-snug',
            c.who === 'nami' && 'self-start rounded-[20px] rounded-tl-md bg-[#fffaf0] px-4 py-3 text-teal-900 shadow-[0_6px_18px_rgba(70,45,20,.10)]',
            c.who === 'meera' && 'self-end rounded-[20px] rounded-tr-md bg-teal-900 px-4 py-3 text-ivory-50 shadow-[0_6px_18px_rgba(23,61,56,.18)]',
            c.who === 'system' && 'font-hand self-center rounded-md bg-[#fbe9a6]/80 px-3 py-1.5 text-[16px] text-[#6d4a12]',
          )}
        >
          {c.who !== 'system' && <span className={cx('font-hand block text-[15px] leading-tight', c.who === 'nami' ? 'text-cocoa-500' : 'text-sea-200')}>{c.who === 'nami' ? 'Nami' : lang === 'hi' ? 'आप' : 'You'}</span>}
          {c.text}
        </motion.div>
      ))}
    </div>
  );
}

function NoteShell({ children, tone = 'paper', tilt = '-0.6deg' }: { children: React.ReactNode; tone?: 'paper' | 'yellow'; tilt?: string }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      className={cx('pp-note pp-tape pp-tape-l relative mt-2 shrink-0 rounded-md p-4 sm:p-5', tone === 'yellow' && 'pp-yellow')}
      style={{ ['--tilt' as string]: tilt }}
    >
      {children}
    </motion.div>
  );
}

function ApprovalCard({ p, lang, t, onAnswer }: { p: Snap['pending'][number]; lang: string; t: App['t']; onAnswer: (yes: boolean) => void }) {
  const icon = p.kind === 'approve_slot' || p.kind === 'permit_clinic_call' ? <Stethoscope className="h-6 w-6" /> : <Users className="h-6 w-6" />;
  return (
    <NoteShell tilt="0.4deg">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sea-200 text-teal-900">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[19px] font-semibold text-teal-900">{p.kind === 'approve_slot' ? 'Approve this slot?' : p.kind === 'permit_clinic_call' ? 'May Nami call the clinic?' : p.kind === 'send_memory' ? 'Send this story?' : 'Shall I go ahead?'}</p>
          <p className="mt-1 text-[18px] leading-snug text-ink-900">{lang === 'hi' ? p.readbackHi : p.readback}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => onAnswer(true)} className="flex min-h-14 items-center gap-2 rounded-full bg-teal-900 px-6 text-lg font-semibold text-ivory-50 hover:bg-teal-700">
              <Check className="h-5 w-5" /> {t.yesConfirm}
            </button>
            <button onClick={() => onAnswer(false)} className="flex min-h-14 items-center gap-2 rounded-full border-2 border-[#d9cbb2] bg-[#fffdf8] px-6 text-lg font-semibold text-ink-900 hover:bg-ivory-100">
              <X className="h-5 w-5" /> {t.no}
            </button>
          </div>
          <p className="mt-2 text-sm text-ink-600">Nothing happens until you say yes or press Yes.</p>
        </div>
      </div>
    </NoteShell>
  );
}

function ReminderCard({ o, lang, t, app }: { o: Snap['occurrences'][number]; lang: string; t: App['t']; app: App }) {
  const r = (response: string, extra: Record<string, unknown> = {}) => app.command({ type: 'reminder.respond', occurrenceId: o.id, response, source: 'button', ...extra });
  return (
    <NoteShell tone="yellow">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fffaf0] text-[#8a5a12]">
          <BellRing className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-hand text-[17px] text-[#8a5a12]">{lang === 'hi' ? `${o.time} बजे की याद` : `Reminder for ${o.time}`}</p>
          <p className="text-[21px] font-semibold leading-snug text-ink-900">{lang === 'hi' ? o.labelHi : o.label}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => r(o.kind === 'medication' ? 'taken' : 'done')} className="flex min-h-14 items-center gap-2 rounded-full bg-teal-900 px-5 text-lg font-semibold text-ivory-50 hover:bg-teal-700">
              <Check className="h-5 w-5" /> {o.kind === 'medication' ? t.taken : lang === 'hi' ? 'हो गया' : 'Done'}
            </button>
            {o.kind === 'medication' && <button onClick={() => r('not_taken')} className="min-h-14 rounded-full border-2 border-[#d9b860] bg-[#fffaf0] px-5 text-lg font-semibold">{t.notTaken}</button>}
            <button onClick={() => r('snooze', { snoozeMinutes: 15 })} className="min-h-14 rounded-full border-2 border-[#d9b860] bg-[#fffaf0] px-5 text-lg font-semibold">{t.later}</button>
          </div>
          <p className="mt-2 text-sm text-ink-600">Nami records what you say. She cannot check whether a medicine was taken.</p>
        </div>
      </div>
    </NoteShell>
  );
}

function CheckinCard({ t, app }: { t: App['t']; app: App }) {
  return (
    <NoteShell tilt="-0.4deg">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sea-200 text-teal-900">
          <HeartHandshake className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-hand text-[17px] text-cocoa-500">{app.lang === 'hi' ? 'रोज़ का हाल-चाल' : 'Daily check-in'}</p>
          <p className="text-[21px] font-semibold leading-snug">{app.lang === 'hi' ? 'नमस्ते! आज का चेक-इन, बस बता दीजिए आप यहाँ हैं।' : "Good morning! Just let me know you're here."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => app.command({ type: 'checkin.respond', source: 'button' })} className="flex min-h-14 items-center gap-2 rounded-full bg-teal-900 px-6 text-lg font-semibold text-ivory-50 hover:bg-teal-700">
              <Check className="h-5 w-5" /> {t.imHere}
            </button>
            <button onClick={() => app.command({ type: 'help.open', kind: 'explicit_help', source: 'button' })} className="min-h-14 rounded-full border-2 border-help-600/60 bg-[#fffdf8] px-5 text-lg font-semibold text-help-600">
              {t.needHelp}
            </button>
          </div>
        </div>
      </div>
    </NoteShell>
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
  const where =
    c.state === 'owner_accepted' ? `${name(c.ownerContactId)} is following up` : c.state === 'unresolved' ? 'nobody has accepted yet' : c.state === 'phone_fallback' ? 'trying your phone' : c.state === 'escalating' ? 'asking your family' : c.state.replace(/_/g, ' ');
  const showMistake = help && c.state === 'escalating' && d.now - c.openedAt < 60_000;
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className={cx('overflow-hidden text-white shadow-[0_8px_24px_rgba(70,45,20,.18)]', help ? 'bg-help-600' : c.state === 'owner_accepted' ? 'bg-teal-700' : 'bg-[#8a5a1c]')}
      role="status"
      aria-live="assertive"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
          <LifeBuoy className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-[14rem]">
          <p className="text-[17px] font-bold">
            {help ? 'You asked for help' : 'Your check-in was missed'}, {where}
          </p>
          <p className="text-[15px] text-white/90">{line}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 [&>*]:justify-center sm:[&>*]:flex-none">
          {showMistake && (
            <button onClick={() => app.command({ type: 'help.mistake', caseId: c.id, source: 'button' })} className="min-h-12 rounded-full bg-white/15 px-4 font-semibold ring-1 ring-white/40 hover:bg-white/25">
              {app.t.mistake}
            </button>
          )}
          {!help && c.state !== 'owner_accepted' && (
            <button onClick={() => app.command({ type: 'checkin.respond', source: 'button' })} className="flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-semibold text-teal-900">
              <Check className="h-5 w-5" aria-hidden /> {app.t.imHere}
            </button>
          )}
          <a href="tel:112" className="flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-bold text-help-600">
            <Phone className="h-4 w-4" aria-hidden />
            <span className="sm:hidden">{app.lang === 'hi' ? '112 पर कॉल' : 'Call 112'}</span>
            <span className="hidden sm:inline">{app.t.emergency}</span>
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function Controls({ app }: { app: App }) {
  const { t } = app;
  const on = app.voice !== 'off' && app.voice !== 'error';
  const wake = useWakeWord({ voiceOn: on, start: () => void app.startVoice() });
  const soft = 'pp-card flex min-h-[68px] items-center justify-center gap-2.5 rounded-2xl text-[19px] font-semibold text-teal-900 ring-1 ring-[#e3d5bd] transition hover:-translate-y-0.5 hover:bg-[#fffdf8]';
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => (on ? app.stopVoice() : app.startVoice())}
          className={cx(
            'flex min-h-[68px] items-center justify-center gap-3 rounded-2xl text-[20px] font-semibold shadow-[0_12px_26px_rgba(23,61,56,.25)] transition hover:-translate-y-0.5',
            on ? 'bg-sea-500 text-teal-900' : 'bg-teal-900 text-ivory-50 hover:bg-teal-700',
          )}
        >
          <Mic className="h-6 w-6" aria-hidden /> {on ? t.stopTalking : t.talk}
        </button>
        <button onClick={() => document.getElementById('my-day')?.scrollIntoView({ behavior: 'smooth' })} className={soft}>
          <CalendarDays className="h-6 w-6" aria-hidden /> {t.myDay}
        </button>
        <button onClick={() => app.command({ type: 'family.propose', contact: 'primary', reason: 'chat' })} className={soft}>
          <Users className="h-6 w-6" aria-hidden /> {t.callFamily}
        </button>
        <button
          onClick={() => app.command({ type: 'help.open', kind: 'explicit_help', source: 'button' })}
          className="flex min-h-[68px] items-center justify-center gap-2.5 rounded-2xl bg-help-600 text-[20px] font-bold text-white shadow-[0_12px_26px_rgba(184,70,59,.3)] transition hover:-translate-y-0.5 hover:bg-[#a03c33]"
        >
          <LifeBuoy className="h-6 w-6" aria-hidden /> {t.getHelp}
        </button>
      </div>
      {app.voiceError && (
        <p className="rounded-xl bg-[#fbe9a6]/70 px-4 py-2 text-[15px] text-[#6d4a12]">
          {app.voiceError === 'voice_not_configured' ? 'Live voice is not configured on this server yet. Type to Nami below; she will answer aloud.' : app.voiceError === 'rate_limited' || app.voiceError === 'daily_cap' ? 'Voice demo limit reached for now, type to Nami below.' : `Voice unavailable (${app.voiceError}), type to Nami below.`}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {wake.status !== 'unavailable' ? (
          <button
            onClick={wake.toggle}
            aria-pressed={wake.status !== 'off'}
            className={cx('flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold ring-1', wake.status === 'listening' || wake.status === 'heard' ? 'bg-[#e7f1ec] text-teal-900 ring-sea-500/50' : 'bg-[#fffaf0] text-teal-900 ring-[#e3d5bd] hover:bg-[#fffdf8]')}
          >
            <span className={cx('h-2.5 w-2.5 rounded-full', wake.status === 'listening' ? 'animate-pulse bg-sea-500' : wake.status === 'error' ? 'bg-help-600' : 'bg-cocoa-300')} aria-hidden />
            {wake.status === 'off'
              ? app.lang === 'hi' ? '“Hey Nami” सुनना चालू करें' : 'Turn on “Hey Nami”'
              : wake.status === 'loading'
                ? app.lang === 'hi' ? 'तैयार हो रही हूँ…' : 'Getting ready…'
                : wake.status === 'error'
                  ? app.lang === 'hi' ? 'माइक नहीं मिला · फिर कोशिश करें' : 'No microphone · tap to retry'
                  : wake.status === 'paused'
                    ? app.lang === 'hi' ? 'बात चल रही है' : 'In a conversation'
                    : wake.status === 'heard'
                      ? app.lang === 'hi' ? 'सुन लिया! बोलिए…' : 'Heard you! Go ahead…'
                      : wake.status === 'tap'
                        ? app.lang === 'hi' ? 'सुनना शुरू करने के लिए कहीं भी छुएँ' : 'Tap anywhere to start listening'
                        : app.lang === 'hi' ? 'बोलिए “Hey Nami” · यहीं फ़ोन पर सुनती हूँ' : 'Say “Hey Nami” · listening on this device only'}
          </button>
        ) : (
          <span />
        )}
        <button onClick={app.toggleMute} aria-pressed={app.muted} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-ink-600 hover:bg-[#fffaf0] hover:text-teal-900">
          {app.muted ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />} {app.muted ? t.unmute : t.mute}
          <span className="hidden text-[13px] font-normal text-ink-600/80 lg:inline">· keys: Space talk, H help, M mute</span>
        </button>
      </div>
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
      className="pp-card rounded-2xl p-2.5 ring-1 ring-[#e3d5bd] focus-within:ring-2 focus-within:ring-teal-700/70"
    >
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="composer">{app.t.typeHere}</label>
        <input id="composer" value={v} onChange={(e) => setV(e.target.value)} placeholder={app.t.typeHere} className="pp-bare min-h-12 min-w-0 flex-1 rounded-xl bg-transparent px-3 text-[19px] placeholder:text-ink-600/70" />
        <button disabled={!v.trim() || app.busy} className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-teal-900 px-5 text-[17px] font-semibold text-ivory-50 hover:bg-teal-700 disabled:opacity-40">
          <Send className="h-4 w-4" aria-hidden /> {app.t.send}
        </button>
      </div>
      <div className="pp-noscroll mt-1.5 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
        <span className="font-hand shrink-0 text-[16px] text-cocoa-500">{app.lang === 'hi' ? 'या छूइए:' : 'or tap one:'}</span>
        {examples.map((x) => (
          <button type="button" key={x} onClick={() => void app.sendText(x)} className="min-h-10 shrink-0 rounded-full bg-[#f3e9d6] px-3.5 text-[15px] text-ink-900 hover:bg-sea-200">
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
  const date = new Date(d.clock.date + 'T12:00:00Z').toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return (
    <section id="my-day" aria-labelledby="my-day-title" className="pp-note pp-tape relative scroll-mt-28 rounded-md px-5 pt-6 pb-4" style={{ ['--tilt' as string]: '-0.8deg' }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="my-day-title" className="font-display text-[26px] font-semibold text-teal-900">
          {lang === 'hi' ? 'आज का दिन' : 'My day'}
        </h2>
        <p className="font-hand text-[16px] text-cocoa-500">{date}</p>
      </div>
      <ul className="mt-2">
        {d.occurrences.map((o) => {
          const now = o.state === 'awaiting_response';
          const good = o.outcome === 'taken_reported' || o.outcome === 'done_reported';
          return (
            <li key={o.id} className={cx('-mx-2 flex items-start gap-3 rounded-lg border-b border-dashed border-[#e3d5bd] px-2 py-3 last:border-b-0', now && 'bg-[#fbe9a6]/60')}>
              <span className="w-[3.2rem] shrink-0 pt-px font-display text-[18px] font-semibold tabular-nums text-teal-900">{o.time}</span>
              <span className="min-w-0 flex-1">
                <span className={cx('block text-[18px] leading-snug', o.state === 'resolved' && !now ? 'text-ink-600' : 'text-ink-900')}>{lang === 'hi' ? o.labelHi : o.label}</span>
                <span className={cx('font-hand mt-0.5 inline-flex items-center gap-1 text-[16px]', now ? 'font-bold text-[#8a5a12]' : good ? 'text-ok-600' : o.outcome ? 'text-cocoa-500' : 'text-ink-600/80')}>
                  {good && <Check className="h-4 w-4" aria-hidden />}
                  {now ? (lang === 'hi' ? 'अभी' : 'Now') : o.outcome ? ((lang === 'hi' ? OUTCOME_HI[o.outcome] : OUTCOME[o.outcome]) ?? o.outcome) : lang === 'hi' ? 'बाद में' : 'Later'}
                </span>
              </span>
            </li>
          );
        })}
        {!d.occurrences.length && <li className="py-3 text-[18px] text-ink-600">{lang === 'hi' ? 'आज और कुछ नहीं।' : 'Nothing else today.'}</li>}
      </ul>
    </section>
  );
}

const APT_STATE: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Waiting for your OK to call', tone: 'text-[#8a5a12]' },
  finding_availability: { label: 'Calling the clinic…', tone: 'text-[#8a5a12]' },
  awaiting_user_approval: { label: 'Slot found, needs your approval', tone: 'text-[#8a5a12]' },
  pending_clinic_confirmation: { label: 'Confirming with clinic, not booked yet', tone: 'text-[#8a5a12]' },
  confirmed: { label: 'Confirmed by the clinic', tone: 'text-ok-600' },
  failed_needs_help: { label: 'Not booked', tone: 'text-bad-600' },
  cancelled: { label: 'Cancelled', tone: 'text-ink-600' },
};

function Appointments({ d }: { d: Snap }) {
  const list = [...d.appointments].reverse();
  if (!list.length) return null;
  return (
    <section className="pp-note pp-blue relative rounded-md p-5" style={{ ['--tilt' as string]: '0.5deg' }}>
      <h2 className="flex items-center gap-2 font-display text-[22px] font-semibold text-teal-900">
        <Stethoscope className="h-5 w-5" aria-hidden /> Appointments
      </h2>
      <ul className="mt-3 space-y-3">
        {list.map((a) => {
          const st = APT_STATE[a.state] ?? { label: a.state, tone: '' };
          return (
            <li key={a.id} className="rounded-xl bg-[#fffaf0] p-3.5">
              <p className={cx('text-[17px] font-semibold', st.tone)}>{st.label}</p>
              {a.offeredSlot && <p className="text-[17px] text-ink-900">{new Date(a.offeredSlot.startAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</p>}
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
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length]);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative shrink-0 rounded-2xl bg-teal-900 p-4 text-ivory-50 shadow-[0_12px_28px_rgba(23,61,56,.3)]">
      <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold">
        <PhoneCall className="h-4 w-4 animate-pulse" aria-hidden />
        {call.purpose.startsWith('clinic') ? 'Nami is on the phone with the clinic' : 'Nami is calling'}
        <span className="rounded-full bg-white/12 px-2 py-0.5 text-[13px] font-medium text-sea-200">{call.adapter === 'sim' ? 'Simulated clinic (demo)' : 'Real phone call'}</span>
        <span className="text-[13px] font-medium text-white/70">{String(call.state).replace('_', ' ')}</span>
      </p>
      <div ref={box} className="pp-scroll max-h-44 space-y-1.5 overflow-y-auto text-[16px]">
        {turns.map((x, i) => (
          <p key={i} className={x.speaker === 'nami' ? 'text-sea-200' : x.speaker === 'system' ? 'italic text-white/60' : 'text-white'}>
            <span className="mr-2 text-[13px] font-semibold opacity-75">{x.speaker === 'nami' ? 'Nami' : x.speaker === 'clinic' ? 'Clinic' : x.speaker}</span>
            {x.text}
          </p>
        ))}
        {!turns.length && <p className="text-white/70">Ringing…</p>}
      </div>
    </motion.div>
  );
}

const CAT: Record<string, string> = { agent: 'bg-sea-200 text-teal-900', state: 'bg-[#efe6d4] text-ink-600', external: 'bg-[#fbe9a6] text-[#6d4a12]', human: 'bg-[#e3f1ea] text-ok-600' };

function ActivityFeed({ d, t }: { d: Snap; t: App['t'] }) {
  const ev = d.events.slice(0, 12);
  return (
    <section className="pp-card relative rounded-2xl p-5 ring-1 ring-[#e3d5bd] md:col-span-2 lg:col-span-1">
      <h2 className="flex items-center gap-2 font-display text-[22px] font-semibold text-teal-900">
        <Activity className="h-5 w-5" aria-hidden /> {t.activity}
      </h2>
      <p className="font-hand text-[15px] text-cocoa-500">every step, as it happens</p>
      <ol className="mt-3 space-y-2.5">
        {ev.map((e) => (
          <li key={String(e.id)} className="flex gap-2.5 text-[15px] leading-snug">
            <span className="w-11 shrink-0 tabular-nums text-ink-600">{new Date(e.at_virtual as string).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            <span className="min-w-0 flex-1">
              <span className={cx('mr-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold', CAT[e.category as string])}>{String(e.actor).startsWith('contact:') ? 'family' : (e.actor as string)}</span>
              {e.summary as string}
            </span>
          </li>
        ))}
        {!ev.length && <li className="text-ink-600">Nothing yet today.</li>}
      </ol>
    </section>
  );
}

function JudgesPanel({ d, app, onClose }: { d: Snap; app: App; onClose: () => void }) {
  const arjun = d.contacts.find((c) => c.priority === 1);
  const clinic = d.clinics[0];
  const [skipping, setSkipping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const h3 = 'text-[16px] font-semibold text-teal-900';
  return (
    <motion.div
      ref={ref}
      id="judges-panel"
      role="region"
      aria-label="For judges"
      tabIndex={-1}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="fixed inset-x-2 bottom-2 z-40 max-h-[80dvh] overflow-y-auto rounded-[22px] border-2 border-dashed border-cocoa-300 bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(70,45,20,.3)] outline-none sm:inset-x-auto sm:right-4 sm:bottom-auto sm:top-[76px] sm:w-[380px] sm:max-h-[calc(100dvh-96px)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[24px] font-semibold text-teal-900">For judges</h2>
          <p className="font-hand text-[16px] text-cocoa-500">demo helpers, not part of Meera&rsquo;s screen</p>
        </div>
        <button onClick={onClose} aria-label="Close the judges panel" className="grid size-11 shrink-0 place-items-center rounded-full text-ink-600 hover:bg-ivory-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <PhoneCard app={app} />

      <div className="mt-4 rounded-2xl bg-[#fbe9a6]/55 p-4">
        <h3 className={h3}>Move the demo clock</h3>
        <p className="mt-0.5 text-[14px] text-ink-600">
          It&rsquo;s {app.lang === 'hi' ? d.clock.spokenHi : d.clock.spokenEn}. Each skip jumps to the next reminder or check-in. Miss the 10:00 check-in to see family follow-up.
        </p>
        <button
          disabled={skipping}
          onClick={async () => {
            setSkipping(true);
            try {
              await post('/api/demo/skip');
              await app.mutate();
            } finally {
              setSkipping(false);
            }
          }}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-warn-600 px-4 text-[17px] font-semibold text-white hover:bg-[#9c6619] disabled:opacity-60"
        >
          <FastForward className="h-5 w-5" aria-hidden /> {app.t.skip}
        </button>
      </div>

      {arjun && (
        <div className="mt-4 flex items-center gap-4">
          <a href={arjun.careUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-white p-2 ring-1 ring-[#e3d5bd]" aria-label={`Open ${arjun.name}'s caregiver page in a new tab`}>
            <QRCodeSVG value={arjun.careUrl} size={100} fgColor="#173D38" />
          </a>
          <div className="text-[14px] text-ink-600">
            <h3 className={h3}>Be {arjun.name}, her son</h3>
            <p className="mt-0.5">Scan with your phone to open his caregiver page. When a check-in is missed, he&rsquo;s asked to follow up there.</p>
            <a href={arjun.careUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-teal-700 underline underline-offset-2">
              Open it here <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-dashed border-[#e3d5bd] pt-4">
        <h3 className={h3}>Try a clinic booking</h3>
        <button
          onClick={() => {
            const d0 = new Date(d.clock.date + 'T00:00:00Z');
            const iso = (n: number) => new Date(d0.getTime() + n * 86400000).toISOString().slice(0, 10);
            void app.command({ type: 'appointment.propose', clinicId: clinic?.id ?? 'cl_mehta', dateFrom: iso(2), dateTo: iso(6), window: 'morning', reason: 'follow_up' });
          }}
          className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-[15px] font-semibold text-teal-900 ring-1 ring-[#e3d5bd] hover:bg-ivory-100"
        >
          <Stethoscope className="h-4 w-4 shrink-0" aria-hidden /> Try: “Book {clinic?.doctor ?? 'the doctor'}, a morning next week”
        </button>
        <label className="mt-3 block text-[14px] font-semibold text-ink-900" htmlFor="scenario">
          Simulated clinic behaviour
        </label>
        <select
          id="scenario"
          defaultValue={clinic?.scenario}
          onChange={async (e) => {
            await post('/api/demo/scenario', { scenario: e.target.value });
            await app.mutate();
          }}
          className="mt-1 min-h-11 w-full rounded-xl border border-[#e3d5bd] bg-white px-3 text-[15px]"
        >
          <option value="cooperative">Cooperative receptionist</option>
          <option value="busy_then_cooperative">Busy, then helpful</option>
          <option value="evening_only">Only evening slots (verifier should reject a morning request)</option>
          <option value="asks_for_extra_info">Asks for phone/DOB (Nami must refuse)</option>
          <option value="no_slots">Fully booked</option>
          <option value="voicemail">Goes to voicemail</option>
        </select>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[#e3d5bd] pt-4 text-[14px]">
        <Link href="/console" className="inline-flex items-center gap-1 font-semibold text-teal-700 underline underline-offset-2">
          Open the agent console
        </Link>
        <button
          onClick={async () => {
            await post('/api/demo/reset');
            window.location.reload();
          }}
          className="flex min-h-10 items-center gap-2 rounded-full px-2 font-semibold text-ink-600 hover:text-ink-900"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset demo household
        </button>
      </div>
      <p className="mt-2 text-[13px] text-ink-600">Keys: Space talk · H help · M mute · D my day</p>
    </motion.div>
  );
}

function MemoryCorner({ d, app }: { d: Snap; app: App }) {
  const mp = [...(d.memoryPrompts ?? [])].reverse()[0];
  if (!mp) return null;
  const hi = app.lang === 'hi';
  return (
    <section aria-label={hi ? 'यादों का कोना' : 'Memory Corner'} className="flex flex-col gap-3 px-1">
      <figure className="pp-note pp-tape relative rounded-[3px] bg-white p-3 pb-4" style={{ ['--tilt' as string]: '1.4deg', ['--tape' as string]: '-3deg' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mp.photoPath} alt={mp.caption} className="aspect-[48/34] w-full rounded-[2px] object-cover" />
        <figcaption className="mt-3 px-1">
          <p className="font-hand text-[19px] leading-snug text-ink-900">“{mp.caption}”</p>
          <p className="font-hand mt-0.5 text-[15px] text-cocoa-500">{hi ? `${mp.fromName} ने भेजी ♥` : `from ${mp.fromName} ♥`}</p>
        </figcaption>
      </figure>
      {mp.state === 'new' && (
        <button onClick={() => app.startStory(mp)} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-cocoa-500 px-4 text-[18px] font-semibold text-white shadow-[0_10px_24px_rgba(140,80,50,.25)] hover:bg-[#74503a]">
          <HeartHandshake className="h-5 w-5" aria-hidden /> {hi ? 'नामी को कहानी सुनाइए' : 'Tell Nami the story'}
        </button>
      )}
      {mp.state === 'story_drafted' && <p className="text-[15px] font-semibold text-[#8a5a12]">{hi ? 'कहानी तैयार है, भेजने से पहले आपकी अनुमति चाहिए।' : 'Story drafted, waiting for your OK before sending.'}</p>}
      {mp.state === 'sent' && <p className="text-[15px] font-semibold text-ok-600">✓ {hi ? `${mp.fromName} को भेज दी गई` : `Sent to ${mp.fromName}`}</p>}
      {mp.state === 'kept_private' && <p className="text-[15px] text-ink-600">{hi ? 'निजी रखी गई' : 'Kept private'}</p>}
      <p className="text-[14px] text-ink-600">{hi ? 'नामी कुछ भी आपकी हाँ के बिना नहीं भेजती।' : 'Nothing is sent without your yes. Nami never imitates family voices.'}</p>
    </section>
  );
}

/** The demo clock's own skip button, so judges can move time without opening the panel. */
function SkipChip({ app }: { app: App }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await post('/api/demo/skip');
          await app.mutate();
        } finally {
          setBusy(false);
        }
      }}
      title={app.t.skip}
      aria-label={app.t.skip}
      className="-my-1 -mr-1 ml-0.5 hidden items-center gap-1 rounded-full bg-warn-600 px-2.5 py-1 text-[13px] font-semibold text-white hover:bg-[#9c6619] disabled:opacity-60 sm:inline-flex"
    >
      <FastForward className="h-4 w-4" aria-hidden />
      <span className="hidden lg:inline">{app.t.skip}</span>
    </button>
  );
}

/** A judge plays the elder: Nami phones their own number and they just talk. */
function PhoneCard({ app }: { app: App }) {
  const [to, setTo] = useState('');
  const [lang, setLang] = useState<'en' | 'hi'>(app.lang === 'hi' ? 'hi' : 'en');
  const [mine, setMine] = useState(false);
  const [state, setState] = useState<{ kind: 'idle' | 'calling' | 'placed' | 'error'; msg?: string }>({ kind: 'idle' });
  const call = async () => {
    setState({ kind: 'calling' });
    const r = await post('/api/phone', { to, lang, mine: true });
    if (r?.ok) setState({ kind: 'placed' });
    else setState({ kind: 'error', msg: r?.error ?? 'Something went wrong. Please try again.' });
  };
  return (
    <div className="mt-4 rounded-2xl bg-[#e7f1ec] p-4">
      <h3 className="flex items-center gap-2 text-[16px] font-semibold text-teal-900">
        <PhoneCall className="h-4 w-4" aria-hidden /> Talk to Nami on your phone
      </h3>
      <p className="mt-0.5 text-[14px] text-ink-600">Be Meera ji for a few minutes. Nami calls you; ask about your day, say you took your tablet, or ask her to book Dr. Mehta. It all shows up on this screen.</p>
      {state.kind === 'placed' ? (
        <p className="mt-3 rounded-xl bg-white/80 p-3 text-[15px] font-semibold text-teal-900" role="status">
          Calling you now. Pick up and talk to Nami. The call ends by itself after 3 minutes.
        </p>
      ) : (
        <form
          className="mt-3 space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (mine && to.trim()) void call();
          }}
        >
          <label className="block text-[13px] font-semibold text-ink-900" htmlFor="judge-phone">
            Your mobile number
          </label>
          <div className="flex gap-2">
            <input
              id="judge-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="98765 43210 or +1 …"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-[#e3d5bd] bg-white px-3 text-[16px] text-ink-900 outline-none focus:border-teal-700"
            />
            <select aria-label="Language for the call" value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'hi')} className="min-h-12 rounded-xl border border-[#e3d5bd] bg-white px-2 text-[15px]">
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-[13.5px] text-ink-600">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="mt-0.5 size-4 accent-teal-900" />
            This is my own phone, and Nami may call it once for this demo. Indian and US numbers only.
          </label>
          <button
            type="submit"
            disabled={!mine || !to.trim() || state.kind === 'calling'}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-teal-900 px-4 text-[17px] font-semibold text-ivory-50 hover:bg-teal-700 disabled:opacity-50"
          >
            <Phone className="h-5 w-5" aria-hidden /> {state.kind === 'calling' ? 'Placing the call…' : 'Call me now'}
          </button>
          {state.kind === 'error' && (
            <p className="text-[14px] font-semibold text-help-600" role="alert">
              {state.msg}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

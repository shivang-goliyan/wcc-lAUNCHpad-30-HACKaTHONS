'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  Activity,
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  CircleCheck,
  ClipboardList,
  ExternalLink,
  FastForward,
  HeartHandshake,
  LifeBuoy,
  Mic,
  Phone,
  PhoneCall,
  RotateCcw,
  Send,
  ShieldCheck,
  Stethoscope,
  Users,
  Volume2,
  VolumeX,
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

type Case = Snap['cases'][number];
type Apt = Snap['appointments'][number];

// a check-in has reached the family once it is in one of these
const FAMILY = ['escalating', 'owner_accepted', 'unresolved'];
const DONE_CASE = ['resolved_user_responded', 'resolved_human_reported', 'cancelled_mistake'];

const hhmm = (ms: number, tz: string) => new Date(ms).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });

const familyAsked = (s: Snap) => s.cases.some((c) => c.type === 'checkin' && FAMILY.includes(c.state));

function pronoun(relation: string | undefined) {
  const r = (relation ?? '').toLowerCase();
  if (/\b(son|brother|husband|father|nephew|grandson|uncle)\b/.test(r)) return 'He';
  if (/\b(daughter|sister|wife|mother|niece|granddaughter|aunt)\b/.test(r)) return 'She';
  return 'They';
}

function shortLabel(s: string) {
  const x = s.split('(')[0].trim();
  return x.length > 22 ? x.slice(0, 21).trimEnd() + '…' : x;
}

/** What the next skip of the demo clock will land on, worked out from the snapshot. */
function nextUp(d: Snap, hi: boolean): { time: string; what: string } | null {
  const at = d.clock.nextWakeAt;
  if (!at) return null;
  const tz = d.recipient.timezone;
  const time = hhmm(at, tz);
  const chk = d.cases.find((c) => c.type === 'checkin' && !DONE_CASE.includes(c.state) && c.timerAt === at);
  if (chk) {
    if (chk.state === 'awaiting_response' || chk.state === 'retrying_page')
      return { time, what: chk.pageRetriesUsed < d.policy.pageRetries ? (hi ? 'फिर पूछेगी' : 'asks again') : hi ? 'चेक-इन छूटेगा' : 'missed check-in' };
    if (chk.state === 'phone_fallback') return { time, what: hi ? 'परिवार से पूछेगी' : 'family is asked' };
  }
  if (d.cases.some((c) => c.attempts.some((a) => a.state === 'active' && a.contactId && a.timeoutAt === at))) return { time, what: hi ? 'अगले व्यक्ति से' : 'next family member' };
  const occ = d.occurrences.find((o) => o.state === 'scheduled' && o.notifyAt === at);
  if (occ) return { time, what: shortLabel(hi ? occ.labelHi || occ.label : occ.label) };
  if (d.policy.times.includes(time)) return { time, what: hi ? 'चेक-इन' : 'check-in' };
  return { time, what: '' };
}

function useSkip(app: App) {
  const [busy, setBusy] = useState(false);
  const skip = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await post('/api/demo/skip');
      await app.mutate();
    } finally {
      setBusy(false);
    }
  };
  return { busy, skip };
}

function skipLabel(d: Snap, app: App) {
  const hi = app.lang === 'hi';
  const n = nextUp(d, hi);
  if (!n) return app.t.skip;
  if (hi) return n.what ? `${n.time} पर जाएँ · ${n.what}` : `${n.time} पर जाएँ`;
  return n.what ? `Skip to ${n.time} · ${n.what}` : `Skip to ${n.time}`;
}

export default function AppScreen() {
  const app = useNamiApp();
  const { data, error, t, lang } = app;
  const hi = lang === 'hi';
  const [pose, setPose] = useState<PoseName>('greeting');
  const [look, setLook] = useState<{ x: number; y: number } | null>(null);
  const [judges, setJudges] = useState(false);
  const [focusArjun, setFocusArjun] = useState(0);
  const [jumping, setJumping] = useState(false);
  const [seenBooked, setSeenBooked] = useState<string[]>([]);
  const voiceOn = app.voice !== 'off' && app.voice !== 'error';
  // lives here, not in the judges panel, so "Hey Nami" keeps listening when the panel is closed
  const wake = useWakeWord({ voiceOn, start: () => void app.startVoice() });
  // header + guide + help banner height, so the talk column can fill exactly what's left of the screen
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
      if (e.key === 'Escape') {
        setFocusArjun(0);
        return setJudges(false);
      }
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

  // demo guide ②: skip the clock until the family is being asked, then show the judge Arjun's side
  const jumpToFamily = async () => {
    if (jumping) return;
    setJumping(true);
    try {
      for (let i = 0; i < 8; i++) {
        const cur = await app.mutate();
        if (cur?.ok && familyAsked(cur)) break;
        await post('/api/demo/skip');
      }
      await app.mutate();
    } finally {
      setJumping(false);
    }
    setJudges(true);
    setFocusArjun((n) => n + 1);
  };

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
            {hi ? 'दिन तैयार हो रहा है…' : 'Getting the day ready…'}
          </p>
        </div>
      </main>
    );
  }
  const d = data as Snap;
  const { openHelp, openCheckin, activeCall, dueReminder } = app.derived;
  const escalation = openHelp ?? (openCheckin && ['escalating', 'owner_accepted', 'unresolved', 'phone_fallback'].includes(openCheckin.state) ? openCheckin : null);
  const checkinWaiting = !!(openCheckin && ['awaiting_response', 'retrying_page'].includes(openCheckin.state));
  const hasCard = d.pending.length > 0 || !!dueReminder || checkinWaiting;
  const booked = [...d.appointments].reverse().find((a) => a.state === 'confirmed');
  const showBooked = !!booked && !hasCard && !activeCall && !escalation && !seenBooked.includes(booked.id) && d.now - (booked.confirmedAt ?? 0) < 90 * 60_000;
  const statusText =
    app.voice === 'connecting'
      ? t.connecting
      : app.voice === 'listening'
        ? t.listening
        : app.voice === 'thinking'
          ? t.thinking
          : app.voice === 'speaking'
            ? t.speaking
            : d.pending.length
              ? hi
                ? 'आपकी हाँ का इंतज़ार है'
                : 'Waiting for your yes'
              : activeCall
                ? hi
                  ? 'आपके लिए फ़ोन पर हूँ…'
                  : 'On a call for you…'
                : checkinWaiting
                  ? hi
                    ? 'चेक-इन: “मैं यहाँ हूँ” दबाइए'
                    : 'Check-in: tap I’m here'
                  : t.idle;
  const showGreeting = !app.captions.some((c) => c.text.trim()) && !hasCard && !activeCall && !escalation && !showBooked;

  return (
    <div
      className="pp-paper flex min-h-screen flex-1 flex-col text-ink-900"
      onPointerMove={(e) => setLook({ x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 })}
      style={{ fontSize: `${(d.recipient.prefs.textScale ?? 1) * 100}%`, ['--top' as string]: `${topH}px` }}
    >
      <div ref={topRef} className="z-30 lg:sticky lg:top-0">
        <Header
          app={app}
          d={d}
          judges={judges}
          onJudges={() => {
            setJudges((v) => !v);
            setFocusArjun(0);
          }}
        />
        <GuideBar d={d} app={app} jumping={jumping} onMiss={jumpToFamily} onCall={() => setJudges(true)} />
        <AnimatePresence>{escalation && <HelpBanner d={d} c={escalation} app={app} />}</AnimatePresence>
      </div>

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-6 px-4 pt-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:px-8 lg:pt-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label={hi ? 'नामी से बात' : 'Talk with Nami'} className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-[calc(var(--top)+20px)] lg:h-[calc(100dvh-var(--top)-40px)] lg:min-h-[560px] lg:self-start">
          {/* Nami at Meera's breakfast table */}
          <div className="relative flex flex-col overflow-hidden rounded-[28px] bg-[#f6efe2] shadow-[0_18px_44px_rgba(70,45,20,.16)] ring-1 ring-[#e3d5bd] md:min-h-[460px] lg:min-h-0 lg:flex-1">
            <div className="relative h-[170px] shrink-0 sm:h-[240px] md:absolute md:inset-0 md:h-auto">
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
              <div className={cx('absolute right-1 bottom-0 w-[150px] transition-[width] duration-500 sm:w-[200px] md:right-2', hasCard ? 'md:w-[min(24%,230px)]' : 'md:w-[min(34%,300px)]')}>
                <NamiImage pose={effectivePose} mouth={app.mouth} lookAt={look} reducedMotion={d.recipient.prefs.reducedMotion} title={`Nami, ${statusText}`} className="h-auto w-full drop-shadow-[0_18px_22px_rgba(70,45,20,.28)]" />
              </div>
            </div>

            <div className={cx('pp-scroll relative flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 transition-[width] duration-500 sm:px-6 sm:pb-6 md:pt-6 lg:overflow-y-auto', hasCard ? 'md:w-[78%]' : 'md:w-[64%] lg:w-[62%]')}>
              <div className="relative z-10 -mt-12 flex shrink-0 flex-wrap items-center gap-2 md:mt-0">
                <span aria-live="polite" className="inline-flex items-center gap-2 rounded-full bg-[#fffaf0] px-3.5 py-2 text-[16px] font-semibold text-teal-900 shadow-[0_4px_14px_rgba(70,45,20,.12)] ring-1 ring-[#e3d5bd]">
                  <span className={cx('h-2.5 w-2.5 rounded-full', app.voice === 'listening' ? 'animate-pulse bg-ok-600' : app.voice === 'speaking' ? 'bg-sea-500' : activeCall ? 'animate-pulse bg-warn-600' : d.pending.length || checkinWaiting ? 'bg-warn-600' : 'bg-cocoa-300')} />
                  {statusText}
                </span>
                {(wake.status === 'listening' || wake.status === 'heard' || wake.status === 'tap') && (
                  <span className="rounded-full bg-[#e7f1ec] px-3 py-1.5 text-[14px] font-semibold text-teal-900 ring-1 ring-sea-500/40">{hi ? '“Hey Nami” चालू' : '“Hey Nami” is on'}</span>
                )}
                <button
                  onClick={app.toggleMute}
                  aria-pressed={app.muted}
                  aria-label={app.muted ? t.unmute : t.mute}
                  title={`${app.muted ? t.unmute : t.mute} (M)`}
                  className={cx('ml-auto grid size-11 place-items-center rounded-full shadow-[0_4px_14px_rgba(70,45,20,.12)] ring-1 transition', app.muted ? 'bg-ink-900 text-white ring-ink-900' : 'bg-[#fffaf0] text-teal-900 ring-[#e3d5bd] hover:bg-[#fffdf8]')}
                >
                  {app.muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
                </button>
              </div>
              {showGreeting ? (
                <div className="pp-note relative max-w-[30rem] self-start rounded-[22px] rounded-tl-md px-5 py-4">
                  <p className="font-hand text-[16px] text-cocoa-500">Nami</p>
                  <p className="mt-0.5 font-display text-[22px] leading-snug text-teal-900 sm:text-[24px]">
                    {hi ? `नमस्ते ${d.recipient.addressAs}! मैं नामी हूँ, एक AI साथी। बात करने के लिए "नामी से बात करें" दबाइए।` : `Namaste ${d.recipient.addressAs}! I'm Nami, an AI companion. Press “Talk to Nami” to start.`}
                  </p>
                </div>
              ) : (
                <Captions captions={app.captions} lang={lang} quiet={hasCard || !!activeCall || showBooked} hideWide={hasCard} />
              )}
              <AnimatePresence>
                {d.pending.map((p) => (
                  <ApprovalCard key={p.id} p={p} d={d} lang={lang} t={t} reveal={!jumping} onAnswer={(yes) => app.command({ type: yes ? 'pending.confirm' : 'pending.decline', pendingId: p.id, source: 'button' })} />
                ))}
                {dueReminder && <ReminderCard key={dueReminder.id} o={dueReminder} lang={lang} t={t} app={app} reveal={!jumping} />}
                {checkinWaiting && openCheckin && <CheckinCard key={openCheckin.id} c={openCheckin} d={d} t={t} app={app} reveal={!jumping} />}
                {showBooked && booked && <BookedCard key={`ok-${booked.id}`} a={booked} d={d} lang={lang} onDone={() => setSeenBooked((s) => [...s, booked.id])} />}
              </AnimatePresence>
              {activeCall && <CallTranscript call={activeCall} lang={lang} />}
            </div>
          </div>

          <Controls app={app} />
          <Composer app={app} />
          <p className="flex items-center gap-2 px-1 text-[15px] text-ink-600">
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700" aria-hidden /> {t.aiDisclosure}
          </p>
        </section>

        <aside className="grid min-w-0 content-start gap-6 pt-3 md:grid-cols-2 lg:grid-cols-1 lg:pt-1">
          <Appointments d={d} lang={lang} />
          <MyDay d={d} lang={lang} />
          <BehindTheScenes d={d} lang={lang} />
          <MemoryCorner d={d} app={app} />
        </aside>
      </main>

      <AnimatePresence>{judges && <JudgesPanel d={d} app={app} wake={wake} focusArjun={focusArjun} jumping={jumping} onMiss={jumpToFamily}
            onClose={() => {
              setJudges(false);
              setFocusArjun(0);
            }}
          />}</AnimatePresence>
    </div>
  );
}

type App = ReturnType<typeof useNamiApp>;
type Wake = ReturnType<typeof useWakeWord>;

function Header({ app, d, judges, onJudges }: { app: App; d: Snap; judges: boolean; onJudges: () => void }) {
  const { t, lang } = app;
  const hi = lang === 'hi';
  const first = d.recipient.firstName ?? d.recipient.addressAs;
  const { busy, skip } = useSkip(app);
  const label = skipLabel(d, app);
  return (
    <header className="border-b border-[#e3d5bd] bg-[#f6efe2]/92 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 lg:gap-5 lg:px-8">
        <Link href="/" className="flex shrink-0 flex-col rounded-lg leading-none sm:flex-row sm:items-baseline sm:gap-2" aria-label="Raynet home">
          <span className="font-display text-[24px] font-semibold tracking-tight text-teal-900 sm:text-[26px]">Raynet</span>
          <span className="font-hand text-[15px] text-cocoa-500 sm:text-[17px] lg:hidden">{hi ? `${d.recipient.addressAs} के लिए` : `for ${d.recipient.addressAs}`}</span>
          <span className="font-hand hidden text-[17px] text-cocoa-500 lg:inline">{hi ? 'नामी के साथ' : 'with Nami'}</span>
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
            <p className="truncate text-[16px] font-semibold text-teal-900">{hi ? `${d.recipient.addressAs} की स्क्रीन` : `${first}’s screen`}</p>
            <p className="truncate text-[14px] text-ink-600">
              {d.recipient.city}
              <span className="hidden xl:inline">{hi ? ' · अकेली रहती हैं, नामी से बात करती हैं' : ' · lives alone, talks with Nami'}</span>
            </p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* phones: the demo time pill is itself the skip button */}
          <button
            onClick={skip}
            disabled={busy}
            aria-label={`${t.demoTime} ${d.clock.time}. ${label}`}
            title={label}
            className="flex min-h-10 items-center gap-1 rounded-full bg-[#fbe9a6] px-2.5 text-[14px] ring-1 ring-warn-600/40 disabled:opacity-60 sm:hidden"
          >
            <span className="font-semibold text-[#8a5a12]">{hi ? 'डेमो' : 'Demo'}</span>
            <span className="font-semibold tabular-nums text-ink-900">{d.clock.time}</span>
            <FastForward className="h-4 w-4 text-warn-600" aria-hidden />
          </button>
          <div className="hidden items-center gap-2 rounded-full bg-[#fbe9a6]/70 py-2 pr-3 pl-3 text-[14px] ring-1 ring-warn-600/30 sm:flex" title="A labelled demo clock. Judges can skip it forward to show what happens later in the day.">
            <span className="font-semibold text-[#8a5a12]">{t.demoTime}</span>
            <span className="font-semibold tabular-nums text-ink-900">{d.clock.time}</span>
            <button
              disabled={busy}
              onClick={skip}
              title={label}
              aria-label={label}
              className="-my-1 -mr-1 ml-0.5 inline-flex min-h-8 items-center gap-1 rounded-full bg-warn-600 px-2.5 py-1 text-[13px] font-semibold text-white hover:bg-[#9c6619] disabled:opacity-60"
            >
              <FastForward className="h-4 w-4" aria-hidden />
              <span className="hidden lg:inline">{busy ? (hi ? 'आगे बढ़ रहे हैं…' : 'Skipping…') : label}</span>
            </button>
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
            <ClipboardList className="hidden h-[18px] w-[18px] sm:block" aria-hidden />
            <span className="sm:hidden">Judges</span>
            <span className="hidden sm:inline">For judges</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function StepNum({ n, done }: { n: number; done: boolean }) {
  if (done) return <CircleCheck className="h-4 w-4 shrink-0" aria-label="done" />;
  return <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-teal-900 text-[11px] font-bold text-ivory-50">{n}</span>;
}

/** Slim, always-visible demo script for a judge who just landed here. */
function GuideBar({ d, app, jumping, onMiss, onCall }: { d: Snap; app: App; jumping: boolean; onMiss: () => void; onCall: () => void }) {
  const first = d.recipient.firstName ?? d.recipient.addressAs;
  const who = first === 'Meera' && d.recipient.city === 'Jaipur' ? 'You’re Meera, 72, in Jaipur.' : `You’re ${first}, in ${d.recipient.city}.`;
  const arjun = d.contacts.find((c) => c.priority === 1);
  const booked = d.appointments.some((a) => a.state === 'confirmed');
  const booking = d.appointments.some((a) => ['draft', 'finding_availability', 'awaiting_user_approval', 'pending_clinic_confirmation'].includes(a.state));
  const missed = d.cases.some((c) => c.type === 'checkin' && (FAMILY.includes(c.state) || c.state === 'resolved_human_reported'));
  const accepted = d.cases.some((c) => c.type === 'checkin' && !!c.ownerContactId);
  const example = app.lang === 'hi' ? 'अगले हफ्ते डॉक्टर से सुबह का अपॉइंटमेंट बुक कर दो' : 'Book a morning follow-up with my doctor next week';
  const pill = 'inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-[13.5px] font-semibold ring-1 transition disabled:opacity-60 sm:min-h-9 sm:gap-1.5 sm:px-3 sm:text-[14px]';
  const step = (done: boolean) => (done ? 'bg-[#e3f1ea] text-ok-600 ring-ok-600/40' : 'bg-white text-teal-900 ring-[#e3d5bd] hover:bg-ivory-100 hover:ring-teal-700/50');
  return (
    <nav aria-label="Demo guide" className="border-b border-dashed border-cocoa-300 bg-[#fffaf0]/95">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 sm:px-6 lg:px-8">
        <p className="text-[14px] text-ink-900">
          <span className="font-semibold">{who}</span> <span className="font-hand text-[16px] text-cocoa-500">Try:</span>
        </p>
        <Link href="/console" className="ml-auto inline-flex min-h-9 items-center gap-1 text-[14px] font-semibold text-teal-700 underline-offset-2 hover:underline sm:order-last">
          How it works <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <div className="flex w-full flex-wrap gap-1 sm:w-auto sm:gap-1.5">
          <button onClick={() => void app.sendText(example)} disabled={app.busy} className={cx(pill, step(booked))}>
            <StepNum n={1} done={booked} />
            <span className="sm:hidden">Book doctor</span>
            <span className="hidden sm:inline">Book a doctor</span>
            {booking && !booked && <span className="h-2 w-2 animate-pulse rounded-full bg-warn-600" aria-label="in progress" />}
          </button>
          <button onClick={onMiss} disabled={jumping} aria-busy={jumping} className={cx(pill, step(missed))}>
            <StepNum n={2} done={missed} />
            {jumping ? 'Skipping ahead…' : (
              <>
                <span className="sm:hidden">Miss check-in</span>
                <span className="hidden sm:inline">Miss a check-in</span>
              </>
            )}
          </button>
          {arjun && (
            <a href={arjun.careUrl} target="_blank" rel="noreferrer" className={cx(pill, step(accepted))} aria-label={`See it as ${arjun.name}, opens his page in a new tab`}>
              <StepNum n={3} done={accepted} />
              <span className="sm:hidden">Be {arjun.name}</span>
              <span className="hidden sm:inline">See it as {arjun.name}</span>
              <ExternalLink className="hidden h-3.5 w-3.5 sm:block" aria-hidden />
            </a>
          )}
          <button onClick={onCall} className={cx(pill, 'bg-cocoa-500 text-ivory-50 ring-cocoa-500 hover:bg-[#7a4a32]')}>
            <Phone className="h-3.5 w-3.5" aria-hidden />
            <span className="sm:hidden">Call me</span>
            <span className="hidden sm:inline">Nami calls your phone</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

function Captions({ captions, lang, quiet, hideWide }: { captions: App['captions']; lang: string; quiet: boolean; hideWide: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  // in the order things happened, newest at the bottom
  const shown = captions
    .filter((c) => c.text.trim())
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.at - b.c.at || a.i - b.i)
    .map((x) => x.c)
    .slice(quiet ? -1 : -3);
  const lastKey = shown.map((c) => c.id + c.text.length).join();
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastKey]);
  if (!shown.length) return null;
  return (
    <div ref={box} className={cx('pp-scroll -mx-1 flex min-h-0 flex-col gap-2.5 overflow-y-auto px-1 py-1', quiet ? cx('max-h-[30dvh] shrink-0', hideWide && 'lg:sr-only') : 'max-h-[42dvh] lg:max-h-none lg:flex-1 lg:[&>:first-child]:mt-auto lg:[mask-image:linear-gradient(to_bottom,transparent,#000_20px)]')} aria-live="polite" aria-label="Captions">
      {shown.map((c) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: c.final ? 1 : 0.75, y: 0 }}
          className={cx(
            'max-w-[92%] shrink-0 text-[19px] leading-snug',
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

function NoteShell({ children, tone = 'paper', tilt = '-0.6deg', reveal = false }: { children: React.ReactNode; tone?: 'paper' | 'yellow' | 'green'; tilt?: string; reveal?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // on a phone a new question can open below the fold; bring it into view once
  useEffect(() => {
    if (!reveal) return;
    const id = setTimeout(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 250);
    return () => clearTimeout(id);
  }, [reveal]);
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      className={cx('pp-note pp-tape pp-tape-l relative mt-2 shrink-0 scroll-mb-4 rounded-md p-4 sm:p-5', tone === 'yellow' && 'pp-yellow', tone === 'green' && '!bg-[#e3f1ea]')}
      style={{ ['--tilt' as string]: tilt }}
    >
      {children}
    </motion.div>
  );
}

const CHECK_HI: Record<string, string> = {
  clinic_approved: 'क्लिनिक आपकी मंज़ूर सूची में है',
  slot_present: 'क्लिनिक ने एक समय बताया',
  quote_present: 'क्लिनिक के अपने शब्द दर्ज हैं',
  parses: 'तारीख़ और समय साफ़ हैं',
  not_in_past: 'समय बीता नहीं है',
  in_date_range: 'आपकी चुनी तारीख़ों के बीच',
  in_time_window: 'आपके चुने समय (सुबह/शाम) में',
  weekday_consistent: 'दिन और तारीख़ आपस में मेल खाते हैं',
  exists_in_clinic_calendar: 'क्लिनिक के कैलेंडर में खाली है',
  matches_approved_slot: 'आपकी मंज़ूर की गई स्लॉट से मेल खाता है',
};

function Checks({ list, lang, className }: { list: Apt['verification']; lang: string; className?: string }) {
  return (
    <ul className={cx('space-y-0.5 text-[14px] leading-snug', className)}>
      {list.map((v, i) => (
        <li key={v.check + i} className={cx('flex gap-1.5', v.pass ? 'text-ok-600' : 'text-bad-600')}>
          <span aria-hidden className="shrink-0 font-bold">{v.pass ? '✓' : '✗'}</span>
          <span>
            <span className="sr-only">{v.pass ? 'passed: ' : 'failed: '}</span>
            {lang === 'hi' ? (CHECK_HI[v.check] ?? v.detail) : v.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ApprovalCard({ p, d, lang, t, reveal, onAnswer }: { p: Snap['pending'][number]; d: Snap; lang: string; t: App['t']; reveal: boolean; onAnswer: (yes: boolean) => void }) {
  const hi = lang === 'hi';
  const icon = p.kind === 'approve_slot' || p.kind === 'permit_clinic_call' ? <Stethoscope className="h-6 w-6" /> : <Users className="h-6 w-6" />;
  const apt = p.kind === 'approve_slot' ? (d.appointments.find((a) => a.id === p.relatedId) ?? [...d.appointments].reverse().find((a) => a.state === 'awaiting_user_approval')) : undefined;
  const checks = apt?.verification ?? [];
  const passed = checks.filter((v) => v.pass).length;
  const title =
    p.kind === 'approve_slot'
      ? hi ? 'यह समय ठीक है?' : 'Approve this slot?'
      : p.kind === 'permit_clinic_call'
        ? hi ? 'क्या नामी क्लिनिक को फ़ोन करे?' : 'May Nami call the clinic?'
        : p.kind === 'send_memory'
          ? hi ? 'यह कहानी भेज दें?' : 'Send this story?'
          : hi ? 'आगे बढ़ूँ?' : 'Shall I go ahead?';
  return (
    <NoteShell tilt="0.4deg" reveal={reveal}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sea-200 text-teal-900">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[19px] font-semibold text-teal-900">{title}</p>
          <p className="mt-1 text-[18px] leading-snug text-ink-900">{hi ? p.readbackHi : p.readback}</p>
          {checks.length > 0 && (
            <div className="mt-2.5 rounded-lg bg-[#e3f1ea]/70 px-3 py-2 ring-1 ring-ok-600/20">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-teal-900">
                <ShieldCheck className="h-4 w-4 text-ok-600" aria-hidden />
                {hi ? `पूछने से पहले जाँचा: ${checks.length} में से ${passed} ठीक` : `Checked before asking you: ${passed} of ${checks.length} passed`}
              </p>
              <Checks list={checks} lang={lang} className="mt-1 sm:columns-2 sm:gap-4 [&>li]:break-inside-avoid" />
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => onAnswer(true)} className="flex min-h-14 items-center gap-2 rounded-full bg-teal-900 px-6 text-lg font-semibold text-ivory-50 hover:bg-teal-700">
              <Check className="h-5 w-5" /> {t.yesConfirm}
            </button>
            <button onClick={() => onAnswer(false)} className="flex min-h-14 items-center gap-2 rounded-full border-2 border-[#d9cbb2] bg-[#fffdf8] px-6 text-lg font-semibold text-ink-900 hover:bg-ivory-100">
              <X className="h-5 w-5" /> {t.no}
            </button>
          </div>
          <p className="mt-2 text-sm text-ink-600">{hi ? 'आपकी हाँ के बिना कुछ नहीं होगा।' : 'Nothing happens until you say yes or press Yes.'}</p>
        </div>
      </div>
    </NoteShell>
  );
}

function ReminderCard({ o, lang, t, app, reveal }: { o: Snap['occurrences'][number]; lang: string; t: App['t']; app: App; reveal: boolean }) {
  const r = (response: string, extra: Record<string, unknown> = {}) => app.command({ type: 'reminder.respond', occurrenceId: o.id, response, source: 'button', ...extra });
  return (
    <NoteShell tone="yellow" reveal={reveal}>
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
          <p className="mt-2 text-sm text-ink-600">{lang === 'hi' ? 'नामी वही लिखती है जो आप बताती हैं। वह जाँच नहीं सकती कि दवा ली गई या नहीं।' : 'Nami records what you say. She cannot check whether a medicine was taken.'}</p>
        </div>
      </div>
    </NoteShell>
  );
}

/** The same three answers the engine offers: I'm here, Later, I need help. "Later" just lets the engine ask again. */
function CheckinCard({ c, d, t, app, reveal }: { c: Case; d: Snap; t: App['t']; app: App; reveal: boolean }) {
  const hi = app.lang === 'hi';
  const key = `${c.id}:${c.pageRetriesUsed}`;
  const [later, setLater] = useState<string | null>(null);
  const snoozed = later === key;
  // when the engine will actually ask again
  const mins = c.timerAt ? Math.max(1, Math.round((c.timerAt - d.now) / 60_000)) : d.policy.retryWindowMin;
  return (
    <NoteShell tilt="-0.4deg" reveal={reveal}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sea-200 text-teal-900">
          <HeartHandshake className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-hand text-[17px] text-cocoa-500">{hi ? 'रोज़ का हाल-चाल' : `Daily check-in · ${hhmm(c.dueAt, d.recipient.timezone)}`}</p>
          <p className="text-[21px] font-semibold leading-snug">
            {snoozed
              ? hi
                ? `ठीक है, नामी ${mins} मिनट में फिर पूछेगी।`
                : `No rush. Nami will ask again in ${mins} minutes.`
              : hi
                ? 'नमस्ते! आज का चेक-इन, बस बता दीजिए आप यहाँ हैं।'
                : 'Good morning! Just let me know you’re here.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => app.command({ type: 'checkin.respond', source: 'button' })} className="flex min-h-14 items-center gap-2 rounded-full bg-teal-900 px-6 text-lg font-semibold text-ivory-50 hover:bg-teal-700">
              <Check className="h-5 w-5" /> {t.imHere}
            </button>
            {!snoozed && (
              <button onClick={() => setLater(key)} className="min-h-14 rounded-full border-2 border-[#d9cbb2] bg-[#fffdf8] px-5 text-lg font-semibold text-ink-900 hover:bg-ivory-100">
                {hi ? 'बाद में' : 'Later'}
              </button>
            )}
            <button onClick={() => app.command({ type: 'help.open', kind: 'explicit_help', source: 'button' })} className="min-h-14 rounded-full border-2 border-help-600/60 bg-[#fffdf8] px-5 text-lg font-semibold text-help-600">
              {t.needHelp}
            </button>
          </div>
        </div>
      </div>
    </NoteShell>
  );
}

function aptWhen(a: Apt, lang: string) {
  if (!a.offeredSlot) return null;
  return new Date(a.offeredSlot.startAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
}

/** Shown once the clinic itself has confirmed, with its own words as the evidence. */
function BookedCard({ a, d, lang, onDone }: { a: Apt; d: Snap; lang: string; onDone: () => void }) {
  const hi = lang === 'hi';
  const clinic = d.clinics.find((c) => c.id === a.clinicId);
  const ev = a.confirmationEvidence;
  return (
    <NoteShell tone="green" tilt="0.3deg" reveal>
      <div className="flex items-start gap-3" role="status">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ok-600 text-white">
          <CircleCheck className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[19px] font-semibold text-ok-600">{hi ? 'क्लिनिक ने पक्का किया' : 'Confirmed by the clinic'}</p>
          <p className="text-[21px] font-semibold leading-snug text-ink-900">{aptWhen(a, lang)}</p>
          <p className="text-[17px] text-ink-900">
            {hi ? clinic?.nameHi || clinic?.name : clinic?.name}
            {clinic?.doctor ? ` · ${clinic.doctor}` : ''}
          </p>
          {ev?.quote && <p className="mt-1 text-[15px] text-ink-600">{hi ? 'क्लिनिक ने कहा' : 'The clinic said'}: “{ev.quote}”</p>}
          {ev?.instructions && (
            <p className="mt-1.5 rounded-lg bg-white/70 px-3 py-2 text-[16px] text-ink-900">
              <span className="font-semibold">{hi ? 'ध्यान रखें: ' : 'Please note: '}</span>
              {ev.instructions}
            </p>
          )}
          <button onClick={onDone} className="mt-3 flex min-h-12 items-center gap-2 rounded-full bg-teal-900 px-5 text-[17px] font-semibold text-ivory-50 hover:bg-teal-700">
            <Check className="h-5 w-5" aria-hidden /> {hi ? 'ठीक है' : 'Got it'}
          </button>
        </div>
      </div>
    </NoteShell>
  );
}

function HelpBanner({ d, c, app }: { d: Snap; c: Case; app: App }) {
  const hi = app.lang === 'hi';
  const tz = d.recipient.timezone;
  const person = (id: string | null | undefined) => d.contacts.find((x) => x.id === id);
  const active = person(c.attempts.find((a) => a.state === 'active' && a.contactId)?.contactId);
  const owner = person(c.ownerContactId);
  const firstUp = person(c.contactOrder[0]);
  const help = c.type === 'help';
  const due = hhmm(c.dueAt, tz);
  let title = '';
  let line = '';
  if (c.state === 'owner_accepted' && owner) {
    const he = pronoun(owner.relation);
    title = hi ? `${owner.name} को पता है। वे जल्दी आपको फ़ोन करेंगे।` : `${owner.name} knows. ${he}’ll call you soon.`;
    line = help ? (hi ? 'आपातकाल हो तो 112 पर कॉल करें।' : 'If it’s an emergency, call 112.') : hi ? '“मैं यहाँ हूँ” अब भी दबा सकती हैं।' : 'You can still tap I’m here.';
  } else if (c.state === 'unresolved') {
    title = hi ? 'अभी तक किसी ने जवाब नहीं दिया।' : 'No one has answered yet.';
    line = hi ? 'परिवार अब भी जवाब दे सकता है। आपातकाल हो तो 112 पर कॉल करें।' : 'Your family can still reply. If it’s an emergency, call 112.';
  } else if (help) {
    title = hi ? 'आपने मदद माँगी।' : 'You asked for help.';
    line = active
      ? hi ? `नामी ${active.name} से आपका हाल पूछ रही है। आपातकाल हो तो 112 पर कॉल करें।` : `Nami is asking ${active.name} to check on you. If it’s an emergency, call 112.`
      : hi ? 'नामी आपके परिवार से पूछ रही है। आपातकाल हो तो 112 पर कॉल करें।' : 'Nami is asking your family. If it’s an emergency, call 112.';
  } else {
    title = hi ? `आपका ${due} बजे का चेक-इन छूट गया।` : `You missed your ${due} check-in.`;
    if (c.state === 'phone_fallback') {
      const ringing = c.evidence?.phoneFallback === 'pending';
      const when = c.timerAt ? hhmm(c.timerAt, tz) : null;
      const who = firstUp?.name;
      const ask = who
        ? hi ? `“मैं यहाँ हूँ” दबाइए, नहीं तो नामी ${when ? `${when} बजे ` : ''}${who} से पूछेगी।` : `Tap I’m here, or Nami will ask ${who}${when ? ` at ${when}` : ''}.`
        : hi ? '“मैं यहाँ हूँ” दबाइए।' : 'Tap I’m here.';
      line = ringing ? (hi ? `नामी अभी आपका फ़ोन बजा रही है। ${ask}` : `Nami is ringing your phone now. ${ask}`) : ask;
    } else if (active) {
      line = hi ? `नामी ${active.name} से आपका हाल पूछ रही है। “मैं यहाँ हूँ” दबाइए, नामी उन्हें बता देगी।` : `Nami is asking ${active.name} to check on you. Tap I’m here and Nami will let ${pronoun(active.relation) === 'He' ? 'him' : pronoun(active.relation) === 'She' ? 'her' : 'them'} know.`;
    } else line = hi ? 'नामी आपके परिवार से पूछ रही है।' : 'Nami is asking your family.';
  }
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
          <p className="text-[18px] font-bold leading-snug">{title}</p>
          <p className="text-[16px] text-white/90">{line}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 [&>*]:justify-center sm:[&>*]:flex-none">
          {showMistake && (
            <button onClick={() => app.command({ type: 'help.mistake', caseId: c.id, source: 'button' })} className="min-h-12 rounded-full bg-white/15 px-4 font-semibold ring-1 ring-white/40 hover:bg-white/25">
              {app.t.mistake}
            </button>
          )}
          {!help && (
            <button onClick={() => app.command({ type: 'checkin.respond', source: 'button' })} className="flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-semibold text-teal-900">
              <Check className="h-5 w-5" aria-hidden /> {app.t.imHere}
            </button>
          )}
          <a href="tel:112" className="flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-bold text-help-600">
            <Phone className="h-4 w-4" aria-hidden />
            <span className="sm:hidden">{hi ? '112 पर कॉल' : 'Call 112'}</span>
            <span className="hidden sm:inline">{app.t.emergency}</span>
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function voiceErrorText(code: string, hi: boolean) {
  if (code === 'voice_not_configured') return hi ? 'लाइव आवाज़ अभी इस सर्वर पर चालू नहीं है। नीचे लिखिए, नामी बोलकर जवाब देगी।' : 'Live voice isn’t set up on this server yet. Type to Nami below and she’ll answer aloud.';
  if (code === 'rate_limited' || code === 'daily_cap') return hi ? 'अभी के लिए आवाज़ की सीमा पूरी हो गई। नीचे लिखिए।' : 'Voice is resting for now. Please type to Nami below.';
  if (code === 'mic_blocked' || code === 'not-allowed' || code === 'NotAllowedError' || code === 'service-not-allowed')
    return hi ? 'नामी आपको सुन नहीं पा रही: माइक बंद है। ब्राउज़र में माइक की अनुमति दीजिए, या नीचे लिखिए।' : 'Nami can’t hear you: the microphone is blocked. Allow it in the browser, or type below.';
  if (code === 'mic_unavailable' || code === 'audio-capture' || code === 'NotFoundError')
    return hi ? 'नामी को माइक नहीं मिला। माइक जोड़िए, या नीचे लिखिए।' : 'Nami can’t find a microphone. Plug one in, or type below.';
  if (code === 'network' || code === 'connection_lost') return hi ? 'इंटरनेट रुक गया, इसलिए आवाज़ बंद हो गई। फिर से “बात करें” दबाइए, या नीचे लिखिए।' : 'The connection dropped, so voice stopped. Press Talk again, or type below.';
  return hi ? 'अभी आवाज़ नहीं चल रही। नीचे लिखिए, नामी जवाब देगी।' : 'Voice isn’t working right now. Type to Nami below and she’ll answer.';
}

function Controls({ app }: { app: App }) {
  const { t } = app;
  const on = app.voice !== 'off' && app.voice !== 'error';
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
      {app.voiceError && <p className="rounded-xl bg-[#fbe9a6]/70 px-4 py-2 text-[15px] text-[#6d4a12]" role="status">{voiceErrorText(app.voiceError, app.lang === 'hi')}</p>}
    </div>
  );
}

function WakeSwitch({ wake, lang }: { wake: Wake; lang: string }) {
  const hi = lang === 'hi';
  if (wake.status === 'unavailable') return <p className="text-[14px] text-ink-600">“Hey Nami” listening isn&rsquo;t available in this browser.</p>;
  return (
    <button
      onClick={wake.toggle}
      aria-pressed={wake.status !== 'off'}
      className={cx('flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold ring-1', wake.status === 'listening' || wake.status === 'heard' ? 'bg-[#e7f1ec] text-teal-900 ring-sea-500/50' : 'bg-white text-teal-900 ring-[#e3d5bd] hover:bg-[#fffdf8]')}
    >
      <span className={cx('h-2.5 w-2.5 rounded-full', wake.status === 'listening' ? 'animate-pulse bg-sea-500' : wake.status === 'error' ? 'bg-help-600' : 'bg-cocoa-300')} aria-hidden />
      {wake.status === 'off'
        ? hi ? '“Hey Nami” सुनना चालू करें' : 'Turn on “Hey Nami”'
        : wake.status === 'loading'
          ? hi ? 'तैयार हो रही हूँ…' : 'Getting ready…'
          : wake.status === 'error'
            ? hi ? 'माइक नहीं मिला · फिर कोशिश करें' : 'No microphone · tap to retry'
            : wake.status === 'paused'
              ? hi ? 'बात चल रही है' : 'In a conversation'
              : wake.status === 'heard'
                ? hi ? 'सुन लिया! बोलिए…' : 'Heard you! Go ahead…'
                : wake.status === 'tap'
                  ? hi ? 'सुनना शुरू करने के लिए कहीं भी छुएँ' : 'Tap anywhere to start listening'
                  : hi ? 'बोलिए “Hey Nami” · यहीं फ़ोन पर सुनती हूँ' : 'Say “Hey Nami” · listening on this device only'}
    </button>
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
    <section id="my-day" aria-labelledby="my-day-title" className="pp-note pp-tape relative scroll-mt-28 rounded-md px-5 pt-5 pb-3" style={{ ['--tilt' as string]: '-0.8deg' }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="my-day-title" className="font-display text-[24px] font-semibold text-teal-900">
          {lang === 'hi' ? 'आज का दिन' : 'My day'}
        </h2>
        <p className="font-hand text-[16px] text-cocoa-500">{date}</p>
      </div>
      <ul className="mt-1">
        {d.occurrences.map((o) => {
          const now = o.state === 'awaiting_response';
          const good = o.outcome === 'taken_reported' || o.outcome === 'done_reported';
          return (
            <li key={o.id} className={cx('-mx-2 flex items-baseline gap-3 rounded-lg border-b border-dashed border-[#e3d5bd] px-2 py-2 last:border-b-0', now && 'bg-[#fbe9a6]/60')}>
              <span className="w-[3.2rem] shrink-0 font-display text-[18px] font-semibold tabular-nums text-teal-900">{o.time}</span>
              <span className={cx('min-w-0 flex-1 text-[17px] leading-snug', o.state === 'resolved' && !now ? 'text-ink-600' : 'text-ink-900')}>{lang === 'hi' ? o.labelHi : o.label}</span>
              <span className={cx('font-hand inline-flex max-w-[9.5rem] shrink-0 items-center justify-end gap-1 text-right text-[16px] leading-tight', now ? 'font-bold text-[#8a5a12]' : good ? 'text-ok-600' : o.outcome ? 'text-cocoa-500' : 'text-ink-600/80')}>
                {good && <Check className="h-4 w-4" aria-hidden />}
                {now ? (lang === 'hi' ? 'अभी' : 'Now') : o.outcome ? ((lang === 'hi' ? OUTCOME_HI[o.outcome] : OUTCOME[o.outcome]) ?? o.outcome) : lang === 'hi' ? 'बाद में' : 'Later'}
              </span>
            </li>
          );
        })}
        {!d.occurrences.length && <li className="py-3 text-[18px] text-ink-600">{lang === 'hi' ? 'आज और कुछ नहीं।' : 'Nothing else today.'}</li>}
      </ul>
    </section>
  );
}

const APT_STATE: Record<string, { en: string; hi: string; tone: string }> = {
  draft: { en: 'Waiting for your OK to call', hi: 'फ़ोन करने के लिए आपकी हाँ चाहिए', tone: 'text-[#8a5a12]' },
  finding_availability: { en: 'Calling the clinic…', hi: 'क्लिनिक को फ़ोन कर रही है…', tone: 'text-[#8a5a12]' },
  awaiting_user_approval: { en: 'Slot found, needs your approval', hi: 'समय मिला, आपकी हाँ चाहिए', tone: 'text-[#8a5a12]' },
  pending_clinic_confirmation: { en: 'Checking with the clinic, not booked yet', hi: 'क्लिनिक से पूछ रही है, अभी बुक नहीं हुआ', tone: 'text-[#8a5a12]' },
  confirmed: { en: 'Confirmed by the clinic', hi: 'क्लिनिक ने पक्का किया', tone: 'text-ok-600' },
  failed_needs_help: { en: 'Not booked', hi: 'बुक नहीं हुआ', tone: 'text-bad-600' },
  cancelled: { en: 'Cancelled', hi: 'रद्द', tone: 'text-ink-600' },
};

function Appointments({ d, lang }: { d: Snap; lang: string }) {
  const hi = lang === 'hi';
  const list = [...d.appointments].reverse();
  if (!list.length) return null;
  return (
    <section className="pp-note pp-blue relative rounded-md p-5" style={{ ['--tilt' as string]: '0.5deg' }}>
      <h2 className="flex items-center gap-2 font-display text-[22px] font-semibold text-teal-900">
        <Stethoscope className="h-5 w-5" aria-hidden /> {hi ? 'डॉक्टर के अपॉइंटमेंट' : 'Appointments'}
      </h2>
      <ul className="mt-3 space-y-3">
        {list.map((a) => {
          const st = APT_STATE[a.state] ?? { en: a.state, hi: a.state, tone: '' };
          const ok = a.state === 'confirmed';
          const clinic = d.clinics.find((c) => c.id === a.clinicId);
          const passed = a.verification.filter((v) => v.pass).length;
          return (
            <li key={a.id} className={cx('rounded-xl p-3.5', ok ? 'bg-[#e3f1ea] ring-1 ring-ok-600/30' : 'bg-[#fffaf0]')}>
              <p className={cx('flex items-center gap-1.5 text-[17px] font-semibold', st.tone)}>
                {ok && <CircleCheck className="h-5 w-5" aria-hidden />}
                {hi ? st.hi : st.en}
              </p>
              {a.offeredSlot && <p className="text-[17px] text-ink-900">{aptWhen(a, lang)}</p>}
              {ok && clinic && <p className="text-[15px] text-ink-600">{hi ? clinic.nameHi || clinic.name : clinic.name}</p>}
              {ok && a.confirmationEvidence?.instructions && <p className="mt-1 text-[15px] text-ink-900">{a.confirmationEvidence.instructions}</p>}
              {a.failureReason && <p className="text-sm text-bad-600">{a.failureReason}</p>}
              {a.verification.length > 0 && (
                <details className="mt-1 text-sm" open={a.verification.some((v) => !v.pass)}>
                  <summary className="cursor-pointer text-teal-700">{hi ? `जाँच (${a.verification.length} में से ${passed} ठीक)` : `Verifier checks (${passed}/${a.verification.length} passed)`}</summary>
                  <Checks list={a.verification} lang={lang} className="mt-1" />
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CallTranscript({ call, lang }: { call: Snap['calls'][number]; lang: string }) {
  const hi = lang === 'hi';
  const turns = (call.transcript as Array<{ speaker: string; text: string }>) ?? [];
  const box = useRef<HTMLDivElement>(null);
  const last = turns.length ? turns[turns.length - 1].text.length : 0;
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, last]);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative flex max-h-[min(15rem,34dvh)] shrink-0 flex-col rounded-2xl bg-teal-900 p-4 text-ivory-50 shadow-[0_12px_28px_rgba(23,61,56,.3)]">
      <p className="mb-2 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold">
        <PhoneCall className="h-4 w-4 animate-pulse" aria-hidden />
        {call.purpose.startsWith('clinic') ? (hi ? 'नामी क्लिनिक से फ़ोन पर बात कर रही है' : 'Nami is on the phone with the clinic') : hi ? 'नामी फ़ोन कर रही है' : 'Nami is calling'}
        <span className="rounded-full bg-white/12 px-2 py-0.5 text-[13px] font-medium text-sea-200">{call.adapter === 'sim' ? 'Simulated clinic (demo)' : 'Real phone call'}</span>
        <span className="text-[13px] font-medium text-white/70">{String(call.state).replace('_', ' ')}</span>
      </p>
      <div ref={box} className="pp-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto text-[16px]" aria-live="polite" aria-label="Call transcript">
        {turns.map((x, i) => (
          <p key={i} className={x.speaker === 'nami' ? 'text-sea-200' : x.speaker === 'system' ? 'italic text-white/60' : 'text-white'}>
            <span className="mr-2 text-[13px] font-semibold opacity-75">{x.speaker === 'nami' ? 'Nami' : x.speaker === 'clinic' ? 'Clinic' : x.speaker}</span>
            {x.text}
          </p>
        ))}
        {!turns.length && <p className="text-white/70">{hi ? 'घंटी जा रही है…' : 'Ringing…'}</p>}
      </div>
    </motion.div>
  );
}

const CAT: Record<string, string> = { agent: 'bg-sea-200 text-teal-900', state: 'bg-[#efe6d4] text-ink-600', external: 'bg-[#fbe9a6] text-[#6d4a12]', human: 'bg-[#e3f1ea] text-ok-600' };

/** The audit trail, labelled as a judges' overlay rather than part of Meera's own screen. */
function BehindTheScenes({ d, lang }: { d: Snap; lang: string }) {
  const hi = lang === 'hi';
  const ev = d.events.filter((e) => e.action !== 'demo_clock_skip').slice(0, 10);
  return (
    <section className="relative rounded-2xl border-2 border-dashed border-cocoa-300 bg-[#fffaf0]/80 p-5 md:col-span-2 lg:col-span-1" aria-labelledby="bts-title">
      <h2 id="bts-title" className="flex items-center gap-2 font-display text-[20px] font-semibold text-teal-900">
        <Activity className="h-5 w-5" aria-hidden /> {hi ? 'पर्दे के पीछे (जजों के लिए)' : 'Behind the scenes (for judges)'}
      </h2>
      <p className="font-hand text-[15px] text-cocoa-500">{hi ? 'हर एजेंट का हर कदम' : 'what each agent did, as it happened'}</p>
      <ol className="mt-3 space-y-2.5">
        {ev.map((e) => (
          <li key={String(e.id)} className="flex gap-2.5 text-[14.5px] leading-snug">
            <span className="w-11 shrink-0 tabular-nums text-ink-600">{new Date(e.at_virtual as string).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            <span className="min-w-0 flex-1">
              <span className={cx('mr-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold', CAT[e.category as string])}>{String(e.actor).startsWith('contact:') ? 'family' : (e.actor as string)}</span>
              {e.summary as string}
            </span>
          </li>
        ))}
        {!ev.length && <li className="text-ink-600">{hi ? 'आज अभी कुछ नहीं।' : 'Nothing yet today.'}</li>}
      </ol>
      <Link href="/console" className="mt-4 inline-flex min-h-10 items-center gap-1 font-semibold text-teal-700 underline-offset-2 hover:underline">
        {hi ? 'कंसोल में हर एजेंट देखें' : 'See every agent in the console'} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function Num({ n }: { n: number }) {
  return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-900 text-[13px] font-bold text-ivory-50">{n}</span>;
}

function JudgesPanel({ d, app, wake, focusArjun, jumping, onMiss, onClose }: { d: Snap; app: App; wake: Wake; focusArjun: number; jumping: boolean; onMiss: () => void; onClose: () => void }) {
  const arjun = d.contacts.find((c) => c.priority === 1);
  const clinic = d.clinics[0];
  const { busy, skip } = useSkip(app);
  const ref = useRef<HTMLDivElement>(null);
  const arjunRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusArjun && arjunRef.current) {
      arjunRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      arjunRef.current.focus({ preventScroll: true });
    } else ref.current?.focus();
  }, [focusArjun]);
  const h3 = 'flex items-center gap-2 text-[16px] font-semibold text-teal-900';
  const sec = 'mt-4 border-t border-dashed border-[#e3d5bd] pt-4';
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
      className="fixed inset-x-2 bottom-2 z-40 max-h-[80dvh] overflow-y-auto rounded-[22px] border-2 border-dashed border-cocoa-300 bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(70,45,20,.3)] outline-none sm:inset-x-auto sm:right-4 sm:bottom-auto sm:top-[calc(var(--top)+8px)] sm:w-[390px] sm:max-h-[calc(100dvh-var(--top)-16px)]"
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

      <div className="mt-4">
        <h3 className={h3}>
          <Num n={1} /> Try a clinic booking
        </h3>
        <button
          onClick={() => {
            const d0 = new Date(d.clock.date + 'T00:00:00Z');
            const iso = (n: number) => new Date(d0.getTime() + n * 86400000).toISOString().slice(0, 10);
            void app.command({ type: 'appointment.propose', clinicId: clinic?.id ?? 'cl_mehta', dateFrom: iso(2), dateTo: iso(6), window: 'morning', reason: 'follow_up' });
          }}
          className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-[15px] font-semibold text-teal-900 ring-1 ring-[#e3d5bd] hover:bg-ivory-100"
        >
          <Stethoscope className="h-4 w-4 shrink-0" aria-hidden /> Book {clinic?.doctor ?? 'the doctor'}, a morning next week
        </button>
        <label className="mt-3 block text-[14px] font-semibold text-ink-900" htmlFor="scenario">
          Make the clinic misbehave (watch the verifier refuse)
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

      {arjun && (
        <div ref={arjunRef} tabIndex={-1} className={cx(sec, 'scroll-mt-4 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-teal-700', focusArjun > 0 && 'bg-[#e7f1ec]/60 -mx-2 px-2 pb-2')}>
          <h3 className={h3}>
            <Num n={2} /> Be {arjun.name}, her son
          </h3>
          <div className="mt-2 flex items-center gap-4">
            <a href={arjun.careUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-white p-2 ring-1 ring-[#e3d5bd]" aria-label={`Open ${arjun.name}'s caregiver page in a new tab`}>
              <QRCodeSVG value={arjun.careUrl} size={92} fgColor="#173D38" />
            </a>
            <div className="text-[14px] text-ink-600">
              <p>Scan with your phone, or open it here. When a check-in is missed, he&rsquo;s asked to follow up on that page.</p>
              <a href={arjun.careUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-teal-900 px-4 font-semibold text-ivory-50 hover:bg-teal-700">
                Open {arjun.name}&rsquo;s page <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </div>
          <p className="mt-2 text-[13px] text-ink-600">Nobody is marked safe automatically. A person has to say they spoke with her.</p>
        </div>
      )}

      <div className={cx(sec, 'rounded-b-none')}>
        <h3 className={h3}>
          <Num n={3} /> Move the demo clock
        </h3>
        <p className="mt-0.5 text-[14px] text-ink-600">It&rsquo;s {app.lang === 'hi' ? d.clock.spokenHi : d.clock.spokenEn}. Each skip jumps to the next reminder or check-in.</p>
        <div className="mt-2 grid gap-2">
          <button disabled={busy} onClick={skip} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-warn-600 px-4 text-[16px] font-semibold text-white hover:bg-[#9c6619] disabled:opacity-60">
            <FastForward className="h-5 w-5" aria-hidden /> {busy ? 'Skipping…' : skipLabel(d, app)}
          </button>
          <button disabled={jumping} onClick={onMiss} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold text-[#8a5a12] ring-1 ring-warn-600/40 hover:bg-[#fbe9a6]/40 disabled:opacity-60">
            {jumping ? 'Skipping ahead…' : 'Jump to a missed check-in (family is asked)'}
          </button>
        </div>
      </div>

      <div className={sec}>
        <h3 className={h3}>
          <Num n={4} /> See how the agents work
        </h3>
        <Link href="/console" className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-teal-900 px-4 text-[16px] font-semibold text-ivory-50 hover:bg-teal-700">
          Open the agent console <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>


      <div className={cx(sec, 'flex flex-wrap items-center justify-between gap-3')}>
        <h3 className={h3}>
          <Num n={6} /> Start over
        </h3>
        <button
          onClick={async () => {
            await post('/api/demo/reset');
            window.location.reload();
          }}
          className="flex min-h-11 items-center gap-2 rounded-full px-3 font-semibold text-ink-600 ring-1 ring-[#e3d5bd] hover:text-ink-900"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset demo household
        </button>
      </div>

      <div className={sec}>
        <WakeSwitch wake={wake} lang={app.lang} />
        <p className="mt-2 text-[13px] text-ink-600">{app.lang === 'hi' ? 'कीबोर्ड: Space बात · H मदद · M म्यूट · D आज का दिन' : 'Keys: Space talk · H help · M mute · D my day'}</p>
      </div>
    </motion.div>
  );
}

function MemoryCorner({ d, app }: { d: Snap; app: App }) {
  const mp = [...(d.memoryPrompts ?? [])].reverse()[0];
  if (!mp) return null;
  const hi = app.lang === 'hi';
  return (
    <section aria-label={hi ? 'यादों का कोना' : 'Memory Corner'} className="pp-note relative flex gap-3 rounded-md p-3" style={{ ['--tilt' as string]: '0.6deg' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mp.photoPath} alt={mp.caption} className="h-[90px] w-[120px] shrink-0 rounded-[3px] object-cover ring-4 ring-white" />
      <div className="min-w-0 flex-1">
        <p className="font-hand text-[17px] leading-snug text-ink-900">“{mp.caption}”</p>
        <p className="font-hand text-[14px] text-cocoa-500">{hi ? `${mp.fromName} ने भेजी ♥` : `from ${mp.fromName} ♥`}</p>
        {mp.state === 'new' && (
          <button onClick={() => app.startStory(mp)} className="mt-1.5 flex min-h-11 items-center gap-1.5 rounded-full bg-cocoa-500 px-3.5 text-[15px] font-semibold text-white hover:bg-[#74503a]">
            <HeartHandshake className="h-4 w-4" aria-hidden /> {hi ? 'नामी को कहानी सुनाइए' : 'Tell Nami the story'}
          </button>
        )}
        {mp.state === 'story_drafted' && <p className="mt-1 text-[14px] font-semibold text-[#8a5a12]">{hi ? 'कहानी तैयार है, भेजने से पहले आपकी अनुमति चाहिए।' : 'Story drafted, waiting for your OK before sending.'}</p>}
        {mp.state === 'sent' && <p className="mt-1 text-[14px] font-semibold text-ok-600">✓ {hi ? `${mp.fromName} को भेज दी गई` : `Sent to ${mp.fromName}`}</p>}
        {mp.state === 'kept_private' && <p className="mt-1 text-[14px] text-ink-600">{hi ? 'निजी रखी गई' : 'Kept private'}</p>}
        <p className="mt-1 text-[13px] text-ink-600">{hi ? 'नामी कुछ भी आपकी हाँ के बिना नहीं भेजती।' : 'Nothing is sent without your yes.'}</p>
      </div>
    </section>
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
    <div className="mt-2 rounded-2xl bg-[#e7f1ec] p-4">
      <h3 className="flex items-center gap-2 text-[16px] font-semibold text-teal-900">
        <PhoneCall className="h-4 w-4" aria-hidden /> Nami calls your phone
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

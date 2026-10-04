import {
  AlertTriangle,
  ArrowRight,
  BellOff,
  Bot,
  Cpu,
  Lock,
  MessageCircle,
  Phone,
  Scale,
  UserCheck,
  Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import { CallReplay } from './CallReplay';
import { InView } from './InView';
import { NamiSlot } from './NamiSlot';
import { Container, Eyebrow, LANE_RIGHT, SectionTitle } from './ui';

/* ------------------------------------------------------------------ */
/* Watch Nami book an appointment                                      */
/* ------------------------------------------------------------------ */

export function DemoSection() {
  return (
    <section id="replay" aria-labelledby="replay-title" className="relative bg-teal-900 pt-10 pb-24 sm:pt-14 sm:pb-28">
      <Container>
        <div className="max-w-[44rem]">
          <Eyebrow tone="dark">The appointment, start to finish</Eyebrow>
          <SectionTitle tone="dark" className="mt-4">
            <span id="replay-title">Watch Nami book an appointment.</span>
          </SectionTitle>
          <p className="mt-5 text-lg leading-relaxed text-sea-200/90">
            She phones the clinic, plain code checks every claim, and Meera says yes before anything is booked.
          </p>
        </div>
        <div className="relative mt-24 sm:mt-20 xl:mt-12">
          <NamiSlot id="replay-lane" pose="listening" say="Watch me book Dr. Mehta. Code checks every word I hear." className={`${LANE_RIGHT} top-10`} />
          <NamiSlot id="replay-peek" pose="peek" className="absolute right-6 bottom-full h-[132px] w-[132px] xl:hidden" />
          <CallReplay />
        </div>
        <p className="mt-6 max-w-[48em] text-[14px] leading-relaxed text-sea-200/75">
          The receptionist here is an AI agent backed by a fixed calendar. In the live demo the same flow runs for real, step by
          step, and the{' '}
          <a href="/console" className="font-semibold text-ivory-50 underline decoration-sea-500 underline-offset-4 hover:decoration-ivory-50">
            agent console
          </a>{' '}
          shows every event.
        </p>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How Nami stays honest                                               */
/* ------------------------------------------------------------------ */

const LADDER = [
  { icon: BellOff, title: 'Check-in missed', body: '10:00 check-in. No reply in 15 minutes.' },
  { icon: MessageCircle, title: 'Asked again', body: 'Nami tries once more on the screen.' },
  { icon: Phone, title: 'Phone', body: 'She calls Meera’s phone.' },
  { icon: UserCheck, title: 'Arjun (son)', body: 'He has to accept. Voicemail doesn’t count.' },
  { icon: Users, title: 'Priya (daughter)', body: 'If Arjun can’t, or doesn’t accept in time.' },
];

export function HonestSection() {
  return (
    <section id="honest" aria-labelledby="honest-title" className="relative bg-ivory-50 pt-20 pb-24 sm:pt-28 sm:pb-28">
      <Container>
        <div className="relative max-w-[46rem]">
          <Eyebrow>How Nami stays honest</Eyebrow>
          <SectionTitle className="mt-4">
            <span id="honest-title">
              Nami never marks anyone safe. <span className="text-cocoa-500 italic">A person does.</span>
            </span>
          </SectionTitle>
          <p className="mt-5 text-lg leading-relaxed text-ink-600">
            When a check-in goes unanswered, the ladder Meera agreed to runs, one step at a time. Someone has to accept
            responsibility. If nobody does, Nami says so.
          </p>
        </div>

        <div className="relative mt-24 sm:mt-20 lg:mt-14">
          <NamiSlot id="honest-lane" pose="thinking" say="I never say “booked” until the clinic really confirms." className={`${LANE_RIGHT} -top-6`} />
          <NamiSlot id="honest-peek" pose="peek" className="absolute right-6 bottom-full h-[132px] w-[132px] xl:hidden" />
          <InView as="ol" className="grid gap-3 lg:grid-cols-6 lg:gap-2" amount={0.3}>
          {LADDER.map((s, i) => (
            <li key={s.title} className="relative flex gap-4 lg:flex-col lg:gap-3">
              <span
                aria-hidden
                className="lp-line absolute top-[38px] bottom-[-12px] left-[18px] w-[2px] bg-sea-500/60 lg:top-[18px] lg:right-[-8px] lg:bottom-auto lg:left-[38px] lg:h-[2px] lg:w-auto"
                style={{ ['--d' as string]: `${i * 260 + 220}ms` }}
              />
              <span
                className="lp-step relative z-10 grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-teal-900 text-ivory-50 ring-4 ring-ivory-50"
                style={{ ['--d' as string]: `${i * 260}ms` }}
              >
                <s.icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div className="lp-step flex-1 rounded-[20px] border border-line bg-card p-4" style={{ ['--d' as string]: `${i * 260 + 60}ms` }}>
                <p className="text-[12px] font-semibold text-ink-600/70 tabular-nums">Step {i + 1}</p>
                <h3 className="text-[16.5px] leading-snug font-semibold text-ink-900">{s.title}</h3>
                <p className="mt-1 text-[14px] leading-snug text-ink-600">{s.body}</p>
              </div>
            </li>
          ))}
          <li className="relative flex gap-4 lg:flex-col lg:gap-3">
            <span
              className="lp-step relative z-10 grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-bad-600 text-white ring-4 ring-ivory-50"
              style={{ ['--d' as string]: `${LADDER.length * 260}ms` }}
            >
              <AlertTriangle className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div
              className="lp-step flex-1 rounded-[20px] border-2 border-bad-600/60 bg-bad-600/[0.06] p-4"
              style={{ ['--d' as string]: `${LADDER.length * 260 + 60}ms` }}
            >
              <p className="text-[12px] font-semibold text-bad-600">Nobody accepted?</p>
              <h3 className="text-[16.5px] leading-snug font-semibold text-bad-600">Shown as unresolved</h3>
              <p className="mt-1 text-[14px] leading-snug text-ink-900/80">Never shown as success.</p>
            </div>
          </li>
          </InView>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6">
          <div className="rounded-[26px] border border-line bg-ivory-100 p-6 sm:p-8">
            <h3 className="font-display text-2xl leading-tight text-teal-900">Failures are shown as they are.</h3>
            <ul className="mt-5 space-y-3.5 text-[16px] leading-snug text-ink-600">
              {[
                '“Nobody has accepted yet” is never displayed as success.',
                'A call that connects is not a booking. Only the clinic’s confirmation is.',
                'A closed browser tab shows “delivery uncertain”, never “she’s unwell”.',
                'If Meera answers mid-ladder, pending calls stop and the family is told.',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-cocoa-500" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative overflow-hidden rounded-[26px] bg-teal-900 p-6 text-ivory-50 sm:p-8">
            <p className="lp-display font-display text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.05]">
              LLMs propose, <span className="text-sea-500 italic">code disposes.</span>
            </p>
            <p className="mt-3 max-w-[30em] text-[15.5px] leading-relaxed text-sea-200/85">
              No language model can change a care state. A deterministic workflow engine owns every state machine, and plain-code
              verifiers check every claim an agent makes.
            </p>
            <div className="mt-6 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_auto]" aria-label="Agents propose, the verifier and engine decide, then care state changes">
              <div className="space-y-1.5">
                {['Conversation agent', 'Caller agent', 'Extractor'].map((a) => (
                  <p key={a} className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-3 py-2 text-[13.5px]">
                    <Bot className="h-4 w-4 text-sea-500" aria-hidden /> {a}
                  </p>
                ))}
              </div>
              <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-sea-500 sm:rotate-0" aria-hidden />
              <div className="space-y-1.5">
                {[
                  { a: 'Verifier', i: Scale },
                  { a: 'Workflow engine', i: Cpu },
                ].map(({ a, i: I }) => (
                  <p key={a} className="flex items-center gap-2 rounded-xl bg-sea-500 px-3 py-2 text-[13.5px] font-semibold text-teal-900">
                    <I className="h-4 w-4" aria-hidden /> {a}
                  </p>
                ))}
              </div>
              <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-sea-500 sm:rotate-0" aria-hidden />
              <p className="flex items-center justify-center gap-2 rounded-xl border border-sea-500/50 px-3 py-2 text-[13.5px] font-semibold">
                <Lock className="h-4 w-4 text-sea-500" aria-hidden /> Care state
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Edge wave: dark section → ivory                                     */
/* ------------------------------------------------------------------ */

export function EdgeWave({ from, to, flip = false }: { from: string; to: string; flip?: boolean }) {
  return (
    <div aria-hidden className={clsx('relative h-[56px] sm:h-[72px]')} style={{ background: from }}>
      <svg viewBox="0 0 1600 80" preserveAspectRatio="none" className={clsx('absolute inset-0 h-full w-full', flip && '-scale-x-100')}>
        <path d="M0 46 C180 18 360 18 560 40 C760 62 960 66 1160 42 C1340 22 1480 24 1600 34 V80 H0 Z" fill="#80A99B" opacity="0.55" />
        <path d="M0 56 C200 32 400 34 600 52 C800 70 1000 72 1200 52 C1380 36 1500 40 1600 46 V80 H0 Z" fill={to} />
      </svg>
    </div>
  );
}

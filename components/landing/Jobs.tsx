import { BellRing, CalendarCheck2, Check, Clock3, Phone, PhoneCall, ShieldCheck, Sun, UserCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PoseName } from '@/lib/nami/poses';
import { InView } from './InView';
import { NamiSlot } from './NamiSlot';
import { Container, Eyebrow, LANE_LEFT, SectionTitle } from './ui';

type Job = {
  id: string;
  n: string;
  title: string;
  hi: string;
  body: string;
  control: string;
  pose: PoseName;
  icon: ReactNode;
  vignette: ReactNode;
};

const chip = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold';

function Bubble({ from, children, lang }: { from: 'nami' | 'meera'; children: ReactNode; lang?: string }) {
  return (
    <p
      lang={lang}
      className={
        from === 'nami'
          ? 'max-w-[88%] rounded-2xl rounded-bl-md bg-teal-900 px-3.5 py-2 text-[13.5px] leading-snug text-ivory-50'
          : 'ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-card px-3.5 py-2 text-[13.5px] leading-snug text-ink-900 shadow-sm'
      }
    >
      {children}
    </p>
  );
}

const JOBS: Job[] = [
  {
    id: 'reminds',
    n: '01',
    title: 'Reminds',
    hi: '“मीरा जी, BP की दवाई का time.”',
    body: 'Medicine, water and a walk, spoken aloud and shown big on screen. Snoozing moves the reminder, never the prescription.',
    control: 'She records what Meera says. She never claims a pill was taken.',
    pose: 'reminder',
    icon: <BellRing className="h-5 w-5" aria-hidden />,
    vignette: (
      <div className="space-y-2.5">
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-sea-200 text-teal-900">
            <Clock3 className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-ink-900">8:00 AM · BP medicine</p>
            <p className="text-[12.5px] text-ink-600">After breakfast</p>
          </div>
        </div>
        <Bubble from="meera" lang="hi">
          हाँ, ले ली।
        </Bubble>
        <span className={`${chip} bg-ok-600/10 text-ok-600`}>
          <Check className="h-3.5 w-3.5" aria-hidden /> You said you took it · 8:04
        </span>
      </div>
    ),
  },
  {
    id: 'books',
    n: '02',
    title: 'Books the doctor',
    hi: '“अगले हफ्ते डॉक्टर मेहता से सुबह का अपॉइंटमेंट बुक कर दो।”',
    body: 'She reads the request back, asks permission, then phones the clinic herself, in Hindi or English, and comes back with a real slot.',
    control: 'Two approvals. Confirmed only after the clinic confirms.',
    pose: 'calling',
    icon: <PhoneCall className="h-5 w-5" aria-hidden />,
    vignette: (
      <div className="space-y-2.5">
        <div className="flex items-center gap-3 rounded-2xl bg-teal-900 p-3 text-ivory-50">
          <span className="lp-pulse grid h-10 w-10 place-items-center rounded-full bg-sea-500/30">
            <Phone className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold">Calling Dr. Mehta Clinic</p>
            <p className="flex items-end gap-[3px] pt-1" aria-hidden>
              {[6, 12, 8, 14, 7, 11, 5, 13, 9].map((h, i) => (
                <span key={i} className="lp-callwave w-[3px] rounded-full bg-sea-200" style={{ height: h, animationDelay: `${-i * 0.15}s` }} />
              ))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
          <div className="w-12 shrink-0 overflow-hidden rounded-lg border border-line text-center">
            <p className="bg-teal-700 text-[10px] font-bold tracking-wider text-white uppercase">Thu</p>
            <p className="py-0.5 font-display text-lg leading-tight text-ink-900">8</p>
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-ink-900">10:30 AM · Dr. Mehta</p>
            <p className="text-[12.5px] text-ink-600">Should I confirm?</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'checks',
    n: '03',
    title: 'Checks in',
    hi: '“नमस्ते मीरा जी! आज कैसा लग रहा है?”',
    body: 'A gentle daily hello at the time Meera agreed to. If she says “not now”, Nami lets it be: no guilt, no sad face.',
    control: 'No answer? The ladder Meera agreed to runs. Voicemail never counts as an answer.',
    pose: 'greeting',
    icon: <Sun className="h-5 w-5" aria-hidden />,
    vignette: (
      <div className="space-y-2.5">
        <span className={`${chip} bg-warn-600/10 text-warn-600`}>
          <Sun className="h-3.5 w-3.5" aria-hidden /> 10:00 · daily check-in
        </span>
        <Bubble from="nami" lang="hi">
          नमस्ते मीरा जी! आज कैसा लग रहा है?
        </Bubble>
        <Bubble from="meera" lang="hi">
          अच्छा है बेटा, बस थोड़ी थकान है।
        </Bubble>
      </div>
    ),
  },
  {
    id: 'people',
    n: '04',
    title: 'Gets your people',
    hi: '“मदद!” — or one big red button',
    body: 'Help starts the ladder at once: Arjun first, then Priya. Meera sees truthful progress: contacting, no answer, accepted.',
    control: 'A person has to accept. 112 is on screen the whole time.',
    pose: 'help',
    icon: <Users className="h-5 w-5" aria-hidden />,
    vignette: (
      <div className="space-y-2">
        {[
          { name: 'Arjun', rel: 'son · Bengaluru', state: 'Accepted · checking now', ok: true },
          { name: 'Priya', rel: 'daughter · Pune', state: 'Next if needed', ok: false },
        ].map((p) => (
          <div key={p.name} className="flex items-center gap-3 rounded-2xl bg-card p-2.5 shadow-sm">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-cocoa-300/40 font-display text-[15px] text-cocoa-500">{p.name[0]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink-900">
                {p.name} <span className="font-normal text-ink-600">· {p.rel}</span>
              </p>
              <p className={`flex items-center gap-1 text-[12.5px] ${p.ok ? 'font-semibold text-ok-600' : 'text-ink-600'}`}>
                {p.ok ? <UserCheck className="h-3.5 w-3.5" aria-hidden /> : null}
                {p.state}
              </p>
            </div>
          </div>
        ))}
        <p className="flex items-center justify-between rounded-2xl border border-help-600/30 bg-help-600/[0.06] px-3 py-2 text-[13px] text-help-600">
          <span>Emergency?</span>
          <span className="font-bold">Call 112</span>
        </p>
      </div>
    ),
  },
];

export function Jobs() {
  return (
    <section id="how" aria-labelledby="jobs-title" className="relative scroll-mt-4 bg-ivory-100 pt-10 pb-20 sm:pt-14 sm:pb-24">
      <Container>
        <div className="max-w-[46rem]">
          <Eyebrow>What Nami does</Eyebrow>
          <SectionTitle className="mt-4">
            <span id="jobs-title">Four jobs. Each one ends with a real person, or real proof.</span>
          </SectionTitle>
          <p className="mt-5 max-w-[40em] text-lg leading-relaxed text-ink-600">
            Most AI companions try to be the friend. Nami is the one who makes sure the real friends, family and doctor show up.
          </p>
        </div>

        <ol className="mt-12 space-y-5 sm:mt-14 lg:space-y-6">
          {JOBS.map((job, i) => (
            <li key={job.id} className="relative">
              <NamiSlot id={`job-${job.id}`} pose={job.pose} className={`${LANE_LEFT} top-[calc(50%-84px)]`} />
              <InView className="h-full" amount={0.3}>
                <article className="lp-rise relative grid gap-6 overflow-hidden rounded-[26px] border border-line/70 bg-card/80 p-6 shadow-[0_8px_30px_rgba(23,61,56,0.06)] backdrop-blur sm:p-8 md:grid-cols-[minmax(0,1fr)_290px] md:items-center md:gap-10">
                  <div>
                    <NamiSlot id={`job-${job.id}-m`} pose={job.pose} className="absolute top-2 right-2 h-[92px] w-[92px] xl:hidden" />
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-900 text-ivory-50">{job.icon}</span>
                      <span className="font-display text-sm text-ink-600/70 tabular-nums">{job.n}</span>
                    </div>
                    <h3 className="lp-display mt-6 pr-16 font-display sm:mt-4 sm:pr-0 text-[clamp(1.6rem,2.6vw,2.1rem)] leading-tight font-medium text-teal-900">{job.title}</h3>
                    <p lang="hi" className="mt-1.5 font-display text-[17px] text-cocoa-500">
                      {job.hi}
                    </p>
                    <p className="mt-3 max-w-[34em] text-[16.5px] leading-relaxed text-ink-600">{job.body}</p>
                    <p className="mt-4 inline-flex items-start gap-2 rounded-2xl bg-sea-200/60 px-3.5 py-2.5 text-[15px] leading-snug font-medium text-teal-900">
                      <ShieldCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-teal-700" aria-hidden />
                      {job.control}
                    </p>
                  </div>
                  <div
                    className="relative rounded-[22px] bg-ivory-100 p-4"
                    style={{ ['--d' as string]: `${120 + i * 40}ms` }}
                    aria-label={`Example: ${job.title}`}
                    role="img"
                  >
                    <div aria-hidden>{job.vignette}</div>
                  </div>
                </article>
              </InView>
            </li>
          ))}
        </ol>
        <p className="mt-8 flex items-center gap-2 text-[14px] text-ink-600">
          <CalendarCheck2 className="h-4 w-4 text-teal-700" aria-hidden />
          Every action also works with big buttons and keyboard shortcuts. Voice is never the only way.
        </p>
      </Container>
    </section>
  );
}

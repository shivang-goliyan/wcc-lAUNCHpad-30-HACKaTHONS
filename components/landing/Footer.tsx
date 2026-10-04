import { ArrowRight, BadgeInfo, CheckCheck, MicOff, PhoneCall, Stethoscope } from 'lucide-react';
import { Logo } from './Hero';
import { NamiSlot } from './NamiSlot';
import { Container, LANE_RIGHT } from './ui';

const TRUST = [
  { icon: BadgeInfo, title: 'Says she’s an AI', body: 'In her first hello, on every call, and whenever asked.' },
  { icon: CheckCheck, title: 'Two-step approvals', body: 'Propose, then confirm, checked against the person’s own words.' },
  { icon: Stethoscope, title: 'No diagnosis, no dosing', body: 'Logistics and connection only. No health score.' },
  { icon: MicOff, title: 'No raw audio stored', body: 'Memories are kept only with spoken consent, and can be deleted.' },
  { icon: PhoneCall, title: '112 and Tele-MANAS 14416', body: 'Shown in every help flow, every time.' },
];

export function Trust() {
  return (
    <section aria-labelledby="trust-title" className="relative bg-ivory-50 py-16 sm:py-20">
      <Container>
        <h2 id="trust-title" className="text-[13px] font-semibold tracking-[0.16em] text-teal-700 uppercase">
          Built to be trusted
        </h2>
        <ul className="mt-6 grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-5">
          {TRUST.map((t) => (
            <li key={t.title} className="flex gap-3.5 lg:flex-col lg:gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-card text-teal-900">
                <t.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-[16px] leading-snug font-semibold text-ink-900">{t.title}</h3>
                <p className="mt-1 text-[14px] leading-snug text-ink-600">{t.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

const STARS = Array.from({ length: 42 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  return { x: (a - Math.floor(a)) * 100, y: (b - Math.floor(b)) * 70, r: i % 7 === 0 ? 1.8 : 1.1, d: (i % 9) * -0.4 };
});

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-teal-900 text-ivory-50">
      {/* night sky, mirrored from the hero's morning */}
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {STARS.map((s, i) => (
          <circle key={i} className="lp-twinkle" cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#F7F3EA" style={{ animationDelay: `${s.d}s` }} />
        ))}
      </svg>
      <svg aria-hidden viewBox="0 0 60 60" className="absolute top-14 left-[7%] h-12 w-12 opacity-90 sm:top-16 sm:h-16 sm:w-16">
        <path d="M40 8 A24 24 0 1 0 52 44 A20 20 0 1 1 40 8 Z" fill="#F4E9D2" />
      </svg>
      <svg aria-hidden viewBox="0 0 1600 40" preserveAspectRatio="none" className="absolute inset-x-0 top-[-1px] h-[30px] w-full">
        <path d="M0 0 H1600 V14 C1400 30 1200 8 1000 20 C800 32 600 10 400 22 C220 32 100 16 0 24 Z" fill="#F7F3EA" />
      </svg>

      <Container className="pt-28 pb-12 sm:pt-32">
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <NamiSlot id="footer-lane" pose="quiet" className={`${LANE_RIGHT} top-0`} />
          <div>
            <p className="lp-display max-w-[16em] font-display text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.05] font-medium text-balance">
              Nami doesn&rsquo;t replace family. <span className="text-sea-500 italic">She makes sure they show up.</span>
            </p>
            <a
              href="/try"
              className="group mt-8 inline-flex min-h-14 items-center gap-2 rounded-full bg-ivory-50 px-7 text-[17px] font-semibold text-teal-900 transition hover:-translate-y-0.5 hover:bg-white"
            >
              Try the live demo as Meera
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" aria-hidden />
            </a>
          </div>
          <NamiSlot id="footer-side" pose="quiet" className="relative -mb-4 h-[150px] w-[150px] justify-self-end sm:h-[180px] sm:w-[180px] xl:hidden" />
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Logo tone="dark" />
            <span className="text-[14px] text-sea-200/80">Built for WCC Launchpad 30 · Agentic AI track</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] font-medium">
            <a href="/try" className="text-ivory-50/90 hover:text-ivory-50">
              Live demo
            </a>
            <a href="/console" className="text-ivory-50/90 hover:text-ivory-50">
              Agent console
            </a>
            {/* TODO(team): real repository URL */}
            <a href="#" className="text-ivory-50/90 hover:text-ivory-50">
              GitHub
            </a>
          </nav>
        </div>
        <p className="mt-8 max-w-[60em] text-[12px] leading-relaxed text-sea-200/60">
          Sources: LASI Wave 1 (Longitudinal Ageing Study in India) factsheet; HelpAge India 2025 report (urban, n = 5,798). Nami is
          not a medical service and does not give medical advice. In an emergency call 112; for mental-health support, Tele-MANAS
          14416. Personas and phone numbers in the demo are fictional.
        </p>
      </Container>
    </footer>
  );
}

import { ArrowRight } from 'lucide-react';
import { InView } from './InView';
import { NamiSlot } from './NamiSlot';

// every number here is in research/evidence-2026.md with its source, year and n
const FACTS = [
  { big: '1 in 4', text: 'Indian elders have no child living at home.', src: 'LASI Wave 1 (5.7% alone + 20.3% with spouse/others)', tone: 'sb-yellow', tilt: '-2deg' },
  { big: '48%', text: 'struggle with at least one daily task, a list that includes making phone calls and taking medicines.', src: 'LASI Wave 1', tone: 'sb-blue', tilt: '1.5deg' },
  { big: '8.3%', text: 'of elders have depression when measured. Only 0.8% are ever diagnosed.', src: 'LASI Wave 1', tone: '', tilt: '-1deg' },
  { big: '66% → 22%', text: 'missed hypertension visits fell when a health worker followed up. Follow-up works; nobody is doing it.', src: 'BMJ Open Quality 2025, Madhya Pradesh', tone: 'sb-pink', tilt: '2deg' },
];

const PROMISES = [
  'She always says she is an AI.',
  'No diagnosis, no dosing advice. Ever.',
  'Two yeses before any call or booking.',
  'Real calls go only to numbers the family allows.',
  'Two crisis checks that don’t depend on the AI.',
  '112 and Tele-MANAS 14416 on every help screen.',
];

export function NotesSection() {
  return (
    <section id="why" aria-labelledby="why-title" className="sb-paper relative py-20 sm:py-24">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <p className="font-hand text-[20px] text-cocoa-500">why this matters</p>
        <h2 id="why-title" className="mt-2 max-w-[17em] font-display text-[clamp(2rem,4vw,3.2rem)] leading-[1.06] font-medium text-teal-900 text-balance">
          Reminders exist. What nobody does is the follow-through.
        </h2>

        <InView amount={0.2} className="mt-12 grid items-start gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((f, i) => (
            <figure key={f.big} className={`sb-note lp-rise relative rounded-sm p-5 ${f.tone} ${i % 2 ? 'lg:mt-10' : ''}`} style={{ ['--tilt' as string]: f.tilt, ['--d' as string]: `${i * 120}ms` }}>
              <p className="font-display text-[clamp(2rem,3.4vw,2.7rem)] leading-none font-semibold text-teal-900">{f.big}</p>
              <p className="mt-3 text-[16px] leading-snug text-ink-900">{f.text}</p>
              <figcaption className="mt-3 text-[12px] text-ink-600">Source: {f.src}</figcaption>
            </figure>
          ))}
        </InView>

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="sb-note sb-tape relative rounded-sm bg-[repeating-linear-gradient(#fffaf0_0_31px,#e9dcc6_31px_32px)] p-6 pt-7" style={{ ['--tilt' as string]: '-0.8deg' }}>
            <p className="font-hand text-[22px] font-bold text-teal-900">Nami&rsquo;s promises</p>
            <ul className="font-hand mt-2 space-y-[3px] text-[20px] leading-[29px] text-ink-900">
              {PROMISES.map((p) => (
                <li key={p}>✓ {p}</li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <NamiSlot id="why-nami" pose="celebrate" say="Try it yourself! You'll be Meera ji." className="relative mx-auto aspect-square w-[min(70%,260px)]" />
            <div className="mt-2 text-center">
              <p className="font-display text-[clamp(1.6rem,2.6vw,2.2rem)] leading-tight text-teal-900">Spend a morning as Meera ji.</p>
              <p className="mt-2 text-[16px] text-ink-600">No sign-up. Your own private demo home, with a simulated clinic.</p>
              <a
                href="/try"
                className="group mt-5 inline-flex min-h-14 items-center gap-2 rounded-full bg-cocoa-500 px-7 text-[17px] font-semibold text-ivory-50 shadow-[0_12px_28px_rgba(140,80,50,0.28)] transition hover:-translate-y-0.5 hover:bg-[#7a4a32]"
              >
                Try the live demo
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

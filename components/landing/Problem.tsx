import { CountUp } from './CountUp';
import { InView } from './InView';
import { NamiSlot } from './NamiSlot';
import { Container, Eyebrow, LANE_LEFT, SectionTitle, Source } from './ui';

/**
 * TODO(team): replace with a real quote from tonight's interviews (PRD §2:
 * "Record quotes with permission… do not invent any of it"). The card only
 * renders while this is non-null.
 */
const QUOTE: { text: string; who: string } | null = null;

const CARD = 'lp-rise relative flex flex-col rounded-[24px] border border-line/80 bg-card p-6 shadow-[0_8px_30px_rgba(23,61,56,0.07)] sm:p-7';

export function Problem() {
  return (
    <section id="problem" aria-labelledby="problem-title" className="relative bg-ivory-50 pt-16 pb-10 sm:pt-24 lg:pt-28">
      <Container>
        <div className="max-w-[44rem]">
          <Eyebrow>The problem</Eyebrow>
          <SectionTitle className="mt-4">
            <span id="problem-title">Parents are growing old far from their children. Most of what they need goes unseen.</span>
          </SectionTitle>
          <p className="mt-5 max-w-[38em] text-lg leading-relaxed text-ink-600">
            Today, when Mummy doesn&rsquo;t pick up, the family&rsquo;s &ldquo;system&rdquo; is calling a neighbour.
          </p>
        </div>

        <InView className="relative mt-24 grid gap-5 md:mt-16 md:grid-cols-3 lg:gap-6" amount={0.2}>
          {/* Nami points at the numbers from the left lane (xl) / peeks over the first card (mobile). */}
          <NamiSlot id="problem-lane" pose="point-right" className={`${LANE_LEFT} top-[calc(50%-84px)]`} />

          <article className={CARD} style={{ ['--d' as string]: '0ms' }}>
            <NamiSlot id="problem-peek" pose="peek" className="absolute right-5 bottom-full h-[132px] w-[132px] xl:hidden" />
            <p className="lp-display font-display text-[clamp(3.2rem,6vw,4.4rem)] leading-none font-medium text-teal-900">1 in 4</p>
            <h3 className="mt-3 text-[19px] leading-snug font-semibold text-ink-900">Indian elders have no child living at home.</h3>
            <div className="mt-6" aria-hidden>
              <div className="flex h-3 overflow-hidden rounded-full bg-ivory-100">
                <span className="lp-grow h-full bg-teal-900" style={{ width: '5.7%' }} />
                <span className="lp-grow h-full bg-sea-500" style={{ width: '20.3%', ['--d' as string]: '300ms' }} />
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[14px] text-ink-600">
              <div>
                <dt className="flex items-start gap-1.5">
                  <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full bg-teal-900" aria-hidden /> Live alone
                </dt>
                <dd className="mt-0.5 text-xl font-semibold text-ink-900">
                  <CountUp to={5.7} decimals={1} suffix="%" />
                </dd>
              </div>
              <div>
                <dt className="flex items-start gap-1.5">
                  <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full bg-sea-500" aria-hidden /> Spouse or others only
                </dt>
                <dd className="mt-0.5 text-xl font-semibold text-ink-900">
                  <CountUp to={20.3} decimals={1} suffix="%" delay={0.2} />
                </dd>
              </div>
            </dl>
            <div className="mt-auto pt-6">
              <Source>LASI Wave 1</Source>
            </div>
          </article>

          <article className={CARD} style={{ ['--d' as string]: '120ms' }}>
            <p className="lp-display font-display text-[clamp(3.2rem,6vw,4.4rem)] leading-none font-medium text-teal-900">
              <CountUp to={8.3} decimals={1} suffix="%" />
            </p>
            <h3 className="mt-3 text-[19px] leading-snug font-semibold text-ink-900">
              have depression when measured, but only 0.8% are diagnosed.
            </h3>
            <div className="mt-6 space-y-3 text-[14px] text-ink-600">
              <div>
                <div className="flex justify-between">
                  <span>Measured</span>
                  <span className="font-semibold text-ink-900">8.3%</span>
                </div>
                <div className="mt-1.5 h-3 rounded-full bg-ivory-100" aria-hidden>
                  <span className="lp-grow block h-full rounded-full bg-cocoa-500" style={{ width: '100%', ['--d' as string]: '150ms' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span>Diagnosed</span>
                  <span className="font-semibold text-ink-900">0.8%</span>
                </div>
                <div className="mt-1.5 h-3 rounded-full bg-ivory-100" aria-hidden>
                  <span className="lp-grow block h-full rounded-full bg-cocoa-300" style={{ width: `${(0.8 / 8.3) * 100}%`, ['--d' as string]: '450ms' }} />
                </div>
              </div>
            </div>
            <p className="mt-4 text-[15px] text-ink-600">Most of the need is invisible.</p>
            <div className="mt-auto pt-6">
              <Source>LASI Wave 1</Source>
            </div>
          </article>

          <article className={CARD} style={{ ['--d' as string]: '240ms' }}>
            <div className="flex items-start justify-between gap-4">
              <p className="lp-display font-display text-[clamp(3.2rem,6vw,4.4rem)] leading-none font-medium text-teal-900">
                <CountUp to={41} suffix="%" />
              </p>
              <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90" aria-hidden>
                <circle cx="32" cy="32" r="26" fill="none" stroke="#EFE8D9" strokeWidth="9" />
                <circle
                  className="lp-ring"
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="#80A99B"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * 0.59}`}
                  style={{ ['--ring-empty' as string]: `${2 * Math.PI * 26}`, ['--ring-full' as string]: `${2 * Math.PI * 26 * 0.59}` }}
                />
              </svg>
            </div>
            <h3 className="mt-3 text-[19px] leading-snug font-semibold text-ink-900">of urban older adults own a smartphone. 13% use the internet.</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-600">
              So nobody has to type or find an app: Nami listens and talks, and every action is also a big button.
            </p>
            <div className="mt-auto pt-6">
              <Source>HelpAge India 2025 · urban, n = 5,798</Source>
            </div>
          </article>
        </InView>

        {QUOTE ? (
          <figure className="mx-auto mt-14 max-w-3xl rounded-[24px] bg-ivory-100 p-8 text-center">
            <blockquote className="font-display text-2xl leading-snug text-teal-900">&ldquo;{QUOTE.text}&rdquo;</blockquote>
            <figcaption className="mt-4 text-sm text-ink-600">{QUOTE.who}</figcaption>
          </figure>
        ) : null}
      </Container>
    </section>
  );
}

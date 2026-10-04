import { Check, Circle } from 'lucide-react';
import { InView } from './InView';
import { NamiSlot } from './NamiSlot';

/**
 * Two homes, one thread: Meera in Jaipur, Arjun in Bengaluru. When her check-in goes
 * unanswered, the thread pulls tight and someone has to say "I've got it".
 */
export function TwoHomes() {
  return (
    <section id="family" aria-labelledby="family-title" className="relative bg-[#fbf7ef] py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <p className="font-hand text-[20px] text-cocoa-500">when she doesn&rsquo;t answer</p>
        <h2 id="family-title" className="mt-2 max-w-[19em] font-display text-[clamp(2rem,4vw,3.3rem)] leading-[1.06] font-medium text-teal-900 text-balance">
          A notification isn&rsquo;t enough. Someone has to say, &ldquo;I&rsquo;ve got&nbsp;it.&rdquo;
        </h2>
        <p className="mt-4 max-w-[40em] text-[18px] leading-relaxed text-ink-600">
          If Meera misses her check-in, Nami asks again, then follows the plan she agreed to. Arjun is asked first, then Priya.
          The case only closes when a person accepts it. Nobody is ever marked &ldquo;safe&rdquo; by a machine.
        </p>
      </div>

      <InView amount={0.3} className="relative mx-auto mt-12 max-w-[1440px] sm:px-6">
        <div className="relative grid grid-cols-1 overflow-hidden sm:grid-cols-2 sm:rounded-[28px]">
          <figure className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/scenes/home-jaipur.webp" alt="Meera ji at her table in Jaipur with a cup of chai" loading="lazy" className="aspect-[4/5] w-full object-cover sm:aspect-auto sm:h-[620px]" />
            <figcaption className="font-hand absolute top-4 left-4 rounded-sm bg-[#fff6dd]/95 px-3 py-1 text-[17px] text-ink-900 shadow">Meera ji · Jaipur · 10:00</figcaption>
            <div className="sb-note absolute bottom-6 left-4 max-w-[17rem] rounded-md p-4 sm:left-6" style={{ ['--tilt' as string]: '-1.5deg' }}>
              <p className="text-[15px] text-teal-900">
                <span className="font-semibold">Nami:</span> Meera ji, are you there?
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded bg-[#f6ead2] px-2 py-1 text-[13px] font-semibold text-[#7a531a]">
                <Circle className="h-3 w-3 fill-current" aria-hidden /> No answer yet · asked again at 10:15
              </p>
            </div>
          </figure>
          <figure className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/scenes/home-bengaluru.webp" alt="Arjun at his desk in Bengaluru, looking at his phone" loading="lazy" className="aspect-[4/5] w-full object-cover sm:aspect-auto sm:h-[620px]" />
            <figcaption className="font-hand absolute top-4 right-4 rounded-sm bg-[#dbe7f0]/95 px-3 py-1 text-[17px] text-ink-900 shadow">Arjun · Bengaluru · 10:31</figcaption>
            <div className="absolute right-4 bottom-6 w-[min(20rem,calc(100%-2rem))] rounded-2xl bg-white/95 p-4 shadow-[0_18px_40px_rgba(20,40,60,0.25)] backdrop-blur sm:right-6">
              <p className="text-[12px] font-semibold tracking-wide text-ink-600 uppercase">Raynet · now</p>
              <p className="mt-1 text-[15.5px] leading-snug text-ink-900">Ma hasn&rsquo;t answered her 10:00 check-in. Can you check on her?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <span className="rounded-lg bg-teal-900 py-2 text-center text-[14px] font-semibold text-ivory-50">I&rsquo;ll check</span>
                <span className="rounded-lg border border-line py-2 text-center text-[14px] font-semibold text-ink-600">I can&rsquo;t</span>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-[#1f5a3b]">
                <Check className="h-4 w-4" aria-hidden /> Accepted by Arjun · calling Ma
              </p>
            </div>
          </figure>

          {/* the red thread between her phone and his */}
          <svg aria-hidden viewBox="0 0 1000 620" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block">
            <path
              className="sb-thread"
              style={{ ['--len' as string]: '1300' }}
              d="M 225 470 C 330 520, 420 300, 500 330 S 680 470, 760 300"
              fill="none"
              stroke="#c0392b"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </svg>
          <NamiSlot id="family-seam" pose="heart" say="I hold the thread. Arjun says yes." className="absolute top-[30%] left-1/2 hidden h-[190px] w-[190px] -translate-x-1/2 sm:block" />
        </div>
      </InView>

      <div className="mx-auto mt-10 grid max-w-[1080px] gap-4 px-5 sm:grid-cols-3 sm:px-8">
        {[
          { img: 'arjun', who: 'Arjun · son · Bengaluru', state: 'Asked first. Accepted at 10:31.', ok: true },
          { img: 'priya', who: 'Priya · daughter · Pune', state: 'Asked next, only if Arjun can’t.', ok: false },
          { img: 'meera', who: 'Meera ji', state: 'Answers late? The case closes itself, no fuss.', ok: false },
        ].map((p) => (
          <div key={p.who} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-line/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/people/${p.img}-160.webp`} alt="" className="h-14 w-14 rounded-[16px] object-cover" />
            <div>
              <p className="text-[15px] font-semibold text-teal-900">{p.who}</p>
              <p className={`text-[14px] ${p.ok ? 'font-semibold text-[#1f5a3b]' : 'text-ink-600'}`}>{p.state}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-[1080px] px-5 text-[15px] text-ink-600 sm:px-8">
        In the demo your own phone can be Arjun: scan the QR code on Meera&rsquo;s screen and press &ldquo;I&rsquo;ll check&rdquo;.
      </p>
    </section>
  );
}

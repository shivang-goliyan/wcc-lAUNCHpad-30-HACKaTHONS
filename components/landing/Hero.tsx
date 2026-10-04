import { ArrowRight } from 'lucide-react';
import { Birds, LakeScene, NearWater, Rock } from './LakeScene';
import { NamiSlot } from './NamiSlot';
import { ScrollLink } from './ScrollLink';
import { BTN_PRIMARY, BTN_SECONDARY } from './ui';

export function Logo({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
        <circle cx="14" cy="14" r="13" fill={tone === 'light' ? '#173D38' : '#F7F3EA'} />
        <path d="M7 16 q3.5 -4 7 0 t7 0" stroke={tone === 'light' ? '#A9D3C9' : '#173D38'} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M8 20 q3 -3 6 0 t6 0" stroke={tone === 'light' ? '#80A99B' : '#24564F'} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.8" />
        <path d="M17 6.5 c2.6 0.4 3.8 2.4 3.4 4.6 c-2.4 -0.2 -3.8 -2 -3.4 -4.6Z" fill="#80A99B" />
      </svg>
      <span className={`font-display text-[21px] font-semibold tracking-tight ${tone === 'light' ? 'text-teal-900' : 'text-ivory-50'}`}>
        Nami Care
      </span>
    </span>
  );
}

function Nav() {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 pt-5 sm:px-8 lg:pt-7">
      <a href="#top" className="rounded-lg" aria-label="Nami Care home">
        <Logo />
      </a>
      <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
        <ScrollLink to="how" className="hidden rounded-full px-4 py-2 text-[15px] font-medium text-teal-900/85 transition hover:bg-card/60 hover:text-teal-900 md:inline-flex">
          How it works
        </ScrollLink>
        <ScrollLink to="families" className="hidden rounded-full px-4 py-2 text-[15px] font-medium text-teal-900/85 transition hover:bg-card/60 hover:text-teal-900 md:inline-flex">
          For families
        </ScrollLink>
        <a href="/console" className="hidden rounded-full px-4 py-2 text-[15px] font-medium text-teal-900/85 transition hover:bg-card/60 hover:text-teal-900 lg:inline-flex">
          Agent console
        </a>
        <a
          href="/try"
          className="ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-teal-900 px-4 text-[15px] font-semibold text-ivory-50 transition hover:bg-teal-700"
        >
          Try the demo <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      </nav>
    </header>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden" aria-labelledby="hero-title">
      {/* sky */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{
          background:
            'radial-gradient(ellipse 50% 42% at 80% 26%, rgba(255,246,228,0.95), rgba(255,246,228,0) 70%), linear-gradient(180deg, #DCE7E2 0%, #E9EDE6 30%, #F4EEE2 58%, #F1E6D4 100%)',
        }}
      />
      <Birds className="absolute right-[16%] top-[16%] -z-10 w-[120px] opacity-80 sm:w-[150px]" />
      {/* landscape */}
      <LakeScene className="absolute inset-x-0 bottom-0 -z-10 h-[44%] w-full sm:h-[54%] lg:h-[66%]" />
      {/* soft light behind the copy keeps contrast high on any width */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 62% 70% at 18% 42%, rgba(247,243,234,0.92) 0%, rgba(247,243,234,0.6) 45%, rgba(247,243,234,0) 75%)',
        }}
      />
      <NearWater className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[92px] lg:h-[112px]" />
      {/* the shore of the next section */}
      <svg aria-hidden viewBox="0 0 1600 40" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-[-1px] z-20 h-[26px] w-full lg:h-[34px]">
        <path d="M0 22 C200 6 380 34 600 20 C820 6 1000 30 1200 18 C1380 8 1500 22 1600 14 V40 H0 Z" fill="#F7F3EA" />
      </svg>

      <Nav />

      <div className="relative z-10 mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-1 gap-2 px-5 pb-[56px] sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,36%)] lg:gap-6 lg:pb-[50px]">
        <div className="self-center pt-8 pb-10 lg:pt-0 lg:pb-16">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-900/10 bg-card/70 px-3.5 py-1.5 text-[13px] font-medium text-teal-900 backdrop-blur sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-ok-600" aria-hidden />
            An AI companion for parents who live alone
          </p>
          <h1
            id="hero-title"
            className="lp-display max-w-[13.5em] font-display text-[clamp(2.25rem,5.6vw,4.6rem)] leading-[1.02] font-medium text-teal-900 text-balance"
          >
            Your parent&rsquo;s gentle companion — <em className="font-normal text-teal-700 italic">who actually gets things&nbsp;done.</em>
          </h1>
          <p lang="hi" className="mt-4 font-display text-[clamp(1.2rem,2.2vw,1.7rem)] leading-snug text-cocoa-500">
            आपके माता-पिता की साथी — जो काम भी करवाती है।
          </p>
          <p className="mt-5 max-w-[34em] text-[17px] leading-relaxed text-ink-600 sm:text-lg">
            Nami chats with them in Hindi or English, reminds them, phones the clinic with their OK, and makes sure a real
            person follows up when something&rsquo;s wrong.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="/try" className={BTN_PRIMARY}>
              Try the live demo as Meera
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" aria-hidden />
            </a>
            <ScrollLink to="how" className={BTN_SECONDARY}>
              See how it works
            </ScrollLink>
          </div>
          <p className="mt-4 text-[13px] text-ink-600/90">No sign-up. The clinic in the demo is simulated, and labelled that way.</p>
        </div>

        {/* Nami's rock. The slot is the exact box she sits in; RoamingNami takes it from here. */}
        <div className="relative ml-auto w-[min(52vw,230px)] self-end sm:w-[min(40vw,260px)] lg:mr-[2%] lg:w-[min(30vw,400px)]">
          <NamiSlot id="hero" pose="greeting" hero className="relative z-10 mx-auto aspect-square w-[86%]" />
          <Rock className="relative -mt-[19%] w-full" />
        </div>
      </div>

      {/* Swim lane along the near water: she slides off the rock and swims out of the hero. */}
      <NamiSlot id="hero-swim" pose="swim" path className="absolute inset-x-0 z-20 bottom-[38px] h-[108px] lg:bottom-[44px] lg:h-[150px]" />
    </section>
  );
}

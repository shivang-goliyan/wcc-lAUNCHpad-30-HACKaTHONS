import { ArrowRight } from 'lucide-react';
import { HeroBubble } from './HeroBubble';
import { NamiSlot } from './NamiSlot';
import { ScrollLink } from './ScrollLink';

/**
 * Hero as a family scrapbook: the painted desk is the background, and the notes,
 * headline and Nami sit on it as real, readable, translatable HTML.
 */
export function ScrapHero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="sb-paper relative isolate overflow-hidden">
      {/* painted desk: letter, photo prints, chai, jasmine */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/scenes/hero-scrapbook.webp"
        srcSet="/scenes/hero-scrapbook-sm.webp 960w, /scenes/hero-scrapbook.webp 1920w"
        sizes="100vw"
        alt=""
        aria-hidden
        fetchPriority="high"
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[60%_40%]"
      />
      {/* paper fades the painting under the headline, so text always reads */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(246,239,226,0.55)_0%,rgba(246,239,226,0.25)_40%,rgba(246,239,226,0)_60%)] lg:bg-none" />

      <nav aria-label="Main" className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 pt-6 sm:px-8">
        <a href="#top" className="flex items-baseline gap-3 rounded-lg" aria-label="Raynet home">
          <span className="font-display text-[28px] font-semibold tracking-tight text-teal-900">Raynet</span>
          <span className="font-hand hidden text-[17px] text-cocoa-500 sm:inline">with Nami</span>
        </a>
        <div className="flex items-center gap-1 rounded-full bg-[#f6efe2]/85 py-1 pr-1 pl-3 text-[15px] font-medium text-teal-900 shadow-[0_4px_16px_rgba(70,45,20,0.10)] backdrop-blur sm:gap-4">
          <ScrollLink to="day" className="hidden rounded-md px-2 py-1 hover:underline sm:inline">
            A day with Nami
          </ScrollLink>
          <ScrollLink to="family" className="hidden rounded-md px-2 py-1 hover:underline sm:inline">
            For families
          </ScrollLink>
          <a href="/console" className="hidden rounded-md px-2 py-1 hover:underline md:inline">
            How the agents work
          </a>
          <a href="/try" className="rounded-full bg-teal-900 px-4 py-2 text-ivory-50 transition hover:bg-teal-700">
            Try it
          </a>
        </div>
      </nav>

      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-8 px-5 pt-12 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-16 lg:pb-28">
        <div className="relative max-w-[36rem]">
          <p className="font-hand text-[20px] text-cocoa-500">
            <span lang="hi">साथ हर दिन</span> · company, every day
          </p>
          <h1 id="hero-title" className="mt-3 font-display text-[clamp(2.5rem,5.2vw,4.4rem)] leading-[1.02] font-medium tracking-[-0.015em] text-teal-900 text-balance">
            Nami keeps them company.{' '}
            <em className="font-normal text-cocoa-500 italic">Raynet makes sure someone shows&nbsp;up.</em>
          </h1>
          <p className="mt-6 max-w-[33em] text-[18px] leading-relaxed text-ink-600">
            A gentle AI companion for parents who live alone. She chats in Hindi or English, reminds them, phones the clinic
            with their OK, and when something&rsquo;s wrong, makes sure a real person in the family follows up.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <a
              href="/try"
              className="group inline-flex min-h-14 items-center gap-2 rounded-full bg-cocoa-500 px-7 text-[17px] font-semibold text-ivory-50 shadow-[0_12px_28px_rgba(140,80,50,0.28)] transition hover:-translate-y-0.5 hover:bg-[#7a4a32] active:translate-y-0"
            >
              Try the demo as Meera
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" aria-hidden />
            </a>
            <ScrollLink to="day" className="font-hand text-[19px] text-teal-900 underline decoration-cocoa-300 decoration-2 underline-offset-4 hover:decoration-cocoa-500">
              or see a day with Nami ↓
            </ScrollLink>
          </div>
          <p className="mt-5 text-[13px] text-ink-600/90">No sign-up. The clinic in the demo is simulated, and labelled that way.</p>
        </div>

        {/* the notes Nami keeps, and Nami herself */}
        <div className="relative min-h-[420px] lg:min-h-[520px]">
          <div className="sb-note sb-yellow sb-tape absolute top-2 left-[2%] w-[200px] rounded-sm p-4 sm:left-[6%]" style={{ ['--tilt' as string]: '-4deg' }}>
            <p className="font-hand text-[19px] leading-snug text-ink-900">
              Ma, call me after your BP tablet.
              <br />— Arjun ♥
            </p>
          </div>
          <div className="sb-note sb-pink absolute right-[2%] bottom-[6%] w-[190px] rounded-sm p-4 sm:right-[4%]" style={{ ['--tilt' as string]: '3deg' }}>
            <p lang="hi" className="font-hand text-[20px] leading-snug text-ink-900">
              अपना ख्याल रखना, माँ।
            </p>
            <p className="font-hand mt-1 text-[14px] text-ink-600">(take care of yourself, Ma) — Priya</p>
          </div>
          <div className="sb-note sb-tape absolute bottom-[10%] left-0 hidden w-[230px] rounded-sm p-4 sm:block" style={{ ['--tilt' as string]: '-2deg', ['--tape' as string]: '-4deg' }}>
            <p className="font-hand text-[16px] font-bold text-teal-900">Meera ji&rsquo;s day</p>
            <ul className="font-hand mt-1 space-y-0.5 text-[17px] text-ink-900">
              <li>☐ BP tablet · 9:00</li>
              <li>☐ water · 11:30</li>
              <li>☐ Dr. Mehta · Tue 9:30</li>
              <li>☐ evening walk · 5:30</li>
            </ul>
          </div>
          <div className="absolute top-[14%] right-[6%] w-[min(62%,330px)]">
            <HeroBubble />
            <NamiSlot id="hero" pose="greeting" hero className="relative z-10 aspect-square w-full" />
          </div>
        </div>
      </div>
      {/* torn paper edge into the next section */}
      <svg aria-hidden viewBox="0 0 1600 30" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[22px] w-full">
        <path d="M0 30 L0 14 L40 18 L90 10 L150 16 L210 9 L280 15 L350 8 L420 14 L500 10 L580 17 L660 9 L740 15 L820 11 L900 16 L980 8 L1060 14 L1140 10 L1220 17 L1300 9 L1380 15 L1460 10 L1540 16 L1600 12 L1600 30 Z" fill="#fbf7ef" />
      </svg>
    </section>
  );
}

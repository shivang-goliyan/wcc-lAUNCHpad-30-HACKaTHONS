'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';

const DAY = [
  { item: 'BP tablet · 9:00', line: 'BP tablet at 9. She said “le li”.' },
  { item: 'water · 11:30', line: 'A glass of water at 11:30.' },
  { item: 'Dr. Mehta · Tue 9:30', line: 'Dr. Mehta on Tuesday. The clinic confirmed, and she said yes.' },
  { item: 'evening walk · 5:30', line: 'Evening walk at 5:30. Then Arjun calls.' },
];
const HELLO = 'नमस्ते! I’m Nami, an AI companion.';

/** Ticks through Meera's day: one item every few seconds, then starts over. -1 = nothing ticked yet. */
function useDayStep() {
  const [step, setStep] = useState(-1);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = -1;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      i = i >= DAY.length - 1 ? -1 : i + 1;
      setStep(i);
      window.dispatchEvent(new CustomEvent('hero:step', { detail: i }));
      t = setTimeout(next, i === -1 ? 4200 : i === DAY.length - 1 ? 5200 : 3400);
    };
    t = setTimeout(next, 3600);
    return () => clearTimeout(t);
  }, []);
  return step;
}

/** Meera's day as a note; Nami ticks things off as the day goes by. */
export function DayNote() {
  const step = useDayStep();
  return (
    <>
      <p className="font-hand text-[16px] font-bold text-teal-900">Meera ji&rsquo;s day</p>
      <ul className="font-hand mt-1 space-y-0.5 text-[17px] text-ink-900">
        {DAY.map((d, i) => {
          const done = i <= step;
          return (
            <li key={d.item} className="flex items-center gap-2">
              <svg viewBox="0 0 20 20" className="h-[15px] w-[15px] shrink-0" aria-hidden>
                <rect x="2" y="3" width="14" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M4.5 10.5 L8.5 14.5 L18 2.5"
                  fill="none"
                  stroke="#1f5a3b"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  style={{ strokeDasharray: 1, strokeDashoffset: done ? 0 : 1, transition: 'stroke-dashoffset .45s cubic-bezier(.3,.7,.3,1)' }}
                />
              </svg>
              <span className={done ? 'text-ink-600 line-through decoration-[#1f5a3b]/50 decoration-2' : undefined} style={{ transition: 'color .4s' }}>
                {d.item}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** What Nami says on the hero, following the day note. Fades as she leaves the hero. */
export function HeroBubble() {
  const [step, setStep] = useState(-1);
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 140], [1, 0]);
  useEffect(() => {
    const on = (e: Event) => setStep((e as CustomEvent<number>).detail);
    window.addEventListener('hero:step', on);
    return () => window.removeEventListener('hero:step', on);
  }, []);
  const text = step < 0 ? HELLO : DAY[step].line;
  return (
    <motion.div style={{ opacity }} className="pointer-events-none absolute bottom-[92%] left-[-18%] z-20 w-[250px] lg:hidden xl:block">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={text}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
          className="w-max max-w-[250px] rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 text-[14.5px] leading-snug text-ink-900 shadow-[0_10px_30px_rgba(23,61,56,0.14)]"
        >
          {step < 0 ? (
            <>
              <span lang="hi" className="font-display text-base text-cocoa-500">
                नमस्ते!
              </span>{' '}
              I&rsquo;m Nami, an AI companion.
            </>
          ) : (
            text
          )}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}

/** A link that makes Nami cheer while it's hovered or focused. */
export function CheerLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const cheer = () => window.dispatchEvent(new Event('nami:cheer'));
  return (
    <a href={href} className={className} onMouseEnter={cheer} onFocus={cheer}>
      {children}
    </a>
  );
}


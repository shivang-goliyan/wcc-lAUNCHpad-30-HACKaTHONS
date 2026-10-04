'use client';

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Plays a conversation back when it scrolls into view: one message at a time,
 * with "typing" dots before the ones that come from Nami or the clinic.
 * Every message keeps its space from the start, so nothing below jumps.
 * Without JS (or with reduced motion) everything is simply shown.
 */
export function Replay({ children, typing, right }: { children: ReactNode; typing: boolean[]; right: boolean[] }) {
  const items = Children.toArray(children);
  const [step, setStep] = useState(items.length);
  const [dots, setDots] = useState(false);
  const ref = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.85) return; // already on screen: leave it shown
    const timers: ReturnType<typeof setTimeout>[] = [];
    const hide = setTimeout(() => setStep(0), 0);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        let t = 250;
        for (let i = 0; i < items.length; i++) {
          if (typing[i]) {
            timers.push(setTimeout(() => setDots(true), t));
            t += 1000;
          }
          timers.push(
            setTimeout(() => {
              setDots(false);
              setStep(i + 1);
            }, t),
          );
          t += i === items.length - 1 ? 0 : 900;
        }
      },
      { rootMargin: '0px 0px -30% 0px' },
    );
    io.observe(el);
    return () => {
      clearTimeout(hide);
      timers.forEach(clearTimeout);
      io.disconnect();
    };
    // the script is fixed for the page's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ol ref={ref} className="space-y-5">
      {items.map((c, i) => (
        <li key={i} className="relative" data-shown={i < step ? '1' : '0'}>
          <div className={i < step ? 'rp-in' : 'rp-out'}>{c}</div>
          {i === step && dots && (
            <div className={`absolute top-6 flex gap-1 rounded-[20px] bg-[#e7f1ec] px-4 py-3.5 ${right[i] ? 'right-14' : 'left-14'}`} aria-hidden>
              <span className="lp-dot h-2 w-2 rounded-full bg-teal-700" />
              <span className="lp-dot h-2 w-2 rounded-full bg-teal-700 [animation-delay:.15s]" />
              <span className="lp-dot h-2 w-2 rounded-full bg-teal-700 [animation-delay:.3s]" />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

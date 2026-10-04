'use client';

import { useReducedMotionSafe } from './useReducedMotionSafe';
import { useEffect, useRef } from 'react';
import { animate } from 'motion/react';

/** Counts up to `to` the first time it is on screen. Server HTML shows the final value. */
export function CountUp({
  to,
  decimals = 0,
  suffix = '',
  duration = 1.6,
  delay = 0,
}: {
  to: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotionSafe();
  const fmt = (v: number) => `${v.toFixed(decimals)}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || typeof IntersectionObserver === 'undefined') return;
    el.textContent = fmt(0);
    let stop: (() => void) | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const a = animate(0, to, {
          duration,
          delay,
          ease: [0.2, 0.7, 0.2, 1],
          onUpdate: (v) => {
            el.textContent = fmt(v);
          },
        });
        stop = () => a.stop();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      stop?.();
      el.textContent = fmt(to);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, decimals, suffix, duration, delay, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {fmt(to)}
    </span>
  );
}

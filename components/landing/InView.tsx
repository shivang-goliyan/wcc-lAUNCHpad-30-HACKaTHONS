'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { clsx } from 'clsx';

/**
 * Marks itself `data-seen="0"` once hydrated off-screen, then `"1"` the first
 * time it scrolls into view. CSS in landing.css does the animating, so the
 * server HTML (no data-seen) is fully visible without JS.
 */
export function InView({
  children,
  className,
  as: Tag = 'div',
  amount = 0.25,
  id,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'ol' | 'ul';
  amount?: number;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92 && r.bottom > 0) {
      el.dataset.seen = '1';
      return;
    }
    el.dataset.seen = '0';
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.seen = '1';
          io.disconnect();
        }
      },
      { threshold: amount },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount]);
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} id={id} className={clsx(className)}>
      {children}
    </Tag>
  );
}

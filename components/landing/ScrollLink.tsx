'use client';

import type { ReactNode } from 'react';

/** In-page link that scrolls smoothly (instantly with reduced motion). Works as a plain anchor without JS. */
export function ScrollLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        const el = document.getElementById(to);
        if (!el) return;
        e.preventDefault();
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', `#${to}`);
      }}
    >
      {children}
    </a>
  );
}

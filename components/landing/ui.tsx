import { clsx } from 'clsx';
import type { ReactNode } from 'react';

/**
 * Content column. At xl the column narrows so both gutters stay at least
 * ~210px wide: that is Nami's lane (RoamingNami never crosses the column).
 */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={clsx(
        'relative mx-auto w-full max-w-[1080px] px-5 sm:px-8 xl:max-w-[min(1040px,calc(100vw-420px))] xl:px-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Nami lane slots, just outside the content column (xl only). */
export const LANE_LEFT = 'absolute hidden xl:block right-[calc(100%+28px)] h-[168px] w-[168px]';
export const LANE_RIGHT = 'absolute hidden xl:block left-[calc(100%+28px)] h-[168px] w-[168px]';

export function Eyebrow({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <p
      className={clsx(
        'inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em]',
        tone === 'light' ? 'text-teal-700' : 'text-sea-200',
      )}
    >
      <span aria-hidden className={clsx('h-px w-6', tone === 'light' ? 'bg-sea-500' : 'bg-sea-500/70')} />
      {children}
    </p>
  );
}

export function SectionTitle({
  children,
  className,
  tone = 'light',
  as: Tag = 'h2',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'light' | 'dark';
  as?: 'h2' | 'h3';
}) {
  return (
    <Tag
      className={clsx(
        'lp-display font-display text-[clamp(2rem,4.2vw,3.4rem)] leading-[1.06] font-medium text-balance',
        tone === 'light' ? 'text-teal-900' : 'text-ivory-50',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Small "Source: …" line under a fact. */
export function Source({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <p className={clsx('text-[12px] leading-snug', tone === 'light' ? 'text-ink-600/80' : 'text-sea-200/70')}>
      Source: {children}
    </p>
  );
}

export const BTN_PRIMARY =
  'group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-teal-900 px-7 text-[17px] font-semibold text-ivory-50 shadow-[0_10px_30px_rgba(23,61,56,0.25)] transition hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_14px_36px_rgba(23,61,56,0.3)] active:translate-y-0';
export const BTN_SECONDARY =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-teal-900/20 bg-card/70 px-7 text-[17px] font-semibold text-teal-900 backdrop-blur transition hover:border-teal-900/40 hover:bg-card';

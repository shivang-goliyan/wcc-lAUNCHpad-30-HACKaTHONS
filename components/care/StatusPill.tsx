import type { LucideIcon } from 'lucide-react';

export type Tone = 'ok' | 'warn' | 'bad' | 'help' | 'neutral' | 'info';

export const TONE: Record<Tone, { text: string; bg: string; border: string; solid: string; dot: string }> = {
  ok: { text: 'text-ok-600', bg: 'bg-ok-600/10', border: 'border-ok-600/25', solid: 'bg-ok-600', dot: 'bg-ok-600' },
  warn: { text: 'text-[#8a5a12]', bg: 'bg-warn-600/12', border: 'border-warn-600/30', solid: 'bg-warn-600', dot: 'bg-warn-600' },
  bad: { text: 'text-bad-600', bg: 'bg-bad-600/10', border: 'border-bad-600/25', solid: 'bg-bad-600', dot: 'bg-bad-600' },
  help: { text: 'text-help-600', bg: 'bg-help-600/10', border: 'border-help-600/30', solid: 'bg-help-600', dot: 'bg-help-600' },
  neutral: { text: 'text-ink-600', bg: 'bg-ink-600/8', border: 'border-ink-600/15', solid: 'bg-ink-600', dot: 'bg-ink-600' },
  info: { text: 'text-teal-700', bg: 'bg-sea-200/60', border: 'border-sea-500/40', solid: 'bg-teal-700', dot: 'bg-teal-700' },
};

/** Status always pairs colour + icon + text (DESIGN.md §2). */
export function StatusPill({ tone, icon: Icon, children, live = false, size = 'md' }: { tone: Tone; icon: LucideIcon; children: React.ReactNode; live?: boolean; size?: 'sm' | 'md' }) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border font-semibold leading-tight ${t.text} ${t.bg} ${t.border} ${
        size === 'sm' ? 'px-2.5 py-1 text-[13px]' : 'px-3 py-1.5 text-[15px]'
      }`}
    >
      {live ? (
        <span className="relative mr-0.5 flex size-2 shrink-0" aria-hidden>
          <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${t.dot}`} />
          <span className={`relative inline-flex size-2 rounded-full ${t.dot}`} />
        </span>
      ) : null}
      <Icon className={size === 'sm' ? 'size-3.5 shrink-0' : 'size-4 shrink-0'} aria-hidden strokeWidth={2.25} />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

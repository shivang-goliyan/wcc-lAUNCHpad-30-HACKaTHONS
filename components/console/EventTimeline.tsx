'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Cpu, Globe, Layers, Sparkles, User, type LucideIcon } from 'lucide-react';
import type { ConsoleContact, ConsoleEvent } from './types';
import { actorView, humanize, istTime, KIND_CHIP } from './format';

type Cat = 'all' | ConsoleEvent['category'];

const CATS: Array<{ id: Cat; label: string; icon: LucideIcon; dot: string }> = [
  { id: 'all', label: 'All', icon: Layers, dot: 'bg-ink-600' },
  { id: 'agent', label: 'Agent', icon: Sparkles, dot: 'bg-sea-500' },
  { id: 'state', label: 'State', icon: Cpu, dot: 'bg-teal-900' },
  { id: 'external', label: 'External', icon: Globe, dot: 'bg-warn-600' },
  { id: 'human', label: 'Human', icon: User, dot: 'bg-cocoa-500' },
];

const CAT_RAIL: Record<ConsoleEvent['category'], string> = {
  agent: 'bg-sea-500',
  state: 'bg-teal-900',
  external: 'bg-warn-600',
  human: 'bg-cocoa-500',
};

export function EventTimeline({ events, contacts, recipientFirst }: { events: ConsoleEvent[]; contacts: ConsoleContact[]; recipientFirst: string }) {
  const [cat, setCat] = useState<Cat>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const counts = events.reduce<Record<string, number>>((m, e) => ((m[e.category] = (m[e.category] ?? 0) + 1), m), {});
  const shown = cat === 'all' ? events : events.filter((e) => e.category === cat);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Filter events by category" className="flex flex-wrap gap-2">
        {CATS.map((c) => {
          const on = cat === c.id;
          const n = c.id === 'all' ? events.length : (counts[c.id] ?? 0);
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={on}
              onClick={() => setCat(c.id)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold ring-1 transition ${
                on ? 'bg-teal-900 text-ivory-50 ring-teal-900' : 'bg-card text-ink-900 ring-line hover:ring-teal-700/40'
              }`}
            >
              <c.icon className="size-4" aria-hidden />
              {c.label}
              <span className={`rounded-full px-1.5 text-[12px] tabular-nums ${on ? 'bg-white/15' : 'bg-ivory-100 text-ink-600'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      <ol className="mt-4 max-h-[560px] min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1 lg:max-h-[860px]" aria-live="polite" aria-relevant="additions">
        <AnimatePresence initial={false}>
          {shown.map((e) => {
            const key = String(e.id);
            const av = actorView(e.actor, contacts, recipientFirst);
            const expanded = !!open[key];
            const hasDetail = !!e.detail || !!e.record_id;
            return (
              <motion.li
                key={key}
                layout="position"
                initial={{ opacity: 0, y: -8, backgroundColor: 'rgba(207,224,216,.9)' }}
                animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(255,253,248,1)' }}
                transition={{ duration: 0.5 }}
                className="relative overflow-hidden rounded-2xl border border-line"
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${CAT_RAIL[e.category]}`} aria-hidden />
                <div className="flex gap-3 py-3 pr-3 pl-4">
                  <time className="w-11 shrink-0 pt-0.5 font-mono text-[13px] font-semibold tabular-nums text-ink-600" title={`Demo time ${e.at_virtual}`}>
                    {istTime(e.at_virtual)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-bold ring-1 ${KIND_CHIP[av.kind]}`}>{av.label}</span>
                      <code className="rounded-md bg-ivory-100 px-1.5 py-0.5 font-mono text-[11.5px] text-ink-600">{e.action}</code>
                    </div>
                    <p className="mt-1 text-[15px] leading-snug text-ink-900">{e.summary}</p>
                    {hasDetail ? (
                      <button
                        onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                        aria-expanded={expanded}
                        className="mt-1 inline-flex min-h-8 items-center gap-1 rounded-md text-[13px] font-semibold text-teal-700 hover:underline"
                      >
                        <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                        {expanded ? 'Hide detail' : 'Detail'}
                      </button>
                    ) : null}
                    {expanded ? (
                      <div className="mt-2 overflow-hidden rounded-xl bg-teal-900 p-3 text-[12px] leading-relaxed text-sea-200">
                        <p className="font-mono text-ivory-50">
                          {humanize(e.category)} · {e.record_type}
                          {e.record_id ? ` · ${e.record_id}` : ''}
                        </p>
                        {e.detail ? <pre className="mt-1.5 max-h-64 overflow-auto font-mono break-words whitespace-pre-wrap">{JSON.stringify(e.detail, null, 2)}</pre> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {shown.length === 0 ? <li className="rounded-2xl bg-ivory-50 p-4 text-[15px] text-ink-600">No {cat === 'all' ? '' : `${cat} `}events yet.</li> : null}
      </ol>
    </div>
  );
}

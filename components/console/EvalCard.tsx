'use client';

import useSWR from 'swr';
import { FlaskConical, Terminal } from 'lucide-react';

type EvalResult = { passed: number; total: number; suite?: string; ranAt?: string; note?: string };
type EvalFile = Record<string, EvalResult>;

const LABEL: Record<string, string> = {
  engine: 'Workflow-engine scenarios',
  intents: 'Intent & tool routing',
  calls: 'Slot extraction (simulated calls)',
};

async function fetcher(url: string): Promise<EvalFile | null> {
  const r = await fetch(url, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const tone = pct >= 0.999 ? '#2f7a55' : pct >= 0.9 ? '#24564f' : '#b7791f';
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#efe8d9" strokeWidth="7" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
    </svg>
  );
}

export function EvalCard() {
  const { data, error, isLoading } = useSWR('/eval-results.json', fetcher, { revalidateOnFocus: false });
  const entries = data ? Object.entries(data).filter(([, v]) => v && typeof v.passed === 'number' && typeof v.total === 'number') : [];

  if (isLoading) return <div className="h-28 animate-pulse rounded-2xl bg-ivory-100" />;

  if (error || !entries.length) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line bg-ivory-50 p-4">
        <Terminal className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
        <p className="text-[15px] text-ink-600">
          No eval results yet. Run <code className="rounded bg-ivory-100 px-1 font-mono text-[13px]">pnpm test</code> / <code className="rounded bg-ivory-100 px-1 font-mono text-[13px]">pnpm eval</code> to populate.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 lg:grid-cols-3">
      {entries.map(([k, v]) => {
        const pct = v.total ? v.passed / v.total : 0;
        return (
          <li key={k} className="flex items-center gap-4 rounded-2xl border border-line bg-ivory-50 p-4">
            <div className="relative">
              <Ring pct={pct} />
              <span className="absolute inset-0 flex items-center justify-center font-display text-[15px] font-bold text-teal-900">{Math.round(pct * 100)}%</span>
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-ink-900">{LABEL[k] ?? k}</p>
              <p className="font-display text-[22px] font-semibold text-teal-900 tabular-nums">
                {v.passed}
                <span className="text-[15px] font-medium text-ink-600"> / {v.total} passed</span>
              </p>
              <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-ink-600">
                <FlaskConical className="size-3.5" aria-hidden />
                {v.suite ? <code className="font-mono break-all">{v.suite}</code> : null}
                {v.ranAt ? <span>· ran {v.ranAt}</span> : null}
              </p>
              {v.note ? <p className="mt-0.5 text-[12.5px] text-ink-600">{v.note}</p> : null}
            </div>
          </li>
        );
      })}
      <li className="px-1 text-[12.5px] leading-snug text-ink-600">Controlled tests on the engine and verifiers, not real-world claims. Source: /eval-results.json.</li>
    </ul>
  );
}

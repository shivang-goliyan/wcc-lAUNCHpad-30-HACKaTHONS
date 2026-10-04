'use client';

import useSWR from 'swr';
import { useCallback, useState } from 'react';
import { CircleCheck, Clock, Eye, MapPin, ShieldCheck, WifiOff } from 'lucide-react';
import type { CareSnapshot } from '@/lib/server/snapshot';
import { CaseCard, type ActionResult, type CareAction } from './CaseCard';
import { AppointmentsSection, FamilyRequestsSection, NoticesSection, PastCasesSection, RemindersSection } from './Sections';
import { InvalidLink } from './InvalidLink';
import { NamiAvatar } from './NamiAvatar';
import { isOpenCase, time24 } from './format';

type CareResponse = CareSnapshot & { ok: true };

class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

async function fetcher(url: string): Promise<CareResponse> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new HttpError(r.status);
  return r.json();
}

function actionMessage(action: CareAction, status: string | undefined, at: string | null): string {
  const when = at ? ` at ${at}` : '';
  switch (action) {
    case 'accept':
      return `Recorded${when}: you are following up. Please report back here.`;
    case 'decline':
      return status === 'unresolved' ? `Recorded${when}. No other agreed contact is left — the case stays open.` : `Recorded${when}. Thank you for letting Nami know.`;
    case 'spoke':
      return `Your report is saved as human-reported${when}.`;
    case 'still_needs_help':
      return status === 'unresolved'
        ? `Recorded${when}. Nobody else is left to contact — the case stays open.`
        : `Recorded${when}. Nami is contacting the next agreed person.`;
  }
}

export function CareView({ token }: { token: string }) {
  const url = `/api/care/${encodeURIComponent(token)}/state`;
  const { data, error, mutate } = useSWR<CareResponse, HttpError>(url, fetcher, {
    refreshInterval: 2000,
    revalidateOnFocus: true,
    shouldRetryOnError: (err: HttpError) => err.status !== 401 && err.status !== 404,
  });

  const [last, setLast] = useState<{ caseId: string; message: string } | null>(null);
  const onAction = useCallback(
    async (caseId: string, action: CareAction, note?: string): Promise<ActionResult> => {
      try {
        const r = await fetch(`/api/care/${encodeURIComponent(token)}/action`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ caseId, action, note: note ? note : null }),
        });
        if (r.status === 401) return { ok: false, message: 'This link has expired. Ask for a fresh link.' };
        const j = (await r.json()) as { ok: boolean; reply?: { status?: string; sayHint?: string } | null; rejected?: { message: string } };
        const fresh = await mutate();
        if (!r.ok || !j.ok) return { ok: false, message: j.rejected?.message ?? 'That didn’t go through. Please try again.' };
        const message = actionMessage(action, j.reply?.status, fresh?.time ?? null);
        setLast({ caseId, message });
        return { ok: true, message };
      } catch {
        return { ok: false, message: 'No connection. Nothing was recorded — please try again.' };
      }
    },
    [token, mutate],
  );

  if (error && (error.status === 401 || error.status === 404)) return <InvalidLink />;
  if (!data) return <CareSkeleton offline={!!error} />;

  const me = data.contact.id;
  const name = data.recipient.addressAs || data.recipient.name;
  const open = data.cases.filter((c) => isOpenCase(c.state)).sort((a, b) => (a.type === 'help' ? -1 : 0) - (b.type === 'help' ? -1 : 0));
  const closed = data.cases.filter((c) => !isOpenCase(c.state));
  const lastSeen = data.device.lastSeen;

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-ivory-50">
      <header className="relative overflow-hidden bg-teal-900 pb-16 text-ivory-50">
        <Waves />
        <div className="relative mx-auto w-full max-w-[640px] px-4 pt-5 sm:px-6 sm:pt-7 lg:max-w-[1120px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <NamiAvatar className="size-11" />
              <div className="leading-tight">
                <p className="font-display text-[19px] font-semibold">Nami Care</p>
                <p className="text-[13px] text-sea-200">For {data.contact.name} · {data.contact.relation}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-ivory-50 ring-1 ring-white/15">
                <Clock className="size-3.5" aria-hidden />
                Demo time {data.time}
              </span>
              {error ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-[#f3c9a4]" role="status">
                  <WifiOff className="size-3.5" aria-hidden />
                  Reconnecting…
                </span>
              ) : null}
            </div>
          </div>

          <p className="mt-7 text-[13px] font-bold uppercase tracking-[.18em] text-sea-500">You’re in {data.recipient.name.split(' ')[0]}’s circle</p>
          <h1 className="mt-1.5 font-display text-[34px] leading-[1.05] font-semibold tracking-[-0.015em] sm:text-[42px]">
            {data.recipient.name}
            <span className="text-sea-500"> · </span>
            <span className="inline-flex items-center gap-1 text-[0.8em] font-medium text-sea-200">
              <MapPin className="size-[0.75em]" aria-hidden />
              {data.recipient.city}
            </span>
          </h1>

          <dl className="mt-5 grid grid-cols-2 gap-2.5 lg:max-w-[560px]">
            <div className="rounded-2xl bg-white/[.08] px-4 py-3 ring-1 ring-white/10">
              <dt className="flex items-center gap-1.5 text-[13px] text-sea-200">
                <CircleCheck className="size-3.5" aria-hidden />
                Last explicit response
              </dt>
              <dd className="mt-0.5 font-display text-[24px] font-semibold tabular-nums">{data.device.lastExplicitResponse ?? '—'}</dd>
            </div>
            <div className="rounded-2xl bg-white/[.08] px-4 py-3 ring-1 ring-white/10">
              <dt className="flex items-center gap-1.5 text-[13px] text-sea-200">
                <Eye className="size-3.5" aria-hidden />
                Nami page last seen
              </dt>
              <dd className="mt-0.5 font-display text-[24px] font-semibold tabular-nums">{lastSeen ?? <span className="text-[17px] font-medium text-sea-200">Not today</span>}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="relative z-10 mx-auto -mt-10 w-full max-w-[640px] px-4 pb-10 sm:px-6 lg:max-w-[1120px]">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-6">
        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
        {last && !open.some((c) => c.id === last.caseId) ? (
          <p role="status" className="flex items-start gap-3 rounded-[22px] border border-ok-600/25 bg-[#eef5ef] p-4 text-[16px] font-medium text-ok-600 shadow-[0_14px_40px_rgba(23,61,56,.12)]">
            <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span className="flex-1">{last.message}</span>
            <button onClick={() => setLast(null)} className="-m-2 min-h-11 min-w-11 rounded-full text-[14px] font-semibold text-ink-600 hover:bg-ok-600/10" aria-label="Dismiss">
              ✕
            </button>
          </p>
        ) : null}
        {open.length ? (
          open.map((c) => <CaseCard key={c.id} c={c} me={me} recipientName={name} onAction={onAction} />)
        ) : (
          <div className="flex items-center gap-4 rounded-[22px] border border-line bg-card p-5 shadow-[0_14px_40px_rgba(23,61,56,.12)]">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sea-200/70 text-teal-700">
              <ShieldCheck className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-[18px] font-semibold text-ink-900">Nothing needs you right now</p>
              <p className="mt-0.5 text-[15px] leading-snug text-ink-600">No open check-in or help request. If one opens, it appears here first.</p>
            </div>
          </div>
        )}

        <FamilyRequestsSection requests={data.familyRequests} recipientName={name} />
        </div>
        <div className="flex flex-col gap-5">
        <NoticesSection notices={data.notices} />
        <RemindersSection reminders={data.reminders} />
        <AppointmentsSection appointments={data.appointments} />
        <PastCasesSection cases={closed} me={me} recipientName={name} />
        </div>
        </div>

        <footer className="mt-8 flex flex-col items-center gap-2 px-2 pt-2 text-center text-[14px] leading-relaxed text-ink-600">
          <p className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-teal-700" aria-hidden />
            Shared by {data.recipient.name.split(' ')[0]} with your consent · Nami is an AI assistant
          </p>
          <p className="text-[13px]">Times are demo time ({data.time}) · updates every few seconds · last update {time24(data.now)}</p>
        </footer>
      </div>
    </main>
  );
}

function Waves() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden>
      <path d="M0 64c120 22 240 34 360 26S600 50 720 46s240 16 360 26 240 10 360-6v54H0z" fill="#24564f" opacity=".55" />
      <path d="M0 84c160 18 320 22 480 12s320-34 480-30 320 26 480 26v28H0z" fill="#80a99b" opacity=".18" />
    </svg>
  );
}

function CareSkeleton({ offline }: { offline: boolean }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-ivory-50" aria-busy="true">
      <div className="h-[290px] bg-teal-900" />
      <div className="mx-auto -mt-10 flex w-full max-w-[640px] flex-col gap-5 px-4 sm:px-6">
        <div className="h-72 animate-pulse rounded-[24px] bg-card shadow-[0_14px_40px_rgba(23,61,56,.10)]" />
        <div className="h-40 animate-pulse rounded-[22px] bg-card/80" />
        <p className="text-center text-[15px] text-ink-600" role="status">
          {offline ? 'Can’t reach Nami right now — retrying…' : 'Loading the latest from Nami…'}
        </p>
      </div>
    </main>
  );
}

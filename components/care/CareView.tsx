'use client';

import useSWR from 'swr';
import { useCallback, useState } from 'react';
import { CircleCheck, Clock, Eye, MapPin, ShieldCheck, WifiOff } from 'lucide-react';
import type { CareSnapshot } from '@/lib/server/snapshot';
import { CaseCard, type ActionResult, type CareAction } from './CaseCard';
import { MemorySection } from './MemorySection';
import { AppointmentsSection, FamilyRequestsSection, PastCasesSection, RemindersSection } from './Sections';
import { InvalidLink } from './InvalidLink';
import { NamiAvatar } from './NamiAvatar';
import './paper.css';
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
      return status === 'unresolved' ? `Recorded${when}. No other agreed contact is left, the case stays open.` : `Recorded${when}. Thank you for letting Nami know.`;
    case 'spoke':
      return `Your report is saved as human-reported${when}.`;
    case 'still_needs_help':
      return status === 'unresolved'
        ? `Recorded${when}. Nobody else is left to contact, the case stays open.`
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
        return { ok: false, message: 'No connection. Nothing was recorded, please try again.' };
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

  const first = data.recipient.name.split(' ')[0];
  // the painted portrait belongs to the demo persona only; anyone else gets their initial
  const photo = first === 'Meera' ? '/people/meera-480.webp' : null;

  return (
    <main className="pp-paper flex min-h-dvh flex-1 flex-col">
      <header className="relative">
        <div className="mx-auto w-full max-w-[640px] px-4 pt-4 sm:px-6 sm:pt-6 lg:max-w-[1120px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 leading-none">
              <span className="font-display text-[24px] font-semibold tracking-tight text-teal-900">Raynet</span>
              <span className="font-hand text-[16px] text-cocoa-500">
                for {data.contact.name}
                <span className="hidden sm:inline"> · {data.contact.relation}</span>
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#fbe9a6]/70 px-3 py-1.5 text-[14px] font-semibold text-[#6d4a12] ring-1 ring-warn-600/30">
                <Clock className="size-3.5" aria-hidden />
                Demo time {data.time}
              </span>
              {error ? (
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bad-600" role="status">
                  <WifiOff className="size-3.5" aria-hidden />
                  Reconnecting…
                </span>
              ) : null}
            </div>
          </div>

          <div className="lg:grid lg:grid-cols-2 lg:items-end lg:gap-6">
          <div className="mt-6 flex items-center gap-4 sm:mt-8 sm:gap-5">
            <span className="relative shrink-0 rotate-[-3deg] bg-white p-1.5 pb-4 shadow-[0_10px_24px_rgba(70,45,20,.18)]">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="size-[76px] object-cover sm:size-[92px]" />
              ) : (
                <span className="grid size-[76px] place-items-center bg-sea-200 font-display text-[34px] font-semibold text-teal-900 sm:size-[92px]">{first.slice(0, 1)}</span>
              )}
            </span>
            <div className="min-w-0">
              <p className="font-hand text-[18px] leading-tight text-cocoa-500">You&rsquo;re in {first}&rsquo;s circle</p>
              <h1 className="mt-0.5 font-display text-[32px] leading-[1.05] font-semibold tracking-[-0.015em] text-teal-900 sm:text-[40px]">{data.recipient.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-[16px] text-ink-600">
                <MapPin className="size-4 text-cocoa-500" aria-hidden />
                {data.recipient.city}
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="pp-card rounded-2xl px-4 py-3 ring-1 ring-[#e3d5bd]">
              <dt className="flex items-center gap-1.5 text-[14px] leading-tight text-ink-600">
                <CircleCheck className="size-4 shrink-0 text-teal-700" aria-hidden />
                Last heard from her
              </dt>
              <dd className="mt-1.5 font-display text-[26px] leading-none font-semibold tabular-nums text-teal-900">{data.device.lastExplicitResponse ?? <span className="text-[18px] font-medium text-ink-600">None today</span>}</dd>
            </div>
            <div className="pp-card rounded-2xl px-4 py-3 ring-1 ring-[#e3d5bd]">
              <dt className="flex items-center gap-1.5 text-[14px] leading-tight text-ink-600">
                <Eye className="size-4 shrink-0 text-teal-700" aria-hidden />
                Nami&rsquo;s screen last open
              </dt>
              <dd className="mt-1.5 font-display text-[26px] leading-none font-semibold tabular-nums text-teal-900">{lastSeen ?? <span className="text-[18px] font-medium text-ink-600">Not today</span>}</dd>
            </div>
          </dl>
          </div>
        </div>
      </header>

      <div className="relative mx-auto mt-6 w-full max-w-[640px] px-4 pb-10 sm:px-6 lg:mt-8 lg:max-w-[1120px]">
        {/* two balanced columns on wide screens; one reading order on phones */}
        <div className="flex flex-col gap-5 lg:block lg:columns-2 lg:gap-6 lg:[&>*]:mb-6 lg:[&>*]:break-inside-avoid">
            {last && !open.some((c) => c.id === last.caseId) ? (
              <p role="status" className="flex items-start gap-3 rounded-[22px] border border-ok-600/25 bg-[#eef5ef] p-4 text-[16px] font-medium text-ok-600 shadow-[0_10px_26px_rgba(70,45,20,.1)]">
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
              <div className="pp-note pp-tape relative mt-2 flex items-center gap-4 rounded-md p-5 sm:p-6" style={{ ['--tilt' as string]: '-0.6deg' }}>
                <NamiAvatar className="size-16" />
                <div>
                  <p className="font-display text-[22px] leading-tight font-semibold text-teal-900">Nothing needs you right now</p>
                  <p className="mt-1 text-[16px] leading-snug text-ink-600">No open check-in or help request. If one opens, it shows up here first.</p>
                </div>
              </div>
            )}

            <FamilyRequestsSection requests={data.familyRequests} recipientName={name} />
            <RemindersSection reminders={data.reminders} />
            <AppointmentsSection appointments={data.appointments} />
            <PastCasesSection cases={closed} me={me} recipientName={name} />
            <MemorySection token={token} data={data} onDone={() => void mutate()} />
        </div>

        <footer className="mt-10 flex flex-col items-center gap-2 px-2 text-center text-[14px] leading-relaxed text-ink-600">
          <p className="flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0 text-teal-700" aria-hidden />
            Shared by {first} with your consent · Nami is an AI assistant
          </p>
          <p className="text-[13px]">Times are demo time ({data.time}) · updates every few seconds · last update {time24(data.now)}</p>
        </footer>
      </div>
    </main>
  );
}

function CareSkeleton({ offline }: { offline: boolean }) {
  return (
    <main className="pp-paper flex min-h-dvh flex-1 flex-col" aria-busy="true">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-6 sm:px-6">
        <div className="h-7 w-40 animate-pulse rounded-full bg-[#ebdfca]" />
        <div className="h-28 animate-pulse rounded-[22px] bg-[#efe5d3]" />
        <div className="h-72 animate-pulse rounded-[24px] bg-[#fffaf0] shadow-[0_10px_26px_rgba(70,45,20,.1)]" />
        <p className="text-center text-[15px] text-ink-600" role="status">
          {offline ? 'Can’t reach Nami right now, retrying…' : 'Loading the latest from Nami…'}
        </p>
      </div>
    </main>
  );
}

'use client';

import useSWR from 'swr';
import { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BellRing,
  CalendarCheck,
  Clock,
  Cpu,
  FastForward,
  FlaskConical,
  Hourglass,
  LoaderCircle,
  PhoneCall,
  Pill,
  QrCode,
  ShieldCheck,
  Sparkles,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { NamiImage } from '@/components/nami/NamiImage';
import type { PoseName } from '@/lib/nami/poses';
import type { ConsoleState } from './types';
import { actorView, humanize, istTime, KIND_CHIP, LIVE_CALL_STATES, nodesForCall, nodesForEvent, type NodeId } from './format';
import { AgentGraph, GraphLegend } from './AgentGraph';
import { EventTimeline } from './EventTimeline';
import { CallViewer } from './CallViewer';
import { EvalCard } from './EvalCard';
import { CaregiverLinks } from './CaregiverLinks';
import { NoHousehold } from './NoHousehold';

type Fetched = ConsoleState & { fetchedAt: number };

class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

async function fetcher(url: string): Promise<Fetched> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new HttpError(r.status);
  const j = (await r.json()) as ConsoleState;
  return { ...j, fetchedAt: Date.now() };
}

const TERMINAL = ['resolved_user_responded', 'resolved_human_reported', 'cancelled_mistake'];

function poseFor(lead: NodeId | null, helpOpen: boolean): PoseName {
  if (helpOpen) return 'help';
  switch (lead) {
    case 'caller':
    case 'clinic':
    case 'family':
      return 'calling';
    case 'engine':
    case 'verifier':
    case 'extractor':
      return 'thinking';
    case 'nami':
      return 'speaking';
    case 'meera':
      return 'listening';
    case 'caregiver':
      return 'acknowledged';
    default:
      return 'idle';
  }
}

export function ConsoleView() {
  const { data, error, mutate } = useSWR<Fetched, HttpError>('/api/state', fetcher, {
    refreshInterval: 1500,
    shouldRetryOnError: (e: HttpError) => e.status !== 401,
  });
  const [skipping, setSkipping] = useState(false);

  if (error?.status === 401) return <NoHousehold />;
  if (!data) return <ConsoleSkeleton offline={!!error} />;

  const recipientFirst = data.recipient.firstName;
  const events = data.events;
  const latest = events[0] ?? null;

  // Highlight the nodes in the most recent batch of events (same request ≈ within 4 s), plus any live call.
  const active = new Set<NodeId>();
  let lead: NodeId | null = null;
  if (latest) {
    const t = Date.parse(latest.at_real);
    for (const e of events.slice(0, 8)) {
      if (t - Date.parse(e.at_real) > 4000) break;
      for (const n of nodesForEvent(e)) active.add(n);
    }
    lead = nodesForEvent(latest).find((n) => n !== 'engine') ?? nodesForEvent(latest)[0] ?? null;
  }
  const liveCalls = data.calls.filter((c) => LIVE_CALL_STATES.includes(c.state));
  for (const c of liveCalls) for (const n of nodesForCall(c)) active.add(n);
  if (liveCalls.length) lead = nodesForCall(liveCalls[0])[0] ?? lead;
  const live = liveCalls.length > 0 || (latest ? data.fetchedAt - Date.parse(latest.at_real) < 20_000 : false);

  const openCase = [...data.cases].reverse().find((c) => !TERMINAL.includes(c.state)) ?? null;
  const helpOpen = data.cases.some((c) => c.type === 'help' && !TERMINAL.includes(c.state) && c.state !== 'unresolved');
  const appt = data.appointments[data.appointments.length - 1] ?? null;
  const resolved = data.occurrences.filter((o) => o.state === 'resolved').length;
  const caregivers = data.contacts.map((c) => c.name).join(' / ') || 'Family';
  const clinicMode = data.clinics[0]?.mode ?? 'sim';

  async function skip() {
    setSkipping(true);
    try {
      await fetch('/api/demo/skip', { method: 'POST' });
      await mutate();
    } finally {
      setSkipping(false);
    }
  }

  const stepContact = openCase && openCase.step >= 0 ? data.contacts.find((c) => c.id === openCase.contactOrder[openCase.step])?.name : null;
  const owner = openCase?.ownerContactId ? data.contacts.find((c) => c.id === openCase.ownerContactId)?.name : null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-ivory-50">
      {/* ------------------------------------------------------------ hero */}
      <header className="relative overflow-hidden bg-teal-900 text-ivory-50">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-sea-500/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-56 -left-24 size-[420px] rounded-full bg-cocoa-500/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto w-full max-w-[1280px] px-4 pt-6 pb-8 sm:px-6 lg:px-8 lg:pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Activity className="size-5 text-sea-200" aria-hidden />
              </span>
              <div className="leading-tight">
                <p className="text-[12px] font-bold tracking-[.18em] text-sea-500 uppercase">Raynet</p>
                <h1 className="font-display text-[24px] font-semibold sm:text-[28px]">Agent console</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-3.5 text-[14px] font-semibold ring-1 ring-white/15" title="Demo time, skipping fires real engine ticks">
                <Clock className="size-4 text-sea-200" aria-hidden />
                Demo time · {data.clock.spokenEn}
              </span>
              <button
                onClick={skip}
                disabled={skipping}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-sea-500 px-4 text-[14px] font-bold text-teal-900 transition hover:bg-sea-200 disabled:opacity-60"
              >
                {skipping ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <FastForward className="size-4" aria-hidden />}
                Skip to next event
              </button>
              {error ? (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-[#f3c9a4]" role="status">
                  <WifiOff className="size-4" aria-hidden />
                  Reconnecting…
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end">
            <div>
              <p className="text-[13px] font-bold tracking-[.18em] text-sea-500 uppercase">The rule every agent follows</p>
              <p className="mt-2 font-display text-[40px] leading-[1.02] font-semibold tracking-[-0.02em] sm:text-[56px] lg:text-[64px]">
                LLMs propose,
                <br />
                <span className="text-sea-500 italic">code disposes.</span>
              </p>
              <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-sea-200">
                Nami, the Caller and the Extractor talk and suggest. Only the deterministic workflow engine changes care state, after the verifier’s checks pass and {recipientFirst} (or a family member) says yes.
              </p>
            </div>
            <ol className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Principle n="1" icon={Sparkles} title="Propose" text="LLM agents talk, call and extract facts." />
              <Principle n="2" icon={ShieldCheck} title="Check" text="Plain-TypeScript verifiers gate every claim." />
              <Principle n="3" icon={Cpu} title="Dispose" text="The engine alone writes state, with an audit trail." />
            </ol>
          </div>

          {/* state now */}
          <dl className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <StateTile
              icon={BellRing}
              label="Open case"
              value={openCase ? `${openCase.type === 'help' ? 'Help' : 'Check-in'} · ${humanize(openCase.state)}` : 'None'}
              sub={openCase ? (owner ? `${owner} is following up` : stepContact ? `Asking ${stepContact}` : `Opened ${istTime(openCase.openedAt)}`) : 'No check-in or help case open'}
              tone={openCase ? (openCase.state === 'owner_accepted' ? 'ok' : 'warn') : 'idle'}
            />
            <StateTile
              icon={CalendarCheck}
              label="Appointment"
              value={appt ? humanize(appt.state) : 'None'}
              sub={appt?.offeredSlot ? `${appt.offeredSlot.weekdaySpoken ?? ''} ${appt.offeredSlot.dateIso} ${appt.offeredSlot.time24h}`.trim() : appt ? (appt.failureReason ?? 'No slot yet') : 'No request yet'}
              tone={appt ? (appt.state === 'confirmed' ? 'ok' : appt.state === 'failed_needs_help' ? 'bad' : 'warn') : 'idle'}
            />
            <StateTile icon={Pill} label="Reminders today" value={`${resolved} of ${data.occurrences.length} answered`} sub="Outcomes are what she reported" tone="idle" />
            <StateTile
              icon={Hourglass}
              label="Waiting for a yes"
              value={data.pending.length ? `${data.pending.length} pending` : 'Nothing pending'}
              sub={data.pending[0]?.readback ?? 'Two-phase: propose, then confirm'}
              tone={data.pending.length ? 'warn' : 'idle'}
            />
          </dl>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-6 sm:px-6 lg:space-y-8 lg:px-8 lg:py-8">
        {/* ------------------------------------------------------------ graph */}
        <Card
          title="Agent graph"
          icon={Activity}
          aside={
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold ring-1 ${live ? 'bg-sea-200/70 text-teal-700 ring-sea-500/40' : 'bg-ivory-100 text-ink-600 ring-line'}`}>
              <span className={`size-2 rounded-full ${live ? 'animate-pulse bg-sea-500' : 'bg-ink-600/40'}`} aria-hidden />
              {live ? 'Live' : 'Idle, last activity highlighted'}
            </span>
          }
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-start">
            <AgentGraph active={active} live={live} recipientFirst={recipientFirst} caregivers={caregivers} clinicMode={clinicMode} />
            <aside className="flex flex-row items-center gap-4 rounded-2xl bg-ivory-50 p-4 lg:flex-col lg:items-stretch lg:text-center">
              <div className="mx-auto flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sea-200/60 ring-1 ring-sea-500/40 lg:size-32">
                <NamiImage pose={poseFor(lead, helpOpen)} className="mt-[14%] h-[115%] w-[115%]" title={`Nami, ${poseFor(lead, helpOpen)} pose`} />
              </div>
              <div className="min-w-0 flex-1 text-left lg:text-center">
                <p className="text-[12px] font-bold tracking-[.14em] text-ink-600 uppercase">Latest step</p>
                {latest ? (
                  <>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 lg:justify-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-bold ring-1 ${KIND_CHIP[actorView(latest.actor, data.contacts, recipientFirst).kind]}`}>
                        {actorView(latest.actor, data.contacts, recipientFirst).label}
                      </span>
                      <span className="font-mono text-[12px] text-ink-600">{istTime(latest.at_virtual)}</span>
                    </p>
                    <p className="mt-1.5 text-[14px] leading-snug text-ink-900">{latest.summary}</p>
                  </>
                ) : (
                  <p className="mt-1 text-[14px] text-ink-600">Nothing yet.</p>
                )}
              </div>
            </aside>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <GraphLegend />
            <p className="flex items-center gap-1.5 text-[13px] text-ink-600">
              <FlaskConical className="size-4" aria-hidden />
              Judges use the simulated clinic, labelled wherever it appears.
            </p>
          </div>
        </Card>

        {/* ------------------------------------------------------------ timeline + calls */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-8">
          <Card title="Audit timeline" icon={Clock} aside={<span className="text-[13px] text-ink-600">Latest {events.length} · demo time (IST)</span>}>
            <EventTimeline events={events} contacts={data.contacts} recipientFirst={recipientFirst} />
          </Card>
          <Card title="Calls" icon={PhoneCall} aside={<span className="text-[13px] text-ink-600">Transcript → facts → checks</span>}>
            <CallViewer calls={data.calls} appointments={data.appointments} />
          </Card>
        </div>

        {/* ------------------------------------------------------------ eval + links */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-8">
          <Card title="Eval results" icon={FlaskConical}>
            <EvalCard />
          </Card>
          <Card title="Caregiver views" icon={QrCode} aside={<Link href="/app" className="text-[14px] font-semibold text-teal-700 hover:underline">Open {recipientFirst}’s app →</Link>}>
            <CaregiverLinks contacts={data.contacts} />
          </Card>
        </div>

        <footer className="pb-4 text-center text-[13px] text-ink-600">
          Nami is an AI assistant. Times shown are demo time. Household {data.householdId} · {data.kind}.
        </footer>
      </div>
    </main>
  );
}

function Principle({ n, icon: Icon, title, text }: { n: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <li className="rounded-2xl bg-white/[.07] p-4 ring-1 ring-white/10">
      <p className="flex items-center gap-2 text-[15px] font-bold">
        <span className="flex size-7 items-center justify-center rounded-full bg-sea-500 font-mono text-[13px] text-teal-900">{n}</span>
        <Icon className="size-4 text-sea-200" aria-hidden />
        {title}
      </p>
      <p className="mt-1.5 text-[14px] leading-snug text-sea-200">{text}</p>
    </li>
  );
}

function StateTile({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub: string; tone: 'ok' | 'warn' | 'bad' | 'idle' }) {
  const dot = { ok: 'bg-[#7fd1a5]', warn: 'bg-[#f0b65a]', bad: 'bg-[#f08a7e]', idle: 'bg-sea-500/60' }[tone];
  return (
    <div className="min-w-0 rounded-2xl bg-white/[.07] px-4 py-3 ring-1 ring-white/10">
      <dt className="flex items-center gap-1.5 text-[12.5px] text-sea-200">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-2 text-[16px] font-semibold">
        <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className="min-w-0">{value}</span>
      </dd>
      <dd className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-sea-200/90">{sub}</dd>
    </div>
  );
}

function Card({ title, icon: Icon, aside, children }: { title: string; icon: LucideIcon; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-[22px] border border-line bg-card p-4 shadow-[0_8px_30px_rgba(23,61,56,.07)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-2.5 font-display text-[22px] font-semibold text-teal-900">
          <span className="flex size-9 items-center justify-center rounded-xl bg-sea-200/70 text-teal-700">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ConsoleSkeleton({ offline }: { offline: boolean }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-ivory-50" aria-busy="true">
      <div className="h-[420px] bg-teal-900" />
      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-[420px] animate-pulse rounded-[22px] bg-card" />
        <p className="text-center text-[15px] text-ink-600" role="status">
          {offline ? 'Can’t reach the server, retrying…' : 'Loading the console…'}
        </p>
      </div>
    </main>
  );
}

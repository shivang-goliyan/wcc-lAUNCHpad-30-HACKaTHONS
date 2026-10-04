'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  CircleCheck,
  CircleX,
  Clock,
  FlaskConical,
  HeartHandshake,
  ListChecks,
  LoaderCircle,
  Lock,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  ScanText,
  ShieldCheck,
  User,
  Voicemail,
  type LucideIcon,
} from 'lucide-react';
import type { ConsoleAppointment, ConsoleCall, Turn } from './types';
import { humanize, LIVE_CALL_STATES } from './format';

const PURPOSE: Record<string, string> = {
  clinic_availability: 'Clinic · ask for a slot',
  clinic_confirm: 'Clinic · confirm booking',
  contact_alert: 'Family alert call',
  recipient_checkin: 'Check-in call',
  family_request: 'Family call request',
};

const CALL_STATE: Record<string, { cls: string; icon: LucideIcon; label: string }> = {
  queued: { cls: 'bg-warn-600/12 text-[#8a5a12] ring-warn-600/30', icon: Clock, label: 'Queued' },
  ringing: { cls: 'bg-warn-600/12 text-[#8a5a12] ring-warn-600/30', icon: PhoneCall, label: 'Ringing' },
  in_progress: { cls: 'bg-sea-200/70 text-teal-700 ring-sea-500/50', icon: Phone, label: 'Live' },
  completed: { cls: 'bg-ok-600/10 text-ok-600 ring-ok-600/25', icon: CircleCheck, label: 'Completed' },
  no_answer: { cls: 'bg-bad-600/10 text-bad-600 ring-bad-600/25', icon: PhoneMissed, label: 'No answer' },
  busy: { cls: 'bg-bad-600/10 text-bad-600 ring-bad-600/25', icon: PhoneOff, label: 'Busy' },
  voicemail: { cls: 'bg-bad-600/10 text-bad-600 ring-bad-600/25', icon: Voicemail, label: 'Voicemail' },
  failed: { cls: 'bg-bad-600/10 text-bad-600 ring-bad-600/25', icon: CircleX, label: 'Failed' },
  cancelled: { cls: 'bg-ink-600/8 text-ink-600 ring-ink-600/15', icon: PhoneOff, label: 'Cancelled' },
};

const EXTRACTOR: Record<string, string> = {
  llm: 'LLM extractor · tool-forced JSON',
  scripted: 'Scripted extractor (simulated clinic)',
  none: 'No extractor available',
  failed: 'Extractor failed — treated as no result',
};

function speakerView(s: Turn['speaker'], call: ConsoleCall): { label: string; icon: LucideIcon } {
  const sim = call.adapter === 'sim';
  switch (s) {
    case 'nami':
      return { label: 'Nami · AI caller', icon: PhoneCall };
    case 'clinic':
      return { label: sim ? 'Clinic receptionist (simulated)' : 'Clinic', icon: Building2 };
    case 'contact':
      return { label: 'Family contact', icon: HeartHandshake };
    case 'recipient':
      return { label: 'Meera', icon: User };
    default:
      return { label: 'System', icon: Clock };
  }
}

function elapsed(t: number, t0: number) {
  const s = Math.max(0, Math.round((t - t0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function CallViewer({ calls, appointments }: { calls: ConsoleCall[]; appointments: ConsoleAppointment[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const call = calls.find((c) => c.id === picked) ?? calls[0] ?? null;

  if (!call) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-ivory-50 px-6 py-12 text-center">
        <PhoneCall className="size-8 text-sea-500" aria-hidden />
        <p className="mt-3 text-[17px] font-semibold text-ink-900">No calls yet</p>
        <p className="mt-1 max-w-sm text-[15px] text-ink-600">Ask Nami to book a doctor’s appointment in the app. The Caller agent’s transcript streams here, followed by the extracted facts and the verifier’s checks.</p>
      </div>
    );
  }

  return (
    <div>
      {calls.length > 1 ? (
        <div role="tablist" aria-label="Recent calls" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {calls.map((c) => {
            const on = c.id === call.id;
            const live = LIVE_CALL_STATES.includes(c.state);
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={on}
                onClick={() => setPicked(c.id)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-semibold ring-1 transition ${
                  on ? 'bg-teal-900 text-ivory-50 ring-teal-900' : 'bg-card text-ink-900 ring-line hover:ring-teal-700/40'
                }`}
              >
                {live ? <span className="size-2 animate-pulse rounded-full bg-sea-500" aria-hidden /> : null}
                {PURPOSE[c.purpose] ?? humanize(c.purpose)}
              </button>
            );
          })}
        </div>
      ) : null}
      <CallDetail key={call.id} call={call} appointment={appointments.find((a) => a.id === call.related_id || a.callIds.includes(call.id)) ?? null} />
    </div>
  );
}

function CallDetail({ call, appointment }: { call: ConsoleCall; appointment: ConsoleAppointment | null }) {
  const live = LIVE_CALL_STATES.includes(call.state);
  const st = CALL_STATE[call.state] ?? { cls: 'bg-ink-600/8 text-ink-600 ring-ink-600/15', icon: Clock, label: humanize(call.state) };
  const scroller = useRef<HTMLDivElement>(null);
  const t0 = call.transcript[0]?.t ?? 0;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [call.transcript.length]);

  const isClinic = call.purpose.startsWith('clinic');

  return (
    <div className="mt-3 space-y-4">
      {/* transcript */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-ivory-50">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-card px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold ring-1 ${st.cls}`} role="status">
            {live ? <span className="size-2 animate-pulse rounded-full bg-current" aria-hidden /> : null}
            <st.icon className="size-3.5" aria-hidden />
            {st.label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ivory-100 px-2.5 py-1 text-[12.5px] font-semibold text-ink-600 ring-1 ring-line">
            {call.adapter === 'sim' ? <FlaskConical className="size-3.5" aria-hidden /> : <Phone className="size-3.5" aria-hidden />}
            {call.adapter === 'sim' ? (isClinic ? 'Simulated clinic' : 'Simulated call') : 'Real phone call'}
          </span>
          {call.scenario ? <span className="rounded-full bg-ivory-100 px-2.5 py-1 font-mono text-[11.5px] text-ink-600 ring-1 ring-line">scenario: {call.scenario}</span> : null}
          <span className="ml-auto font-mono text-[11.5px] text-ink-600">{call.id}</span>
        </div>
        <div ref={scroller} className="max-h-[420px] min-h-[220px] space-y-3 overflow-y-auto px-3 py-4 sm:px-4" aria-live="polite">
          <AnimatePresence initial={false}>
            {call.transcript.map((t, i) => (
              <Bubble key={`${t.t}-${i}`} turn={t} call={call} t0={t0} />
            ))}
          </AnimatePresence>
          {live ? (
            <div className="flex items-center gap-2 pl-1 text-[13px] text-ink-600">
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="size-1.5 rounded-full bg-sea-500" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
                ))}
              </span>
              {call.state === 'in_progress' ? 'Call in progress…' : call.state === 'ringing' ? 'Ringing…' : 'Waiting to dial…'}
            </div>
          ) : null}
          {call.transcript.length === 0 && !live ? <p className="text-center text-[14px] text-ink-600">No transcript recorded.</p> : null}
        </div>
      </div>

      {/* facts + checks */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="space-y-4">
        <Panel icon={ScanText} title="Extracted facts" note={call.extractor ? (EXTRACTOR[call.extractor] ?? call.extractor) : live ? 'Runs when the call ends' : '—'}>
          {call.extracted && Object.keys(call.extracted).length ? (
            <Facts data={call.extracted} />
          ) : (
            <p className="text-[14px] text-ink-600">{live ? 'Waiting for the call to finish.' : 'Nothing extracted.'}</p>
          )}
          <p className="mt-3 text-[12.5px] leading-snug text-ink-600">The extractor only proposes. Nothing changes until the verifier and the engine accept it.</p>
        </Panel>

        <Panel icon={Lock} title="Disclosure check" note="lib/verify/disclosure.ts">
          {appointment?.disclosure?.length ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <span className="text-[12.5px] font-semibold text-ink-600">Permitted:</span>
              {appointment.disclosure.map((d) => (
                <span key={d} className="rounded-full bg-sea-200/60 px-2 py-0.5 text-[12px] font-semibold text-teal-700">
                  {d}
                </span>
              ))}
            </div>
          ) : null}
          {call.disclosure == null ? (
            <p className="flex items-center gap-2 text-[14px] text-ink-600">
              <LoaderCircle className={`size-4 ${live ? 'animate-spin' : ''}`} aria-hidden />
              {live ? 'Checked when the call ends' : 'Not checked'}
            </p>
          ) : call.disclosure.length === 0 ? (
            <p className="flex items-center gap-2 text-[15px] font-semibold text-ok-600">
              <CircleCheck className="size-5" aria-hidden />
              No data shared beyond permission ✓
            </p>
          ) : (
            <ul className="space-y-1.5">
              {call.disclosure.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-[14px] font-semibold text-bad-600">
                  <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {humanize(d.kind)}: “{d.match}”
                </li>
              ))}
            </ul>
          )}
        </Panel>

        </div>
        {isClinic ? (
          <Panel icon={ShieldCheck} title="Verifier checks" note="deterministic · lib/verify/slot.ts">
            {appointment && appointment.verification.length ? (
              <ul className="space-y-2">
                {appointment.verification.map((v) => (
                  <li key={v.check} className="flex items-start gap-2.5">
                    {v.pass ? <CircleCheck className="mt-0.5 size-[18px] shrink-0 text-ok-600" aria-label="pass" /> : <CircleX className="mt-0.5 size-[18px] shrink-0 text-bad-600" aria-label="fail" />}
                    <div className="min-w-0">
                      <p className={`text-[14px] font-semibold ${v.pass ? 'text-ink-900' : 'text-bad-600'}`}>{humanize(v.check)}</p>
                      <p className="text-[13px] leading-snug break-words text-ink-600">{v.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-ink-600">{live ? 'Runs after extraction.' : 'No checks recorded for this request.'}</p>
            )}
            {appointment ? <AppointmentLine a={appointment} confirmCall={call.purpose === 'clinic_confirm'} /> : null}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function AppointmentLine({ a, confirmCall }: { a: ConsoleAppointment; confirmCall: boolean }) {
  const ok = a.state === 'confirmed';
  const bad = a.state === 'failed_needs_help' || a.state === 'cancelled';
  return (
    <div className="mt-4 rounded-xl border border-line bg-ivory-50 p-3">
      <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-600">
        <ListChecks className="size-4" aria-hidden />
        Engine state for {a.id}:
        <span className={`rounded-full px-2 py-0.5 font-mono text-[12px] ring-1 ${ok ? 'bg-ok-600/10 text-ok-600 ring-ok-600/25' : bad ? 'bg-bad-600/10 text-bad-600 ring-bad-600/25' : 'bg-warn-600/12 text-[#8a5a12] ring-warn-600/30'}`}>{a.state}</span>
      </p>
      {confirmCall && a.confirmationEvidence ? (
        <p className="mt-2 text-[13.5px] leading-snug text-ink-900">
          Clinic’s confirmation, quoted: <span className="italic">“{a.confirmationEvidence.quote}”</span>
        </p>
      ) : null}
      {a.failureReason ? <p className="mt-2 text-[13.5px] text-bad-600">Reason: {a.failureReason}</p> : null}
    </div>
  );
}

function Bubble({ turn, call, t0 }: { turn: Turn; call: ConsoleCall; t0: number }) {
  const sv = speakerView(turn.speaker, call);
  if (turn.speaker === 'system') {
    return (
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-fit max-w-[90%] rounded-full bg-ivory-100 px-3 py-1 text-center text-[12.5px] text-ink-600 italic">
        {turn.text}
      </motion.p>
    );
  }
  const mine = turn.speaker === 'nami';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', visualDuration: 0.3, bounce: 0.15 }}
      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[86%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
        <span className={`mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold ${mine ? 'text-teal-700' : 'text-ink-600'}`}>
          <sv.icon className="size-3.5" aria-hidden />
          {sv.label}
          <span className="font-mono font-normal opacity-70">{elapsed(turn.t, t0)}</span>
        </span>
        <p
          className={`rounded-[18px] px-3.5 py-2.5 text-[14.5px] leading-snug ${
            mine ? 'rounded-br-md bg-teal-900 text-ivory-50' : 'rounded-bl-md border border-line bg-card text-ink-900'
          }`}
        >
          {turn.text}
        </p>
      </div>
    </motion.div>
  );
}

function Panel({ icon: Icon, title, note, children }: { icon: LucideIcon; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="flex items-center gap-2 text-[15px] font-bold text-teal-900">
          <Icon className="size-4 text-teal-700" aria-hidden />
          {title}
        </h4>
        {note ? <span className="font-mono text-[11px] text-ink-600">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

function fmt(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.length ? v.map(fmt).join(' · ') : 'none';
  return Object.entries(v as Record<string, unknown>)
    .filter(([k]) => k !== 'quote')
    .map(([k, x]) => `${humanize(k)}: ${fmt(x)}`)
    .join(' · ');
}

const FACT_LABEL: Record<string, string> = {
  date_iso: 'Date',
  time_24h: 'Time',
  weekday_spoken: 'Weekday said',
  fee_stated: 'Fee stated',
  instructions: 'Instructions',
  outcome: 'Outcome',
  confirmed: 'Confirmed',
  accepted: 'Accepted',
  alternatives: 'Alternatives',
};
const label = (k: string) => FACT_LABEL[k] ?? humanize(k);

function Facts({ data }: { data: Record<string, unknown> }) {
  const rows: Array<{ k: string; label: string; v: string; quote?: boolean }> = [];
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        rows.push({ k: `${k}.${k2}`, label: `${label(k)} · ${label(k2).toLowerCase()}`, v: fmt(v2), quote: k2 === 'quote' });
      }
    } else {
      rows.push({ k, label: label(k), v: fmt(v), quote: k === 'quote' });
    }
  }
  return (
    <dl className="divide-y divide-line">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 py-2 first:pt-0 last:pb-0">
          <dt className="text-[13px] font-semibold text-ink-600">{r.label}</dt>
          <dd className={`text-[14px] break-words text-ink-900 ${r.quote ? 'italic' : ''}`}>{r.quote && r.v !== '—' ? `“${r.v}”` : r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

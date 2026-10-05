import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleCheck,
  CircleMinus,
  CircleSlash,
  FilePen,
  Hourglass,
  Inbox,
  LifeBuoy,
  MessageCircleHeart,
  PhoneOutgoing,
  Pill,
  Stethoscope,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { CareSnapshot } from '@/lib/server/snapshot';
import { StatusPill, type Tone } from './StatusPill';
import { caseStateView, CaseHistory, type CareCase } from './CaseCard';
import { time24 } from './format';

export function Section({ title, icon: Icon, children, aside }: { title: string; icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-[#e3d5bd] bg-[#fffaf0] p-5 shadow-[0_10px_26px_rgba(70,45,20,.08)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-display text-[22px] font-semibold text-teal-900">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#f3e6cf] text-cocoa-500">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="font-hand rounded-xl bg-[#f6efe2] px-4 py-3 text-[17px] text-ink-600">{children}</p>;
}

/* ------------------------------------------------------------------ notices */

export function NoticesSection({ notices }: { notices: CareSnapshot['notices'] }) {
  return (
    <Section title="Notices" icon={Bell}>
      {notices.length === 0 ? (
        <Empty>No notices for you yet.</Empty>
      ) : (
        <ol className="relative">
          {notices.map((n, i) => (
            <li key={n.id} className="relative flex gap-4 pb-4 last:pb-0">
              {i < notices.length - 1 ? <span className="absolute top-3 left-[5px] h-full w-px bg-line" aria-hidden /> : null}
              <span className={`relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-[#fffaf0] ${i === 0 ? 'bg-teal-700' : 'bg-sea-500'}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <time className="font-mono text-[14px] font-medium tabular-nums text-ink-600">{n.time}</time>
                <p className="mt-0.5 text-[17px] leading-snug text-ink-900">{n.text}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/* ---------------------------------------------------------------- reminders */

const OUTCOME: Record<string, { tone: Tone; icon: LucideIcon; text: string }> = {
  taken_reported: { tone: 'ok', icon: CircleCheck, text: 'Said she took it' },
  not_taken_reported: { tone: 'warn', icon: CircleSlash, text: 'Said she has not taken it' },
  unacknowledged: { tone: 'neutral', icon: CircleMinus, text: 'No response (not an emergency)' },
  delivery_uncertain: { tone: 'warn', icon: WifiOff, text: 'Not delivered. Nami page wasn’t open' },
  help_requested: { tone: 'bad', icon: LifeBuoy, text: 'Asked for help instead' },
  done_reported: { tone: 'ok', icon: CircleCheck, text: 'Said it’s done' },
};

export function RemindersSection({ reminders }: { reminders: CareSnapshot['reminders'] }) {
  return (
    <Section title="Today’s reminders" icon={Pill}>
      {reminders.length === 0 ? (
        <Empty>No reminder updates shared yet today.</Empty>
      ) : (
        <ul className="divide-y divide-[#e3d5bd]">
          {reminders.map((r, i) => {
            const o = (r.outcome && OUTCOME[r.outcome]) || { tone: 'neutral' as Tone, icon: CircleMinus, text: 'No outcome' };
            return (
              <li key={`${r.label}-${r.time}-${i}`} className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-start gap-3">
                  <time className="mt-0.5 w-12 shrink-0 font-mono text-[15px] font-medium tabular-nums text-ink-600">{r.time}</time>
                  <span className="min-w-0 text-[17px] leading-snug text-ink-900">{r.label ?? 'Reminder'}</span>
                </div>
                <div className="pl-15">
                  <StatusPill tone={o.tone} icon={o.icon} size="sm">
                    {o.text}
                  </StatusPill>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-[14px] leading-snug text-ink-600">What she told Nami, in her words. Nami doesn’t give medical advice.</p>
    </Section>
  );
}

/* ------------------------------------------------------------- appointments */

const APPT: Record<string, { tone: Tone; icon: LucideIcon; text: string }> = {
  draft: { tone: 'warn', icon: FilePen, text: 'Drafted, waiting for her permission to call' },
  finding_availability: { tone: 'warn', icon: PhoneOutgoing, text: 'Nami is asking the clinic for a slot' },
  awaiting_user_approval: { tone: 'warn', icon: Hourglass, text: 'Slot offered, waiting for her approval' },
  pending_clinic_confirmation: { tone: 'warn', icon: PhoneOutgoing, text: 'Waiting for the clinic to confirm' },
  confirmed: { tone: 'ok', icon: CalendarCheck, text: 'Confirmed by the clinic' },
  failed_needs_help: { tone: 'bad', icon: CalendarX, text: 'Not booked' },
  cancelled: { tone: 'neutral', icon: CalendarX, text: 'Cancelled' },
};

export function AppointmentsSection({ appointments }: { appointments: CareSnapshot['appointments'] }) {
  return (
    <Section title="Appointments" icon={Stethoscope}>
      {appointments.length === 0 ? (
        <Empty>No appointment requests shared.</Empty>
      ) : (
        <ul className="space-y-3">
          {[...appointments].reverse().map((a) => {
            const s = APPT[a.state] ?? { tone: 'neutral' as Tone, icon: CalendarClock, text: a.state };
            const confirmed = a.state === 'confirmed';
            return (
              <li key={a.id} className={`rounded-2xl border p-4 ${confirmed ? 'border-ok-600/25 bg-ok-600/[.05]' : 'border-[#e3d5bd] bg-[#f6efe2]'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold text-ink-900">{a.clinic ?? 'Clinic'}</p>
                    {a.when ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[16px] text-ink-900">
                        <CalendarClock className="size-4 text-teal-700" aria-hidden />
                        {confirmed ? a.when : `Offered: ${a.when}`}
                      </p>
                    ) : null}
                  </div>
                  <StatusPill tone={s.tone} icon={s.icon} size="sm">
                    {s.text}
                  </StatusPill>
                </div>
                {a.failureReason ? <p className="mt-2 text-[15px] leading-snug text-bad-600">Reason: {a.failureReason}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* --------------------------------------------------------- family requests */

export function FamilyRequestsSection({ requests, recipientName }: { requests: CareSnapshot['familyRequests']; recipientName: string }) {
  if (!requests.length) return null;
  return (
    <Section title={`From ${recipientName}`} icon={MessageCircleHeart}>
      <ul className="space-y-3">
        {[...requests].reverse().map((r) => (
          <li key={r.id} className="rounded-2xl bg-[#f6efe2] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[17px] font-semibold text-ink-900">She asked you to get in touch</p>
              <time className="font-mono text-[14px] tabular-nums text-ink-600">{time24(r.createdAt)}</time>
            </div>
            <p className="mt-1 text-[16px] text-ink-900">Reason: {r.reason}</p>
            {r.message ? <p className="mt-1 text-[16px] italic text-ink-600">“{r.message}”</p> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------ closed cases */

function resolutionText(c: CareCase, me: string, recipientName: string) {
  const at = time24(c.resolution?.at) ?? '';
  switch (c.state) {
    case 'resolved_human_reported': {
      const byMe = c.resolution?.by === `contact:${me}`;
      const who = byMe ? 'you' : (c.ownerName ?? 'a family member');
      const note = c.resolution?.note;
      return `Human-reported by ${who} at ${at}${note ? `: “${note}”` : ': spoke with her'}`;
    }
    case 'resolved_user_responded':
      return `${recipientName} responded herself${at ? ` at ${at}` : ''}`;
    case 'cancelled_mistake':
      return `Cancelled${at ? ` at ${at}` : ''}, help was pressed by mistake`;
    default:
      return '';
  }
}

export function PastCasesSection({ cases, me, recipientName }: { cases: CareCase[]; me: string; recipientName: string }) {
  if (!cases.length) return null;
  return (
    <Section title="Earlier today" icon={Inbox}>
      <ul className="space-y-3">
        {[...cases].reverse().map((c) => {
          const sv = caseStateView(c, me);
          return (
            <li key={c.id} className="rounded-2xl border border-[#e3d5bd] bg-[#f6efe2] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[16px] font-semibold text-cocoa-500">
                  {c.type === 'help' ? 'Help request' : 'Check-in'} · {c.openedTime}
                </p>
                <StatusPill tone={sv.tone} icon={sv.icon} size="sm">
                  {sv.label}
                </StatusPill>
              </div>
              <p className="mt-2 text-[17px] leading-snug text-ink-900">{resolutionText(c, me, recipientName)}</p>
              {c.history.length ? (
                <details className="group mt-1">
                  <summary className="mt-2 inline-flex min-h-[44px] cursor-pointer list-none items-center rounded-lg text-[15px] font-semibold text-teal-700 underline-offset-4 hover:underline">
                    Show who was asked
                  </summary>
                  <div className="-mt-4">
                    <CaseHistory c={c} me={me} title="Acknowledgements" />
                  </div>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

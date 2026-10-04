'use client';

import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BellRing,
  CalendarClock,
  Check,
  CircleCheck,
  Clock,
  Eye,
  EyeOff,
  HeartHandshake,
  History,
  LifeBuoy,
  LoaderCircle,
  MessageSquareText,
  Moon,
  Phone,
  PhoneCall,
  PhoneOff,
  Plane,
  RefreshCw,
  TriangleAlert,
  Undo2,
  UserCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { CareSnapshot } from '@/lib/server/snapshot';
import { StatusPill, type Tone } from './StatusPill';
import { time24 } from './format';

export type CareCase = CareSnapshot['cases'][number];
export type CareAction = 'accept' | 'decline' | 'spoke' | 'still_needs_help';
export type ActionResult = { ok: boolean; message: string };

type StateView = { tone: Tone; icon: LucideIcon; label: string; live?: boolean };

export function caseStateView(c: CareCase, me: string): StateView {
  const owner = c.ownerContactId === me ? 'You are' : `${c.ownerName ?? 'A family member'} is`;
  switch (c.state) {
    case 'awaiting_response':
      return { tone: 'warn', icon: Clock, label: 'Waiting for her to respond', live: true };
    case 'retrying_page':
      return { tone: 'warn', icon: RefreshCw, label: 'Asking again on her screen', live: true };
    case 'phone_fallback':
      return { tone: 'warn', icon: PhoneCall, label: 'Trying her phone', live: true };
    case 'escalating':
      return c.isMyTurn
        ? { tone: 'bad', icon: BellRing, label: 'Waiting for your answer', live: true }
        : { tone: 'bad', icon: BellRing, label: 'Family follow-up needed', live: true };
    case 'owner_accepted':
      return { tone: 'ok', icon: UserCheck, label: `${owner} following up` };
    case 'unresolved':
      return { tone: 'bad', icon: TriangleAlert, label: 'Nobody has accepted yet' };
    case 'resolved_user_responded':
      return { tone: 'ok', icon: CircleCheck, label: 'She responded herself' };
    case 'resolved_human_reported':
      return { tone: 'ok', icon: MessageSquareText, label: 'Human-reported' };
    case 'cancelled_mistake':
      return { tone: 'neutral', icon: Undo2, label: 'Cancelled — pressed by mistake' };
    default:
      return { tone: 'neutral', icon: Clock, label: c.state };
  }
}

const ATTEMPT_TEXT: Record<string, string> = {
  accepted: 'Accepted follow-up',
  declined: "Couldn't right now",
  no_answer: 'No answer',
  voicemail: 'Voicemail — not counted as acceptance',
  busy: 'Line busy',
  failed: "Couldn't be reached",
  timeout: 'No reply in time',
  not_configured: 'Not set up',
  responded: 'She responded',
  cancelled: 'Cancelled',
  superseded: 'Someone else accepted first',
};

function attemptView(h: CareCase['history'][number]): { text: string; tone: Tone } {
  if (h.state === 'active' && !h.outcome) return { text: 'Asked — waiting for a reply', tone: 'warn' };
  const text = (h.outcome && ATTEMPT_TEXT[h.outcome]) ?? 'Closed';
  const tone: Tone = h.outcome === 'accepted' ? 'ok' : h.outcome === 'superseded' || h.outcome === 'cancelled' ? 'neutral' : 'bad';
  return { text, tone };
}

function phoneFallbackText(v: NonNullable<CareCase['evidence']>['phoneFallback']) {
  switch (v) {
    case 'not_configured':
      return 'Phone fallback not set up';
    case 'no_answer':
      return 'Phone call: no answer';
    case 'voicemail':
      return 'Phone call: went to voicemail';
    case 'failed':
      return 'Phone call failed';
    case 'busy':
      return 'Phone call: line busy';
    case 'pending':
      return 'Phone call in progress';
    default:
      return null;
  }
}

type Fact = { icon: LucideIcon; text: string; tone?: Tone };

function evidenceFacts(c: CareCase): Fact[] {
  const e = c.evidence;
  if (!e) {
    return c.type === 'help' ? [{ icon: LifeBuoy, text: `Help requested at ${c.openedTime}`, tone: 'help' }] : [{ icon: CalendarClock, text: `Opened at ${c.openedTime}` }];
  }
  const facts: Fact[] = [];
  facts.push({ icon: CalendarClock, text: c.type === 'help' ? `Help requested at ${c.openedTime}` : `Check-in due ${time24(e.checkinDueAt) ?? c.openedTime}` });
  const seen = time24(e.pageLastSeenAt);
  facts.push({ icon: e.pageVisible ? Eye : EyeOff, text: seen ? `Nami page last seen ${seen}` : 'Nami page not seen today' });
  if (e.pageVisible !== null) facts.push({ icon: e.pageVisible ? Eye : EyeOff, text: e.pageVisible ? 'Page was open on her screen' : 'Page was not open on her screen' });
  const last = time24(e.lastExplicitResponseAt);
  facts.push({ icon: MessageSquareText, text: last ? `Last explicit response ${last}` : 'No explicit response today' });
  if (c.type === 'checkin' && e.promptsShown > 0) facts.push({ icon: RefreshCw, text: `Asked on her screen ${e.promptsShown === 1 ? 'once' : `${e.promptsShown} times`}` });
  facts.push({ icon: Moon, text: e.quietHours ? 'Inside her quiet hours' : 'Not quiet hours' });
  facts.push({ icon: Plane, text: e.plannedAbsence ? 'Planned absence is set' : 'No planned absence' });
  const pf = phoneFallbackText(e.phoneFallback);
  if (pf) facts.push({ icon: e.phoneFallback === 'pending' ? PhoneCall : PhoneOff, text: pf });
  return facts;
}

function Btn({
  children,
  icon: Icon,
  variant,
  busy,
  disabled,
  onClick,
  type = 'button',
  ...rest
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  variant: 'primary' | 'secondary' | 'caution';
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type' | 'disabled' | 'children'>) {
  const styles = {
    primary: 'bg-teal-900 text-ivory-50 shadow-[0_6px_18px_rgba(23,61,56,.28)] hover:bg-teal-700 active:translate-y-px',
    secondary: 'border border-line bg-card text-ink-900 hover:border-teal-700/40 hover:bg-ivory-100',
    caution: 'border border-bad-600/35 bg-bad-600/[.06] text-bad-600 hover:bg-bad-600/10',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl px-5 text-[18px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}
      {...rest}
    >
      {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Icon className="size-5" aria-hidden strokeWidth={2.25} />}
      {children}
    </button>
  );
}

function NoteForm({
  label,
  hint,
  placeholder,
  submitLabel,
  submitIcon,
  variant,
  busy,
  onSubmit,
  onCancel,
}: {
  label: string;
  hint: string;
  placeholder: string;
  submitLabel: string;
  submitIcon: LucideIcon;
  variant: 'primary' | 'caution';
  busy: boolean;
  onSubmit: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const id = useId();
  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(note.trim());
      }}
    >
      <div className="mt-1 rounded-2xl border border-line bg-ivory-50 p-4">
        <label htmlFor={id} className="block text-[17px] font-semibold text-ink-900">
          {label}
        </label>
        <p className="mt-1 text-[15px] leading-snug text-ink-600">{hint}</p>
        <textarea
          id={id}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder={placeholder}
          className="mt-3 w-full resize-none rounded-xl border border-line bg-card px-4 py-3 text-[17px] text-ink-900 placeholder:text-ink-600/60 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-sea-500/40"
        />
        <div className="mt-1 text-right text-[13px] text-ink-600">{note.length}/300</div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_auto]">
          <Btn type="submit" icon={submitIcon} variant={variant} busy={busy}>
            {submitLabel}
          </Btn>
          <button type="button" onClick={onCancel} className="min-h-[56px] rounded-2xl px-5 text-[17px] font-semibold text-ink-600 hover:bg-ivory-100">
            Cancel
          </button>
        </div>
      </div>
    </motion.form>
  );
}

export function CaseCard({
  c,
  me,
  recipientName,
  onAction,
}: {
  c: CareCase;
  me: string;
  recipientName: string;
  onAction: (caseId: string, action: CareAction, note?: string) => Promise<ActionResult>;
}) {
  const [busy, setBusy] = useState<CareAction | null>(null);
  const [form, setForm] = useState<'spoke' | 'still_needs_help' | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const help = c.type === 'help';
  const sv = caseStateView(c, me);
  const facts = evidenceFacts(c);
  const iOwn = c.state === 'owner_accepted' && c.ownerContactId === me;
  const canAccept = c.state === 'escalating' || c.state === 'unresolved';
  const trying = c.state === 'awaiting_response' || c.state === 'retrying_page' || c.state === 'phone_fallback';

  async function run(action: CareAction, note?: string) {
    setBusy(action);
    setResult(null);
    try {
      const r = await onAction(c.id, action, note);
      setResult(r);
      if (r.ok) setForm(null);
    } finally {
      setBusy(null);
    }
  }

  const headline = help
    ? `${recipientName} asked for help at ${c.openedTime}`
    : `${recipientName} hasn’t answered today’s ${time24(c.evidence?.checkinDueAt) ?? c.openedTime} check-in`;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-[24px] border bg-card shadow-[0_14px_40px_rgba(23,61,56,.14)] ${help ? 'border-help-600/40' : 'border-line'}`}
      aria-labelledby={`case-${c.id}`}
    >
      <div className={`h-1.5 w-full ${help ? 'bg-help-600' : sv.tone === 'ok' ? 'bg-ok-600' : 'bg-warn-600'}`} aria-hidden />
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.14em] ${help ? 'text-help-600' : 'text-cocoa-500'}`}>
            {help ? <LifeBuoy className="size-4" aria-hidden /> : <CalendarClock className="size-4" aria-hidden />}
            {help ? 'Help request' : 'Daily check-in'}
          </span>
          <span role="status" aria-live="polite">
            <StatusPill tone={sv.tone} icon={sv.icon} live={sv.live}>
              {sv.label}
            </StatusPill>
          </span>
        </div>

        <h2 id={`case-${c.id}`} className="mt-3 font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.01em] text-teal-900 sm:text-[30px]">
          {headline}
        </h2>

        {help ? (
          <a
            href="tel:112"
            className="mt-4 flex min-h-[60px] items-center gap-3 rounded-2xl border-2 border-help-600 bg-help-600/[.06] px-4 py-3 text-help-600 transition hover:bg-help-600/10"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-help-600 text-white">
              <Phone className="size-5" aria-hidden />
            </span>
            <span className="text-[18px] font-semibold leading-tight">
              If this is an emergency, call <span className="underline decoration-2 underline-offset-4">112</span>
            </span>
          </a>
        ) : null}

        <section className="mt-5" aria-label="What Nami knows">
          <h3 className="text-[13px] font-bold uppercase tracking-[.14em] text-ink-600">Facts Nami recorded</h3>
          <ul className="mt-2.5 grid gap-x-5 rounded-2xl bg-ivory-50 px-4 py-2 sm:grid-cols-2">
            {facts.map((f) => (
              <li key={f.text} className="flex items-center gap-3 border-b border-line/70 py-2.5 text-[16px] leading-snug text-ink-900 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${f.tone === 'help' ? 'bg-help-600/10 text-help-600' : 'bg-sea-200/80 text-teal-700'}`}>
                  <f.icon className="size-[15px]" aria-hidden />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[14px] leading-snug text-ink-600">These are facts only. Nami does not guess how she is — a person checks.</p>
        </section>

        {/* ---------------- actions ---------------- */}
        <div className="mt-6 space-y-3">
          {canAccept ? (
            <>
              <p className="text-[17px] leading-snug text-ink-900">
                {c.state === 'unresolved'
                  ? 'Every agreed contact has been tried. You can still accept — a late acceptance still helps.'
                  : c.isMyTurn
                    ? `Can you check on ${recipientName} now? Nobody else is marked as following up.`
                    : `Another family member has been asked. You can still offer to check.`}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Btn icon={Check} variant="primary" busy={busy === 'accept'} disabled={!!busy} onClick={() => run('accept')}>
                  I’ll check now
                </Btn>
                <Btn icon={X} variant="secondary" busy={busy === 'decline'} disabled={!!busy} onClick={() => run('decline')}>
                  I can’t right now
                </Btn>
              </div>
              <p className="text-[14px] text-ink-600">If you can’t, Nami asks the next agreed contact.</p>
            </>
          ) : null}

          {iOwn ? (
            <>
              <div className="flex items-start gap-3 rounded-2xl border border-ok-600/25 bg-ok-600/[.07] p-4">
                <HeartHandshake className="mt-0.5 size-6 shrink-0 text-ok-600" aria-hidden />
                <div>
                  <p className="text-[18px] font-semibold text-ink-900">You are following up — please report back</p>
                  <p className="mt-0.5 text-[15px] leading-snug text-ink-600">
                    Nothing is marked as resolved until you tell Nami what happened.
                  </p>
                </div>
              </div>
              <AnimatePresence initial={false} mode="wait">
                {form === 'spoke' ? (
                  <NoteForm
                    key="spoke"
                    label="What happened? (optional)"
                    hint="Saved exactly as you write it, marked “human-reported” with your name and the time."
                    placeholder="e.g. Called her — she was at the temple and forgot her phone."
                    submitLabel="Send my report"
                    submitIcon={MessageSquareText}
                    variant="primary"
                    busy={busy === 'spoke'}
                    onSubmit={(n) => run('spoke', n)}
                    onCancel={() => setForm(null)}
                  />
                ) : form === 'still_needs_help' ? (
                  <NoteForm
                    key="snh"
                    label="What does she need? (optional)"
                    hint="The case stays open and Nami contacts the next agreed person."
                    placeholder="e.g. Not answering the door — someone nearby should go."
                    submitLabel="Still needs help"
                    submitIcon={TriangleAlert}
                    variant="caution"
                    busy={busy === 'still_needs_help'}
                    onSubmit={(n) => run('still_needs_help', n)}
                    onCancel={() => setForm(null)}
                  />
                ) : (
                  <motion.div key="btns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-3 sm:grid-cols-2">
                    <Btn icon={MessageSquareText} variant="primary" onClick={() => setForm('spoke')}>
                      I spoke with her
                    </Btn>
                    <Btn icon={TriangleAlert} variant="caution" onClick={() => setForm('still_needs_help')}>
                      Still needs help
                    </Btn>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : null}

          {c.state === 'owner_accepted' && !iOwn ? (
            <p className="flex items-start gap-3 rounded-2xl bg-ivory-50 p-4 text-[16px] leading-snug text-ink-900">
              <UserCheck className="mt-0.5 size-5 shrink-0 text-ok-600" aria-hidden />
              {c.ownerName ?? 'A family member'} accepted and is following up. You will see their report here.
            </p>
          ) : null}

          {trying ? (
            <p className="flex items-start gap-3 rounded-2xl bg-ivory-50 p-4 text-[16px] leading-snug text-ink-900">
              <Clock className="mt-0.5 size-5 shrink-0 text-[#8a5a12]" aria-hidden />
              Nami is still trying {recipientName} directly. If she doesn’t respond by the agreed deadline, you’ll be asked here.
            </p>
          ) : null}

          <AnimatePresence>
            {result ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="status"
                className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-[16px] ${result.ok ? 'bg-ok-600/10 text-ok-600' : 'bg-bad-600/10 text-bad-600'}`}
              >
                {result.ok ? <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />}
                <span className="font-medium">{result.message}</span>
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        {c.history.length ? <CaseHistory c={c} me={me} /> : null}
      </div>
    </motion.article>
  );
}

export function CaseHistory({ c, me, title = 'Who has been asked' }: { c: CareCase; me: string; title?: string }) {
  void me;
  return (
    <section className="mt-6 border-t border-line pt-5" aria-label={title}>
      <h3 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.14em] text-ink-600">
        <History className="size-4" aria-hidden />
        {title}
      </h3>
      <ol className="mt-3 space-y-0">
        {c.history.map((h, i) => {
          const v = attemptView(h);
          return (
            <li key={`${h.who}-${h.at}-${i}`} className="relative flex gap-3 pb-3 last:pb-0">
              {i < c.history.length - 1 ? <span className="absolute top-6 left-[7px] h-[calc(100%-12px)] w-px bg-line" aria-hidden /> : null}
              <span className={`relative mt-1.5 size-[15px] shrink-0 rounded-full border-[3px] border-card ring-1 ring-line ${v.tone === 'ok' ? 'bg-ok-600' : v.tone === 'warn' ? 'bg-warn-600' : v.tone === 'bad' ? 'bg-bad-600' : 'bg-ink-600/50'}`} aria-hidden />
              <div className="min-w-0 flex-1 text-[16px] leading-snug">
                <span className="font-semibold text-ink-900">{h.who ?? 'Someone'}</span>
                <span className="text-ink-600"> · {v.text}</span>
              </div>
              <time className="shrink-0 font-mono text-[14px] tabular-nums text-ink-600">{h.at}</time>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

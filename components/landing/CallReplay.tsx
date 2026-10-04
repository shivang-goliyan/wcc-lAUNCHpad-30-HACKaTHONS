'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { clsx } from 'clsx';
import { Check, CircleDashed, Phone, RotateCcw, ShieldCheck } from 'lucide-react';

type Line = { who: 'clinic' | 'nami'; text: string; at: number };

/* Step indices: lines appear at `at`; checks at 5–9; approval 10; yes 11; confirmed 14. */
const LINES: Line[] = [
  { who: 'clinic', at: 1, text: 'Namaste, Dr. Mehta Clinic, Malviya Nagar. Boliye?' },
  {
    who: 'nami',
    at: 2,
    text: 'Namaste! Main Nami hoon, ek AI assistant, Meera Sharma ji ki taraf se. Unhe agle hafte Dr. Mehta ke saath follow-up chahiye, subah ka time.',
  },
  { who: 'clinic', at: 3, text: 'Ek minute dekhti hoon… Thursday, 8 October, subah 10:30 khaali hai.' },
  { who: 'nami', at: 4, text: 'Thursday 8 October, 10:30 AM. Main Meera ji se pooch kar abhi confirm karti hoon.' },
  { who: 'nami', at: 12, text: 'Meera ji ne haan bola hai. Please 10:30 wala slot unke naam pe confirm kar dijiye.' },
  { who: 'clinic', at: 13, text: 'Ho gaya. Thursday 8 October, 10:30, Meera Sharma. Confirmed.' },
];

const CHECKS = ['In your date range', 'Morning window', 'Weekday matches date', 'Exists in clinic calendar', 'Clinic approved'];
const CHECK_AT = 5;
const APPROVAL_AT = 10;
const YES_AT = 11;
const DONE_AT = 14;
const LAST = DONE_AT;

/** ms to wait before advancing to step i+1 */
const DELAYS = [700, 1500, 2300, 2000, 1600, 420, 420, 420, 420, 700, 1300, 1500, 1500, 1500, 5200];

export function CallReplay() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { amount: 0.35 });
  const [step, setStep] = useState(LAST);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    let s = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      timer = setTimeout(() => {
        if (document.hidden) return tick();
        s = s >= LAST ? 0 : s + 1;
        setStep(s);
        tick();
      }, DELAYS[s] ?? 1200);
    };
    // Start from the top whenever it comes into view.
    timer = setTimeout(() => {
      setStep(0);
      tick();
    }, 0);
    return () => clearTimeout(timer);
  }, [inView, reduce, run]);

  const shown = (at: number) => step >= at;
  const typing = LINES.find((l) => l.at === step + 1);
  const done = step >= DONE_AT;
  const seconds = Math.min(94, Math.max(0, step) * 7);

  return (
    <div ref={ref} className="relative">
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1D4842] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className={clsx('grid h-9 w-9 place-items-center rounded-full bg-sea-500/25 text-sea-200', !done && 'lp-pulse')}>
              <Phone className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ivory-50">Caller agent → Dr. Mehta Clinic</p>
              <p className="text-[12.5px] text-sea-200/80">
                Simulated clinic · {done ? 'call ended' : 'on call'} · 0:{String(seconds % 60).padStart(2, '0')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warn-600/50 bg-warn-600/15 px-3 py-1 text-[12.5px] font-semibold text-[#F2C980]">
              Replay of a simulated call
            </span>
            {!reduce ? (
              <button
                type="button"
                onClick={() => setRun((r) => r + 1)}
                className="grid h-9 w-9 place-items-center rounded-full text-sea-200 transition hover:bg-white/10"
                aria-label="Replay from the start"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* transcript: every line is always laid out, so nothing jumps */}
          <ol className="space-y-3 p-5 sm:p-7" aria-label="Call transcript (Hinglish)">
            {LINES.map((l, i) => {
              const visible = shown(l.at);
              const isTyping = typing === l;
              return (
                <li
                  key={i}
                  className={clsx('relative flex', l.who === 'nami' ? 'justify-start' : 'justify-end')}
                  aria-hidden={!visible}
                >
                  <div
                    className={clsx(
                      'max-w-[88%] transition-all duration-500',
                      visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
                    )}
                  >
                    <p className={clsx('mb-1 text-[11.5px] font-semibold tracking-wide uppercase', l.who === 'nami' ? 'text-sea-200/80' : 'text-right text-[#E9C9AE]/80')}>
                      {l.who === 'nami' ? 'Nami (AI)' : 'Receptionist (simulated)'}
                    </p>
                    <p
                      className={clsx(
                        'rounded-2xl px-4 py-2.5 text-[15px] leading-snug',
                        l.who === 'nami' ? 'rounded-tl-md bg-sea-500 text-teal-900' : 'rounded-tr-md bg-ivory-50 text-ink-900',
                      )}
                    >
                      {l.text}
                    </p>
                  </div>
                  {isTyping ? (
                    <span
                      className={clsx(
                        'absolute top-6 flex gap-1 rounded-full px-3 py-2.5',
                        l.who === 'nami' ? 'left-0 bg-sea-500/40' : 'right-0 bg-ivory-50/20',
                      )}
                      aria-hidden
                    >
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="lp-dot h-1.5 w-1.5 rounded-full bg-ivory-50" style={{ animationDelay: `${d * 0.15}s` }} />
                      ))}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          <div className="space-y-4 border-t border-white/10 p-5 sm:p-7 lg:border-t-0 lg:border-l">
            {/* verifier */}
            <div className="rounded-2xl bg-teal-900/70 p-4 ring-1 ring-white/10">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ivory-50">
                <ShieldCheck className="h-4 w-4 text-sea-500" aria-hidden />
                Verifier <span className="font-normal text-sea-200/70">· plain code, not an LLM</span>
              </p>
              <ul className="mt-3 space-y-2">
                {CHECKS.map((c, i) => {
                  const ok = shown(CHECK_AT + i);
                  return (
                    <li key={c} className="flex items-center gap-2.5 text-[14.5px]">
                      <span
                        className={clsx(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-full transition-all duration-300',
                          ok ? 'scale-100 bg-ok-600 text-white' : 'scale-90 bg-white/10 text-sea-200/50',
                        )}
                      >
                        {ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : <CircleDashed className="h-3.5 w-3.5" aria-hidden />}
                      </span>
                      <span className={ok ? 'text-ivory-50' : 'text-sea-200/50'}>{c}</span>
                      <span className="sr-only">{ok ? 'passed' : 'pending'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* approval */}
            <div
              className={clsx(
                'rounded-2xl bg-ivory-50 p-4 text-ink-900 transition-all duration-500',
                shown(APPROVAL_AT) ? 'opacity-100' : 'translate-y-2 opacity-30 grayscale',
              )}
            >
              <p className="text-[12px] font-semibold tracking-wide text-ink-600 uppercase">Meera&rsquo;s approval</p>
              <p className="mt-1 font-display text-[21px] leading-tight text-teal-900">Thursday 8 Oct, 10:30 AM</p>
              <p className="text-[14px] text-ink-600">Dr. Mehta · Malviya Nagar · Confirm?</p>
              <div className="mt-3 flex gap-2" aria-hidden>
                <span
                  key={shown(YES_AT) ? 'pressed' : 'idle'}
                  className={clsx(
                    'inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-semibold',
                    shown(YES_AT) ? 'lp-press bg-ok-600 text-white' : 'bg-teal-900 text-ivory-50',
                  )}
                >
                  Yes, confirm
                </span>
                <span className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink-600">No</span>
              </div>
              <p className={clsx('mt-3 text-[13.5px] text-ink-600 transition-opacity duration-500', shown(YES_AT) ? 'opacity-100' : 'opacity-0')}>
                <span lang="hi" className="font-display text-[15px] text-cocoa-500">
                  “हाँ, कर दो।”
                </span>{' '}
                — checked against Meera&rsquo;s own words
              </p>
            </div>

            {/* outcome */}
            <p
              className={clsx(
                'flex items-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold transition-all duration-500',
                done ? 'bg-ok-600 text-white' : 'bg-white/5 text-sea-200/70',
              )}
            >
              {done ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden /> : <CircleDashed className="h-5 w-5" aria-hidden />}
              {done ? 'Confirmed by the clinic' : shown(YES_AT) ? 'Waiting for the clinic to confirm…' : 'Not booked yet'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

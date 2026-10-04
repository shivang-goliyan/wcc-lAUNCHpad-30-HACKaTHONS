'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { clsx } from 'clsx';
import { CalendarCheck2, Check, Clock3, Link2, UserCheck } from 'lucide-react';

/** 0 = case open, 1 = Arjun accepted, 2 = Arjun reported back. Loops while on screen. */
const DELAYS = [2800, 3000, 4200];

export function CaregiverPhone() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { amount: 0.4 });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    let s = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      t = setTimeout(() => {
        if (!document.hidden) {
          s = (s + 1) % 3;
          setStep(s);
        }
        tick();
      }, DELAYS[s]);
    };
    t = setTimeout(() => {
      setStep(0);
      tick();
    }, 0);
    return () => clearTimeout(t);
  }, [inView, reduce]);

  const accepted = step >= 1;
  const reported = step >= 2;

  return (
    <div ref={ref} className="relative w-[232px] min-[380px]:w-[248px] sm:w-[292px]" role="img" aria-label="Arjun's caregiver view on his phone: a missed check-in, the buttons I'll check now, I can't and I spoke with her, and the shared appointment.">
      <div className="relative rounded-[46px] bg-teal-900 p-[10px] shadow-[0_40px_80px_rgba(23,61,56,0.28)]" aria-hidden>
        <div className="relative overflow-hidden rounded-[37px] bg-ivory-50">
          <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold text-ink-900">
            <span>10:3{reported ? 9 : accepted ? 2 : 1}</span>
            <span className="h-[18px] w-[72px] rounded-full bg-teal-900" />
            <span className="flex gap-0.5">
              <span className="h-2 w-1 rounded-sm bg-ink-900" />
              <span className="h-2.5 w-1 rounded-sm bg-ink-900" />
              <span className="h-3 w-1 rounded-sm bg-ink-900" />
            </span>
          </div>
          <div className="space-y-2.5 px-3.5 pt-2 pb-5">
            <div className="px-1">
              <p className="text-[10.5px] font-semibold tracking-wide text-teal-700 uppercase">Nami Care · for Arjun</p>
              <p className="mt-0.5 font-display text-[19px] leading-tight text-teal-900">Meera Sharma · Jaipur</p>
              <p className="text-[11.5px] text-ink-600">Last response 09:58</p>
            </div>

            <div
              className={clsx(
                'rounded-2xl border-2 p-3 transition-colors duration-500',
                reported ? 'border-ok-600/50 bg-ok-600/[0.07]' : accepted ? 'border-teal-700/40 bg-sea-200/50' : 'border-warn-600/50 bg-warn-600/[0.08]',
              )}
            >
              <p className={clsx('flex items-center gap-1.5 text-[12.5px] font-bold', reported ? 'text-ok-600' : accepted ? 'text-teal-900' : 'text-warn-600')}>
                {reported ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : accepted ? <UserCheck className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                {reported ? 'You reported: spoke with her' : accepted ? 'You accepted · 10:32' : 'Check-in not answered'}
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-ink-600">
                {reported
                  ? 'Saved as human-reported, 10:39. Nami did not decide this.'
                  : accepted
                    ? 'Meera’s screen now says “Arjun is checking on you.”'
                    : 'Since 10:00 · asked again · phone tried'}
              </p>
              {!accepted ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {['Desktop seen 09:58', 'Not quiet hours'].map((f) => (
                    <span key={f} className="rounded-full bg-card px-2 py-0.5 text-[10.5px] text-ink-600">
                      {f}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <span
                key={`a${accepted}`}
                className={clsx(
                  'flex min-h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition-colors',
                  accepted ? 'lp-press bg-sea-200 text-teal-900' : 'bg-teal-900 text-ivory-50',
                )}
              >
                {accepted ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                {accepted ? 'You’re on it' : 'I’ll check now'}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <span className="flex min-h-10 items-center justify-center rounded-xl border border-line bg-card text-[12.5px] font-semibold text-ink-900">I can’t</span>
                <span
                  key={`r${reported}`}
                  className={clsx(
                    'flex min-h-10 items-center justify-center rounded-xl border text-[12.5px] font-semibold',
                    reported ? 'lp-press border-ok-600 bg-ok-600 text-white' : 'border-line bg-card text-ink-900',
                  )}
                >
                  I spoke with her
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl bg-card p-2.5 shadow-sm">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-sea-200 text-teal-900">
                <CalendarCheck2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-ink-900">Dr. Mehta · Thu 8 Oct, 10:30</p>
                <p className="text-[11px] font-semibold text-ok-600">Confirmed by the clinic</p>
              </div>
            </div>

            <p className="flex items-center justify-center gap-1 pt-1 text-[10.5px] text-ink-600">
              <Link2 className="h-3 w-3" /> Link for Arjun only · expires
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

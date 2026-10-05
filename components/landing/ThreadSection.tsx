'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Phone, ShieldCheck } from 'lucide-react';
import { NamiCue } from './NamiCue';

type Who = 'meera' | 'nami' | 'clinic';
type Msg =
  | { kind: 'say'; who: Who; text: string; hi?: boolean; note?: string }
  | { kind: 'call' }
  | { kind: 'checks' }
  | { kind: 'done' };

const THREAD: Msg[] = [
  { kind: 'say', who: 'meera', text: 'Nami, agle hafte Dr. Mehta ke yahan subah ka appointment book kar do.' },
  { kind: 'say', who: 'nami', text: 'Main Dr. Mehta Clinic ko phone karke agle hafte subah ka slot poochhun? Main sirf aapka pehla naam aur “follow-up” bataungi.' },
  { kind: 'say', who: 'meera', text: 'हाँ, कर दो।', hi: true, note: 'consent checked against her own words' },
  { kind: 'call' },
  { kind: 'checks' },
  { kind: 'say', who: 'nami', text: 'Clinic mein Tuesday, 6 October, subah 9:30 khali hai. Book kar doon?' },
  { kind: 'say', who: 'meera', text: 'Haan, ye theek hai.', note: 'second approval, for this exact slot' },
  { kind: 'done' },
];

const AVATAR: Record<Who, string> = { meera: '/people/meera-160.webp', clinic: '/people/clinic-160.webp', nami: '/nami/idle.webp?v=3' };

const CHECKS = ['clinic is on her approved list', 'clinic’s own words quoted', 'date parses, not in the past', 'inside next week', 'in the morning window', 'weekday matches the date', 'slot is in the clinic’s calendar', 'nothing private was said'];
const CHECKS_AT = THREAD.findIndex((m) => m.kind === 'checks');

function Avatar({ who }: { who: Who }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={AVATAR[who]} alt="" className={`h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white ${who === 'nami' ? 'bg-[#eef3ee] object-[50%_20%]' : ''}`} />
  );
}

function Bubble({ m }: { m: Msg }) {
  if (m.kind === 'say') {
    const me = m.who === 'meera';
    return (
      <div className={`flex items-end gap-2 ${me ? 'flex-row-reverse' : ''}`}>
        <Avatar who={m.who} />
        <div className={`max-w-[80%] ${me ? 'text-right' : ''}`}>
          <p
            lang={m.hi ? 'hi' : undefined}
            className={`inline-block rounded-[18px] px-3.5 py-2.5 text-left text-[15.5px] leading-snug ${me ? 'rounded-br-[6px] bg-[#fff1cc] text-ink-900' : 'rounded-bl-[6px] bg-white text-teal-900 shadow-[0_2px_8px_rgba(23,61,56,0.08)]'}`}
          >
            {m.text}
          </p>
          {m.note && (
            <p className="mt-1 flex items-center justify-end gap-1 text-[12px] font-medium text-[#1f5a3b]">
              <Check className="h-3 w-3" aria-hidden /> {m.note}
            </p>
          )}
        </div>
      </div>
    );
  }
  if (m.kind === 'call')
    return (
      <div className="mx-2 rounded-2xl border border-cocoa-300/40 bg-[#fbf3e3] p-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-cocoa-500">
          <Phone className="h-3.5 w-3.5" aria-hidden /> Nami is on the phone with Dr. Mehta Clinic (simulated)
        </p>
        <p className="mt-2 text-[14px] leading-snug text-ink-900">
          <b className="text-teal-900">Nami:</b> Kya agle hafte subah follow-up ka koi slot hai?
          <br />
          <b className="text-cocoa-500">Clinic:</b> Tuesday, 6 October ko subah 9:30 khali hai.
        </p>
      </div>
    );
  if (m.kind === 'checks')
    return (
      <p className="mx-2 flex items-center justify-center gap-1.5 rounded-full bg-[#e3efe6] px-3 py-1.5 text-center text-[12.5px] font-semibold text-[#1f5a3b]">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> 8 of 8 checks passed in plain code
      </p>
    );
  return (
    <div className="mx-2 rounded-2xl bg-teal-900 p-3 text-ivory-50">
      <p className="text-[14px]">
        <b>Clinic:</b> “Haan, confirm ho gaya. Tuesday, 6 October, subah 9:30.”
      </p>
      <p className="mt-1 text-[12.5px] text-sea-200">Marked confirmed only now, on the clinic’s own words. Reminders set.</p>
    </div>
  );
}

/** Plays the thread once, when the phone scrolls into view. Everything shows without JS. */
function usePlayback(n: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(n);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.8) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reset = setTimeout(() => setStep(0), 0);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        let t = 300;
        THREAD.forEach((m, i) => {
          const incoming = !(m.kind === 'say' && m.who === 'meera');
          if (incoming) {
            timers.push(setTimeout(() => setTyping(true), t));
            t += m.kind === 'call' ? 1400 : 900;
          }
          timers.push(
            setTimeout(() => {
              setTyping(false);
              setStep(i + 1);
            }, t),
          );
          t += m.kind === 'checks' ? 1900 : 800;
        });
      },
      { rootMargin: '0px 0px -25% 0px' },
    );
    io.observe(el);
    return () => {
      clearTimeout(reset);
      timers.forEach(clearTimeout);
      io.disconnect();
    };
  }, [n]);
  return { ref, step, typing };
}

/** The appointment, start to finish: the story and the checks on the left, the conversation on a phone on the right. */
export function ThreadSection() {
  const { ref, step, typing } = usePlayback(THREAD.length);
  const checked = step > CHECKS_AT;

  return (
    <section id="thread" aria-labelledby="thread-title" className="sb-paper relative py-20 sm:py-24">
      <NamiCue pose="listening" say="Listening to the clinic. Plain code checks what they say." side="left" />
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-16">
        <div>
          <p className="font-hand text-[20px] text-cocoa-500">the appointment, start to finish</p>
          <h2 id="thread-title" className="mt-2 font-display text-[clamp(2rem,4vw,3.2rem)] leading-[1.06] font-medium text-teal-900 text-balance">
            She phones the clinic. Code checks every word. Meera says yes twice.
          </h2>
          <p className="mt-4 max-w-[34em] text-[17px] leading-relaxed text-ink-600">
            Nothing is booked on an AI&rsquo;s say-so. Before Meera is even asked about a slot, plain code checks what the clinic actually said.
          </p>

          <div className="sb-note relative mt-8 max-w-[34rem] rounded-sm p-5" style={{ ['--tilt' as string]: '-0.8deg' }}>
            <p className="font-hand text-[19px] font-bold text-teal-900">checked by plain code, no AI</p>
            <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-[15px] text-ink-900 sm:grid-cols-2">
              {CHECKS.map((c, k) => (
                <li key={c} className="flex items-center gap-2">
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#1f7a4c]/40 transition-colors duration-300"
                    style={{ transitionDelay: `${k * 160}ms`, backgroundColor: checked ? '#1f7a4c' : 'transparent' }}
                  >
                    <Check className="h-3 w-3 text-white" aria-hidden />
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-[13px] text-ink-600">A recorded run of the live demo. The clinic is simulated: its receptionist is an AI agent with a fixed calendar.</p>
        </div>

        {/* the phone */}
        <div ref={ref} className="relative mx-auto w-full max-w-[400px] lg:max-w-none">
          <div className="rounded-[40px] bg-[#1c2a27] p-2.5 shadow-[0_30px_60px_rgba(40,30,20,0.25)]">
            <div className="overflow-hidden rounded-[32px] bg-[#f4efe6]">
              <div className="flex items-center gap-3 border-b border-black/5 bg-[#fbf7ef] px-4 py-3">
                <Avatar who="nami" />
                <div>
                  <p className="text-[15px] font-semibold text-teal-900">Nami</p>
                  <p className="text-[12px] text-ink-600">{typing ? 'typing…' : 'Meera ji’s companion · AI'}</p>
                </div>
              </div>
              <div className="flex h-[540px] flex-col justify-end gap-3 overflow-hidden px-3 py-4" aria-live="polite">
                {THREAD.slice(0, step).map((m, i) => (
                  <div key={i} className="rp-in">
                    <Bubble m={m} />
                  </div>
                ))}
                {typing && (
                  <div className="flex items-end gap-2" aria-hidden>
                    <Avatar who={step === 3 || step === 7 ? 'clinic' : 'nami'} />
                    <div className="flex gap-1 rounded-[18px] rounded-bl-[6px] bg-white px-3.5 py-3">
                      <span className="lp-dot h-2 w-2 rounded-full bg-teal-700" />
                      <span className="lp-dot h-2 w-2 rounded-full bg-teal-700 [animation-delay:.15s]" />
                      <span className="lp-dot h-2 w-2 rounded-full bg-teal-700 [animation-delay:.3s]" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

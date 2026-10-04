import { Check, Phone } from 'lucide-react';
import { InView } from './InView';
import { NamiSlot } from './NamiSlot';

type Who = 'meera' | 'nami' | 'clinic';
type Msg =
  | { kind: 'say'; who: Who; text: string; hi?: boolean; note?: string }
  | { kind: 'call' }
  | { kind: 'checks' }
  | { kind: 'done' };

const THREAD: Msg[] = [
  { kind: 'say', who: 'meera', text: 'Nami, agle hafte Dr. Mehta ke yahan subah ka appointment book kar do.', hi: true },
  { kind: 'say', who: 'nami', text: 'Main Dr. Mehta Clinic ko phone karke agle hafte subah ka slot poochhun? Main sirf aapka pehla naam aur “follow-up” bataungi.' },
  { kind: 'say', who: 'meera', text: 'हाँ, कर दो।', hi: true, note: 'consent checked against her own words' },
  { kind: 'call' },
  { kind: 'checks' },
  { kind: 'say', who: 'nami', text: 'Clinic mein Tuesday, 6 October, subah 9:30 khali hai. Book kar doon?' },
  { kind: 'say', who: 'meera', text: 'Haan, ye theek hai.', note: 'second approval, for this exact slot' },
  { kind: 'done' },
];

const NAME: Record<Who, string> = { meera: 'Meera ji', nami: 'Nami', clinic: 'Dr. Mehta Clinic' };
const AVATAR: Record<Who, string> = { meera: '/people/meera-160.webp', clinic: '/people/clinic-160.webp', nami: '/nami/idle.webp?v=3' };

const CHECKS = ['clinic is on her approved list', 'clinic’s own words quoted', 'date parses, not in the past', 'inside next week', 'in the morning window', 'weekday matches the date', 'slot is in the clinic’s calendar', 'nothing private was said'];

function Avatar({ who }: { who: Who }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={AVATAR[who]} alt="" className={`h-11 w-11 shrink-0 rounded-[14px] object-cover ring-2 ring-white ${who === 'nami' ? 'bg-[#eef3ee] object-[50%_20%]' : ''}`} />
  );
}

/** The appointment as one conversation, replayed as you reach it. Recorded, and labelled so. */
export function ThreadSection() {
  return (
    <section id="thread" aria-labelledby="thread-title" className="sb-paper relative py-20 sm:py-28">
      <div className="mx-auto max-w-[760px] px-5 sm:px-8">
        <p className="font-hand text-[20px] text-cocoa-500">the appointment, start to finish</p>
        <h2 id="thread-title" className="mt-2 font-display text-[clamp(2rem,4vw,3.2rem)] leading-[1.06] font-medium text-teal-900 text-balance">
          She phones the clinic. Code checks every word. Meera says yes twice.
        </h2>
        <p className="mt-3 text-[14px] text-ink-600">A recorded run of the live demo. The clinic is simulated, and its receptionist is an AI agent with a fixed calendar.</p>

        <div className="relative mt-12">
          <NamiSlot id="thread-lane" pose="listening" say="Listening to the clinic. Plain code checks what they say." className="absolute top-24 hidden h-[168px] w-[168px] xl:block xl:left-[calc(100%+40px)]" />
          <InView amount={0.15}>
            <ol className="space-y-5">
              {THREAD.map((m, i) => (
                <li key={i} className="lp-rise" style={{ ['--d' as string]: `${i * 380}ms` }}>
                  {m.kind === 'say' && (
                    <div className={`flex items-end gap-3 ${m.who === 'meera' ? 'flex-row-reverse text-right' : ''}`}>
                      <Avatar who={m.who} />
                      <div className="max-w-[78%]">
                        <p className="mb-1 text-[12.5px] font-semibold text-ink-600">{NAME[m.who]}</p>
                        <p
                          lang={m.hi ? 'hi' : undefined}
                          className={`inline-block rounded-[20px] px-4 py-3 text-left text-[17px] leading-snug shadow-[0_6px_18px_rgba(70,45,20,0.08)] ${
                            m.who === 'meera' ? 'rounded-br-[6px] bg-[#fff6dd] text-ink-900' : 'rounded-bl-[6px] bg-[#e7f1ec] text-teal-900'
                          }`}
                        >
                          {m.text}
                        </p>
                        {m.note && (
                          <p className="mt-1.5 flex items-center justify-end gap-1 text-[12.5px] font-medium text-[#1f5a3b]">
                            <Check className="h-3.5 w-3.5" aria-hidden /> {m.note}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {m.kind === 'call' && (
                    <div className="sb-note ml-14 rounded-md p-4" style={{ ['--tilt' as string]: '0.6deg' }}>
                      <p className="flex items-center gap-2 text-[14px] font-semibold text-teal-900">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-cocoa-500 text-ivory-50">
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        Phone call · Dr. Mehta Clinic <span className="font-normal text-ink-600">(simulated)</span>
                      </p>
                      <div className="mt-3 flex gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/people/clinic-160.webp" alt="" className="h-12 w-12 rounded-full object-cover" />
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[15px] leading-snug">
                          <dt className="font-semibold text-teal-900">Nami</dt>
                          <dd className="text-ink-900">Kya agle hafte subah Dr. Mehta ke saath follow-up ka koi slot hai?</dd>
                          <dt className="font-semibold text-cocoa-500">Clinic</dt>
                          <dd className="text-ink-900">Tuesday, 6 October ko subah 9:30 khali hai.</dd>
                        </dl>
                      </div>
                    </div>
                  )}
                  {m.kind === 'checks' && (
                    <div className="ml-14 rounded-md border border-dashed border-teal-900/25 bg-white/60 p-4">
                      <p className="text-[13px] font-semibold tracking-wide text-teal-700 uppercase">Verifier · plain code, no AI</p>
                      <ul className="mt-2 grid gap-x-6 gap-y-1 text-[14.5px] text-ink-900 sm:grid-cols-2">
                        {CHECKS.map((c) => (
                          <li key={c} className="flex items-center gap-2">
                            <Check className="h-4 w-4 shrink-0 text-[#1f7a4c]" aria-hidden /> {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {m.kind === 'done' && (
                    <div className="ml-14 rounded-md bg-teal-900 p-4 text-ivory-50">
                      <p className="text-[15px]">
                        <span className="font-semibold">Clinic:</span> “Haan, confirm ho gaya. Tuesday, 6 October, subah 9:30.”
                      </p>
                      <p className="mt-2 text-[13.5px] text-sea-200">
                        Marked confirmed only now, on the clinic’s own words. Reminders added for Monday evening and Tuesday 8:30.
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </InView>
        </div>
      </div>
    </section>
  );
}

import { InView } from './InView';
import { NamiSlot } from './NamiSlot';
import { SceneLife } from './SceneLife';
import type { PoseName } from '@/lib/nami/poses';

type Moment = {
  id: string;
  time: string;
  scene: string;
  title: string;
  body: string;
  pose: PoseName;
  say: string;
  /** which side of the painting the caption note sits on */
  side: 'left' | 'right';
  /** honest status chip under the note */
  chip?: { tone: 'ok' | 'wait' | 'soft'; text: string };
};

const MOMENTS: Moment[] = [
  {
    id: 'sunrise',
    time: '7:00',
    scene: 'day-sunrise',
    title: 'Good morning, Meera ji.',
    body: 'A familiar voice to start the day. Nami says she is an AI, every first hello.',
    pose: 'greeting',
    say: 'Good morning, Meera ji! Chai ho gayi?',
    side: 'left',
  },
  {
    id: 'morning',
    time: '9:00',
    scene: 'day-morning',
    title: 'Time for the BP tablet.',
    body: 'Reminders for medicine, water and her walk. Nami writes down what Meera tells her, never more.',
    pose: 'reminder',
    say: 'BP tablet after breakfast, Meera ji.',
    side: 'right',
    chip: { tone: 'ok', text: '“Le li.” · Meera says she took it, 9:10' },
  },
  {
    id: 'lane',
    time: '11:30',
    scene: 'day-lane',
    title: 'The clinic call, taken care of.',
    body: 'With her OK, Nami phones Dr. Mehta’s clinic, finds a slot, and books it only after Meera says yes.',
    pose: 'calling',
    say: 'Namaste, Dr. Mehta Clinic? I’m calling for Meera ji.',
    side: 'left',
    chip: { tone: 'wait', text: 'Two approvals before anything is booked' },
  },
  {
    id: 'night',
    time: '21:00',
    scene: 'day-night',
    title: 'A little company, a quiet night.',
    body: 'The lamps come on. If tomorrow’s check-in goes unanswered, her family will know, and someone will act.',
    pose: 'quiet',
    say: 'Shubh ratri, Meera ji.',
    side: 'right',
  },
];

const CHIP = { ok: 'bg-[#e3efe6] text-[#1f5a3b]', wait: 'bg-[#f6ead2] text-[#7a531a]', soft: 'bg-ivory-100 text-ink-600' };

/** A painted day, sunrise to night. Nami walks from one moment to the next as you scroll. */
export function DaySection() {
  return (
    <section id="day" aria-labelledby="day-title" className="relative bg-[#fbf7ef] pt-20 pb-6 sm:pt-24">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <p className="font-hand text-[20px] text-cocoa-500">a day with Nami</p>
        <h2 id="day-title" className="mt-2 max-w-[18em] font-display text-[clamp(2rem,4vw,3.3rem)] leading-[1.06] font-medium text-teal-900 text-balance">
          Meera ji lives in Jaipur. Her children live in Bengaluru and Pune.
        </h2>
        <p className="mt-4 max-w-[38em] text-[18px] leading-relaxed text-ink-600">
          1 in 4 Indian elders has no child living at home. Here is one ordinary day, and what Nami does in it.
        </p>
      </div>

      <ol className="mt-12 space-y-16 sm:space-y-20">
        {MOMENTS.map((m, i) => (
          <li key={m.id} className="relative">
            <InView amount={0.25}>
              <figure className="lp-rise relative mx-auto max-w-[1440px] px-0 sm:px-6">
                <div className="relative isolate overflow-hidden sm:rounded-[28px]">
                  <div className="sl-drift">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/scenes/${m.scene}.webp`}
                    srcSet={`/scenes/${m.scene}-sm.webp 958w, /scenes/${m.scene}.webp 1920w`}
                    sizes="100vw"
                    alt=""
                    loading="lazy"
                    className="aspect-[16/9] w-full object-cover sm:aspect-[21/9]"
                  />
                  <SceneLife scene={m.scene} />
                  </div>
                  <div aria-hidden className={`absolute inset-y-0 ${m.side === 'left' ? 'left-0 bg-gradient-to-r' : 'right-0 bg-gradient-to-l'} w-1/2 from-black/25 to-transparent`} />
                </div>
                <figcaption
                  className={`sb-note relative mx-5 -mt-10 max-w-[25rem] rounded-sm p-5 sm:absolute sm:top-1/2 sm:mx-0 sm:mt-0 sm:-translate-y-1/2 ${m.side === 'left' ? 'sm:left-[6%]' : 'sm:right-[6%]'}`}
                  style={{ ['--tilt' as string]: i % 2 ? '1.4deg' : '-1.6deg' }}
                >
                  <span className="font-hand inline-block -rotate-2 rounded-sm bg-teal-900 px-2.5 py-0.5 text-[18px] text-ivory-50">{m.time}</span>
                  <p className="mt-3 font-display text-[clamp(1.4rem,2.4vw,1.9rem)] leading-tight font-medium text-teal-900">{m.title}</p>
                  <p className="mt-2 text-[16px] leading-relaxed text-ink-600">{m.body}</p>
                  {m.chip && <p className={`mt-3 inline-block rounded-md px-2.5 py-1 text-[13.5px] font-semibold ${CHIP[m.chip.tone]}`}>{m.chip.text}</p>}
                </figcaption>
                {/* where she stands in this moment */}
                <NamiSlot
                  id={`day-${m.id}`}
                  pose={m.pose}
                  say={m.say}
                  className={`absolute top-[3%] h-[110px] w-[110px] sm:top-auto sm:bottom-[4%] sm:h-[200px] sm:w-[200px] xl:h-[230px] xl:w-[230px] ${m.side === 'left' ? 'right-[12%]' : 'left-[12%]'}`}
                />
              </figure>
            </InView>
          </li>
        ))}
      </ol>
    </section>
  );
}

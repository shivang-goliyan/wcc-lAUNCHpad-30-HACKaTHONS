import { ArrowRight, EyeOff, Link2, Users } from 'lucide-react';
import { CaregiverPhone } from './CaregiverPhone';
import { NamiSlot } from './NamiSlot';
import { Container, Eyebrow, LANE_RIGHT, SectionTitle } from './ui';

const POINTS = [
  {
    icon: Link2,
    title: 'A link made for one person',
    body: 'Open it from a QR code or a message. It works for one household and one contact, and it expires.',
  },
  {
    icon: EyeOff,
    title: 'Only what Meera chose to share',
    body: 'Check-ins, reminders she reported, appointments. Never her conversations, and no health score.',
  },
  {
    icon: Users,
    title: 'Everyone sees who has it',
    body: '“I’ll check now”, “I can’t” or “I spoke with her”. If several people respond, the owner is clear.',
  },
];

export function Families() {
  return (
    <section id="families" aria-labelledby="families-title" className="relative scroll-mt-4 overflow-hidden bg-sea-200/45 py-20 sm:py-28">
      <div aria-hidden className="lp-grain absolute inset-0 opacity-60" />
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div>
            <Eyebrow>For families</Eyebrow>
            <SectionTitle className="mt-4">
              <span id="families-title">Your phone becomes the safety net. No app to install.</span>
            </SectionTitle>
            <p className="mt-5 max-w-[36em] text-lg leading-relaxed text-ink-600">
              When Nami needs a person, Arjun gets a simple page that says what happened, and three honest buttons.
            </p>
            <ul className="mt-8 space-y-5">
              {POINTS.map((p) => (
                <li key={p.title} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card text-teal-900 shadow-sm">
                    <p.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[17px] font-semibold text-ink-900">{p.title}</h3>
                    <p className="mt-0.5 text-[15.5px] leading-relaxed text-ink-600">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <a
              href="/try"
              className="group mt-9 inline-flex items-center gap-2 text-[16px] font-semibold text-teal-900 underline decoration-sea-500 decoration-2 underline-offset-[6px] hover:decoration-teal-900"
            >
              Open the demo, then scan the caregiver QR with your phone
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </a>
          </div>

          <div className="relative justify-self-start sm:justify-self-center lg:justify-self-end">
            <NamiSlot id="families-lane" pose="point-left" className={`${LANE_RIGHT} top-[calc(50%-84px)]`} />
            <NamiSlot id="families-side" pose="point-left" className="absolute bottom-6 left-[calc(100%-4px)] h-[104px] w-[104px] sm:left-[calc(100%+8px)] sm:h-[124px] sm:w-[124px] lg:hidden" />
            <CaregiverPhone />
          </div>
        </div>
      </Container>
    </section>
  );
}

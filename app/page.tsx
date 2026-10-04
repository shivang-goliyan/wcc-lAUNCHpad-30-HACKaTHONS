import type { Metadata } from 'next';
import '@/components/landing/landing.css';
import { Hero } from '@/components/landing/Hero';
import { Problem } from '@/components/landing/Problem';
import { PeekDivider, SwimDivider } from '@/components/landing/Dividers';
import { Jobs } from '@/components/landing/Jobs';
import { DemoSection, EdgeWave, HonestSection } from '@/components/landing/Sections';
import { Families } from '@/components/landing/Families';
import { Footer, Trust } from '@/components/landing/Footer';
import { RoamingNami } from '@/components/landing/RoamingNami';

export const metadata: Metadata = {
  title: 'Raynet — Nami, your parent’s gentle companion who gets things done',
  description:
    'Nami is an AI otter companion for parents who live alone. She talks in Hindi or English, phones the clinic with their OK, and makes sure a real person follows up. Try the live demo as Meera.',
  openGraph: {
    title: 'Raynet — Nami, a gentle companion who gets things done',
    description:
      'Reminds, books the doctor (with your OK), checks in, and gets your people. Nami never marks anyone safe. A person does.',
    type: 'website',
  },
};

export default function Home() {
  return (
    <main className="relative flex-1 overflow-x-clip bg-ivory-50">
      <Hero />
      <Problem />
      <PeekDivider />
      <Jobs />
      <SwimDivider />
      <DemoSection />
      <EdgeWave from="#173D38" to="#F7F3EA" />
      <HonestSection />
      <Families />
      <Trust />
      <Footer />
      <RoamingNami />
    </main>
  );
}

import type { Metadata } from 'next';
import '@/components/landing/landing.css';
import { ScrapHero } from '@/components/landing/ScrapHero';
import { DaySection } from '@/components/landing/DaySection';
import { ThreadSection } from '@/components/landing/ThreadSection';
import { TwoHomes } from '@/components/landing/TwoHomes';
import { NotesSection } from '@/components/landing/NotesSection';
import { Footer } from '@/components/landing/Footer';
import { RoamingNami } from '@/components/landing/RoamingNami';

export const metadata: Metadata = {
  title: 'Raynet — Nami keeps them company. Raynet makes sure someone shows up.',
  description:
    'Nami is an AI otter companion for parents who live alone. She talks in Hindi or English, phones the clinic with their OK, and makes sure a real person in the family follows up. Try the live demo as Meera.',
  openGraph: {
    title: 'Raynet — Nami keeps them company. Raynet makes sure someone shows up.',
    description: 'Reminds, books the doctor with their OK, checks in, and gets the family to say "I’ve got it". Nami never marks anyone safe. A person does.',
    type: 'website',
  },
};

export default function Home() {
  return (
    <main className="relative flex-1 overflow-x-clip bg-[#fbf7ef]">
      <ScrapHero />
      <DaySection />
      <ThreadSection />
      <TwoHomes />
      <NotesSection />
      <Footer />
      <RoamingNami />
    </main>
  );
}

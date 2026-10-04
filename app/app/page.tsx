import type { Metadata } from 'next';
import AppScreen from '@/components/app/AppScreen';

export const metadata: Metadata = { title: 'Nami — Meera ji’s companion' };

export default function Page() {
  return <AppScreen />;
}

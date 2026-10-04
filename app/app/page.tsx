import type { Metadata } from 'next';
import AppScreen from '@/components/app/AppScreen';

export const metadata: Metadata = { title: 'Nami · Raynet' };

export default function Page() {
  return <AppScreen />;
}

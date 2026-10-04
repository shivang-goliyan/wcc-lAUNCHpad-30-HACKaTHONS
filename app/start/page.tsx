import type { Metadata } from 'next';
import '@/components/landing/landing.css';
import { StartFlow } from '@/components/start/StartFlow';

export const metadata: Metadata = {
  title: 'Set up Nami for your parent · Raynet',
  description: 'A two-minute chat with Nami. Nothing is saved until your parent says yes.',
};

export default function Page() {
  return <StartFlow />;
}

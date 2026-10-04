import type { Metadata } from 'next';
import { ConsoleView } from '@/components/console/ConsoleView';

export const metadata: Metadata = {
  title: 'Agent console · Raynet',
  description: 'How Nami works, live: the agent graph, the audit timeline, call transcripts with verifier checks, and eval results. LLMs propose, code disposes.',
  robots: { index: false, follow: false },
};

export default function ConsolePage() {
  return <ConsoleView />;
}

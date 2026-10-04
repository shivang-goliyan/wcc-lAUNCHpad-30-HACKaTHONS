import type { Metadata } from 'next';
import { CareView } from '@/components/care/CareView';

export const metadata: Metadata = {
  title: 'Caregiver view · Nami Care',
  description: 'A private, consented view for family: open check-ins, shared reminder outcomes and appointment status.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function CarePage(props: PageProps<'/care/[token]'>) {
  const { token } = await props.params;
  return <CareView token={token} />;
}

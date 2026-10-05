import Link from 'next/link';
import '@/components/landing/landing.css';

export const metadata = { title: 'Page not found · Raynet' };

export default function NotFound() {
  return (
    <main className="sb-paper grid min-h-dvh place-items-center px-5 py-16">
      <div className="flex max-w-[34rem] flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nami/thinking.webp?v=3" alt="" className="h-48 w-48 object-contain" />
        <div className="sb-note sb-tape relative mt-2 rounded-sm px-6 py-5" style={{ ['--tilt' as string]: '-1deg' }}>
          <p className="font-hand text-[20px] text-cocoa-500">hmm, this page isn&rsquo;t here</p>
          <h1 className="mt-1 font-display text-[clamp(1.8rem,4vw,2.4rem)] leading-tight font-medium text-teal-900">Nami looked everywhere for it.</h1>
          <p className="mt-2 text-[16px] text-ink-600">The link may be old, or a caregiver link may have expired after 48 hours.</p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex min-h-12 items-center rounded-full bg-teal-900 px-6 text-[16px] font-semibold text-ivory-50 hover:bg-teal-700">
            Back to Raynet
          </Link>
          <a href="/try" className="inline-flex min-h-12 items-center rounded-full bg-card px-6 text-[16px] font-semibold text-teal-900 ring-1 ring-line hover:bg-ivory-100">
            Try the demo as Meera
          </a>
        </div>
      </div>
    </main>
  );
}

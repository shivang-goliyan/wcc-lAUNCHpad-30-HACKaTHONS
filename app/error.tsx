'use client';

import { useEffect } from 'react';
import '@/components/landing/landing.css';

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="sb-paper grid min-h-dvh place-items-center px-5 py-16">
      <div className="flex max-w-[34rem] flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nami/quiet.webp?v=3" alt="" className="h-44 w-44 object-contain" />
        <div className="sb-note relative mt-2 rounded-sm px-6 py-5" style={{ ['--tilt' as string]: '1deg' }}>
          <h1 className="font-display text-[clamp(1.6rem,4vw,2.2rem)] leading-tight font-medium text-teal-900">Something went wrong on our side.</h1>
          <p className="mt-2 text-[16px] text-ink-600">
            Nothing you did. Try again; if it keeps happening, start a fresh demo. In an emergency call <b>112</b>.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={() => retry()} className="inline-flex min-h-12 items-center rounded-full bg-teal-900 px-6 text-[16px] font-semibold text-ivory-50 hover:bg-teal-700">
            Try again
          </button>
          <a href="/" className="inline-flex min-h-12 items-center rounded-full bg-card px-6 text-[16px] font-semibold text-teal-900 ring-1 ring-line hover:bg-ivory-100">
            Back to Raynet
          </a>
        </div>
      </div>
    </main>
  );
}

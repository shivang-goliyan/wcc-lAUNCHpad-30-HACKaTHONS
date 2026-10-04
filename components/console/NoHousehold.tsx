import { ArrowRight, Activity } from 'lucide-react';
import { NamiSvg } from '@/components/nami/NamiSvg';

export function NoHousehold() {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-teal-900 px-4 py-12 text-ivory-50">
      <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-sea-500/15 blur-3xl" aria-hidden />
      <div className="relative w-full max-w-lg text-center">
        <div className="mx-auto flex size-36 items-center justify-center overflow-hidden rounded-full bg-sea-200/20 ring-1 ring-white/15">
          <NamiSvg pose="greeting" className="mt-[14%] h-[115%] w-[115%]" title="Nami waving" />
        </div>
        <p className="mt-6 inline-flex items-center gap-2 text-[13px] font-bold tracking-[.18em] text-sea-500 uppercase">
          <Activity className="size-4" aria-hidden />
          Agent console
        </p>
        <h1 className="mt-2 font-display text-[34px] leading-tight font-semibold sm:text-[42px]">No demo is running in this browser yet</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-sea-200">
          The console shows one demo household: its agents, calls, verifier checks and audit trail. Start a fresh sandbox as Meera, then come back to <code className="font-mono text-ivory-50">/console</code>.
        </p>
        <a
          href="/try"
          className="mt-7 inline-flex min-h-[60px] items-center gap-3 rounded-full bg-sea-500 px-7 text-[18px] font-bold text-teal-900 shadow-[0_10px_30px_rgba(0,0,0,.25)] transition hover:bg-sea-200"
        >
          Start a demo as Meera
          <ArrowRight className="size-5" aria-hidden />
        </a>
        <p className="mt-4 text-[13px] text-sea-200/80">Sandboxes use a simulated clinic and expire after 48 hours.</p>
      </div>
    </main>
  );
}

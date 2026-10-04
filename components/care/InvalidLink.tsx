import { Link2Off, QrCode } from 'lucide-react';
import { NamiAvatar } from './NamiAvatar';

export function InvalidLink() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-ivory-50 px-4 py-10">
      <div className="w-full max-w-md rounded-[28px] border border-line bg-card p-7 text-center shadow-[0_14px_40px_rgba(23,61,56,.12)] sm:p-9">
        <div className="mx-auto flex w-fit items-center justify-center">
          <NamiAvatar className="size-20" />
        </div>
        <span className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-bad-600/25 bg-bad-600/10 px-3 py-1.5 text-[14px] font-semibold text-bad-600">
          <Link2Off className="size-4" aria-hidden />
          Link not valid
        </span>
        <h1 className="mt-4 font-display text-[28px] font-semibold leading-tight text-teal-900">This link is invalid or has expired</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-600">
          Caregiver links are private to one person and last 48 hours. Ask for a fresh link, or scan the QR code on the Nami screen again.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-ivory-50 px-4 py-3 text-[15px] text-ink-600">
          <QrCode className="size-5 text-teal-700" aria-hidden />
          Nami Care · nothing private is shown on this page
        </div>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import type { ConsoleContact } from './types';

export function CaregiverLinks({ contacts }: { contacts: ConsoleContact[] }) {
  return (
    <div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {[...contacts].sort((a, b) => a.priority - b.priority).map((c) => (
          <ContactLink key={c.id} c={c} />
        ))}
      </ul>
      <p className="mt-3 text-[13px] leading-snug text-ink-600">Each link is signed, scoped to one person and one household, and expires after 24 hours. Scan with your phone to become the caregiver.</p>
    </div>
  );
}

function ContactLink({ c }: { c: ConsoleContact }) {
  const [copied, setCopied] = useState(false);
  return (
    <li className="flex gap-4 rounded-2xl border border-line bg-ivory-50 p-4">
      <div className="shrink-0 rounded-xl bg-card p-2 ring-1 ring-line">
        <QRCodeSVG value={c.careUrl} size={112} fgColor="#173D38" bgColor="#FFFDF8" level="M" title={`QR code: caregiver view for ${c.name}`} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="w-fit rounded-full bg-[#f3e6dc] px-2 py-0.5 text-[11px] font-bold tracking-[.08em] text-cocoa-500 uppercase">{c.priority === 1 ? 'Primary' : `Backup ${c.priority - 1}`}</span>
        <p className="mt-1.5 font-display text-[20px] font-semibold text-teal-900">{c.name}</p>
        <p className="text-[13px] text-ink-600">{c.relation}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <a
            href={c.careUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-teal-900 px-3.5 text-[13.5px] font-semibold text-ivory-50 hover:bg-teal-700"
          >
            <ExternalLink className="size-4" aria-hidden />
            Open
          </a>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(c.careUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                /* clipboard blocked: nothing to do */
              }
            }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card px-3.5 text-[13.5px] font-semibold text-ink-900 ring-1 ring-line hover:ring-teal-700/40"
          >
            {copied ? <Check className="size-4 text-ok-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </li>
  );
}

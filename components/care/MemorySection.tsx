'use client';
import { useState } from 'react';
import { ImagePlus, Images } from 'lucide-react';
import type { CareSnapshot } from '@/lib/server/snapshot';
import { Section } from './Sections';

/** Memory Corner: share a family photo + a prompt; see stories Meera chose to send back. */
export function MemorySection({ token, data, onDone }: { token: string; data: CareSnapshot; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data.canShareMemories) return null;
  const name = data.recipient.addressAs;
  return (
    <Section title="Memory Corner" icon={Images}>
      <ul className="space-y-3">
        {data.memoryPrompts.map((m) => (
          <li key={m.id} className="flex gap-3 rounded-xl bg-ivory-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.photoPath} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 text-[15px]">
              <p className="font-semibold text-ink-900">“{m.caption}”</p>
              {m.state === 'sent' && m.story ? (
                <p className="mt-1 text-ink-900">
                  <span className="font-semibold text-cocoa-500">{name} told the story ({m.sentAt}):</span> “{m.story}”
                </p>
              ) : (
                <p className="mt-1 text-ink-600">{m.state === 'kept_private' ? `${name} chose to keep this one private.` : `Waiting — ${name} decides whether to share her story.`}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!file || !caption.trim()) return;
          setBusy(true);
          const fd = new FormData();
          fd.set('photo', file);
          fd.set('caption', caption.trim());
          const r = await fetch(`/api/care/${encodeURIComponent(token)}/memory`, { method: 'POST', body: fd });
          const j = await r.json().catch(() => ({}));
          setBusy(false);
          setMsg(j.ok ? `Shared. Nami will invite ${name} to tell the story — nothing comes back without her OK.` : `Could not share: ${j.error ?? 'error'}`);
          if (j.ok) {
            setFile(null);
            setCaption('');
            onDone();
          }
        }}
      >
        <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-4 text-[15px] text-ink-600 hover:bg-ivory-50">
          <ImagePlus className="size-5 text-teal-700" aria-hidden />
          {file ? file.name : 'Choose an old family photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={140} placeholder={`e.g. “Ma, remember our Shimla trip in 1998?”`} className="min-h-12 w-full rounded-xl border border-line bg-white px-4 text-[16px]" />
        <button disabled={!file || !caption.trim() || busy} className="min-h-12 w-full rounded-full bg-cocoa-500 px-5 text-[16px] font-semibold text-white disabled:opacity-40">
          {busy ? 'Sharing…' : `Share with ${name}`}
        </button>
        {msg && <p className="text-[14px] text-ink-600">{msg}</p>}
      </form>
    </Section>
  );
}

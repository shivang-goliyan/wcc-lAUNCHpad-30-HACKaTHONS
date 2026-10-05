'use client';

import { useState } from 'react';
import { ArrowRight, Phone, PhoneCall } from 'lucide-react';

/**
 * The quickest way to meet Nami: she phones you. You play Meera, an elder living alone;
 * whatever you ask for on the call (your plan, a reminder, a doctor's appointment)
 * happens on her screen. Calls are capped server-side (D25).
 */
export function CallMe() {
  const [to, setTo] = useState('');
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [mine, setMine] = useState(false);
  const [state, setState] = useState<{ kind: 'idle' | 'calling' | 'placed' | 'error'; msg?: string }>({ kind: 'idle' });

  const call = async () => {
    setState({ kind: 'calling' });
    try {
      const r = await fetch('/api/phone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, lang, mine: true }) });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) setState({ kind: 'placed' });
      else setState({ kind: 'error', msg: j?.error ?? 'Something went wrong. Please try again.' });
    } catch {
      setState({ kind: 'error', msg: 'No connection. Please try again.' });
    }
  };

  return (
    <section id="call" aria-labelledby="call-title" className="relative bg-[#fbf7ef] py-16 sm:py-20">
      <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16">
        <div>
          <p className="font-hand text-[20px] text-cocoa-500">no app, no sign-up, just a phone</p>
          <h2 id="call-title" className="mt-2 font-display text-[clamp(2rem,4vw,3.2rem)] leading-[1.06] font-medium text-teal-900 text-balance">
            Let Nami call you.
          </h2>
          <p className="mt-4 max-w-[34em] text-[18px] leading-relaxed text-ink-600">
            Most parents who live alone don&rsquo;t have a smartphone. So Nami can simply ring. Be Meera ji for three minutes: ask about your day, tell her you took your tablet, or ask her to book Dr. Mehta.
          </p>
          <ul className="mt-5 space-y-2 text-[16px] text-ink-900">
            <li className="flex gap-2"><span className="text-cocoa-500">1.</span> Enter your mobile number and pick English or Hindi.</li>
            <li className="flex gap-2"><span className="text-cocoa-500">2.</span> Pick up. Nami says she&rsquo;s an AI, then just talk.</li>
            <li className="flex gap-2"><span className="text-cocoa-500">3.</span> Watch what you asked for appear on Meera&rsquo;s screen.</li>
          </ul>
        </div>

        <div className="sb-note relative rounded-[22px] p-6 sm:p-7" style={{ ['--tilt' as string]: '0.8deg' }}>
          <p className="flex items-center gap-2 font-display text-[22px] font-semibold text-teal-900">
            <PhoneCall className="h-5 w-5" aria-hidden /> Nami calls your phone
          </p>
          {state.kind === 'placed' ? (
            <div className="mt-4" role="status">
              <p className="text-[18px] font-semibold text-teal-900">Calling you now. Pick up and say hello.</p>
              <p className="mt-1 text-[15px] text-ink-600">The call ends by itself after 3 minutes.</p>
              <a href="/app" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-teal-900 px-6 text-[16px] font-semibold text-ivory-50 hover:bg-teal-700">
                Watch it on Meera&rsquo;s screen <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          ) : (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (mine && to.trim() && state.kind !== 'calling') void call();
              }}
            >
              <label className="block text-[14px] font-semibold text-ink-900" htmlFor="callme-phone">
                Your mobile number
              </label>
              <div className="flex gap-2">
                <input
                  id="callme-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98765 43210 or +1 …"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="min-h-13 w-full rounded-xl border border-[#e3d5bd] bg-white px-4 text-[17px] text-ink-900 outline-none focus:border-teal-700"
                />
                <select aria-label="Language for the call" value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'hi')} className="min-h-13 rounded-xl border border-[#e3d5bd] bg-white px-2 text-[15px]">
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                </select>
              </div>
              <label className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-600">
                <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="mt-0.5 size-4.5 shrink-0 accent-teal-900" />
                This is my own phone, and Nami may call it once for this demo. Indian and US numbers.
              </label>
              <button
                type="submit"
                disabled={!mine || !to.trim() || state.kind === 'calling'}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-cocoa-500 px-5 text-[17px] font-semibold text-ivory-50 shadow-[0_12px_28px_rgba(140,80,50,0.28)] hover:bg-[#7a4a32] disabled:opacity-50 disabled:shadow-none"
              >
                <Phone className="h-5 w-5" aria-hidden /> {state.kind === 'calling' ? 'Placing the call…' : 'Call me now'}
              </button>
              {state.kind === 'error' && (
                <p className="text-[14px] font-semibold text-help-600" role="alert">
                  {state.msg}
                </p>
              )}
              <p className="text-[12.5px] text-ink-600">A real call from a US number, about 3 minutes. The clinic Nami may call during the demo is simulated.</p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

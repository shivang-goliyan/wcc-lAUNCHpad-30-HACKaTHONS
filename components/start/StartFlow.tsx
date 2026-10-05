'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Plus, Volume2, X } from 'lucide-react';
import { NamiImage } from '@/components/nami/NamiImage';
import { OnboardProfile } from '@/lib/onboarding';
import type { PoseName } from '@/lib/nami/poses';
import { speak, stopSpeaking } from '@/lib/client/speak';

type SetupBy = 'child' | 'self' | 'together';
type Lang = 'hi' | 'en' | 'auto';
type Med = { label: string; time: string };
type Person = { name: string; relation: string; phone: string };
type Step = 'who' | 'parent' | 'day' | 'people' | 'clinic' | 'handoff' | 'ask' | 'notnow' | 'saving' | 'done';

type Draft = {
  setupBy: SetupBy | null;
  firstName: string;
  addressAs: string;
  city: string;
  language: Lang | null;
  checkinTime: string;
  customTime: boolean;
  meds: Med[];
  water: boolean;
  walk: boolean;
  people: Person[];
  clinic: string;
  doctor: string;
};

const blank: Draft = {
  setupBy: null,
  firstName: '',
  addressAs: '',
  city: '',
  language: null,
  checkinTime: '09:00',
  customTime: false,
  meds: [],
  water: true,
  walk: true,
  people: [{ name: '', relation: '', phone: '' }],
  clinic: '',
  doctor: '',
};

const DOTS: Step[] = ['who', 'parent', 'day', 'people', 'clinic', 'ask'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^\+?[0-9 ]{7,16}$/;

const POSE: Record<Step, PoseName> = {
  who: 'greeting',
  parent: 'listening',
  day: 'reminder',
  people: 'calling',
  clinic: 'thinking',
  handoff: 'idle',
  ask: 'greeting',
  notnow: 'heart',
  saving: 'thinking',
  done: 'celebrate',
};

function hiTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const part = h < 4 ? 'रात' : h < 12 ? 'सुबह' : h < 16 ? 'दोपहर' : h < 19 ? 'शाम' : 'रात';
  return `${part} ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} बजे`;
}

function enTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

const joinHi = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} और ${xs[xs.length - 1]}`);
const joinEn = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What Nami says to the parent on the last step, in their language. */
function consentLines(d: Draft) {
  const name = d.addressAs.trim();
  const who = d.people[0]?.name.trim() || 'family';
  const fam = d.setupBy !== 'self';
  const hiList = [d.meds.length ? 'दवाई' : '', d.water ? 'पानी' : '', d.walk ? 'शाम की सैर' : ''].filter(Boolean);
  const enList = [d.meds.length ? 'your medicines' : '', d.water ? 'drinking water' : '', d.walk ? 'your evening walk' : ''].filter(Boolean);
  const hi = [
    `नमस्ते ${name}। मैं नामी हूँ।`,
    'मैं एक AI हूँ, कोई इंसान नहीं।',
    fam ? 'आपके परिवार ने मुझसे कहा है कि मैं आपका साथ दूँ।' : '',
    hiList.length
      ? `मैं आपको ${joinHi(hiList)} की याद दिलाऊँगी, और रोज़ ${hiTime(d.checkinTime)} आपका हालचाल पूछूँगी।`
      : `मैं रोज़ ${hiTime(d.checkinTime)} आपका हालचाल पूछूँगी।`,
    `अगर आप जवाब न दें, तो मैं ${who} से कहूँगी कि वो आपसे बात कर लें।`,
    'आप कभी भी मना कर सकते हैं।',
    'क्या यह ठीक है?',
  ].filter(Boolean);
  const en = [
    `Hello ${name}. I'm Nami.`,
    "I'm an AI, not a person.",
    fam ? 'Your family asked me to keep you company.' : '',
    enList.length
      ? `I'll remind you about ${joinEn(enList)}, and check in with you every day at ${enTime(d.checkinTime)}.`
      : `I'll check in with you every day at ${enTime(d.checkinTime)}.`,
    `If you don't answer, I'll ask ${who} to get in touch with you.`,
    'You can say no, now or later.',
    'Is that all right with you?',
  ].filter(Boolean);
  return { hi, en };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function StartFlow() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [d, setD] = useState<Draft>(blank);
  const [step, setStep] = useState<Step>('who');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [mouth, setMouth] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const shown = useRef<Step>('who');

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  // move focus to Nami's question so screen readers and keyboards follow along
  useEffect(() => {
    if (shown.current === step) return;
    shown.current = step;
    headRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [step, reduced]);

  // a little mouth movement while the browser voice reads her words
  useEffect(() => {
    if (!speaking) return;
    const id = window.setInterval(() => setMouth((m) => (m > 0.3 ? 0.15 : 0.55)), 150);
    return () => {
      window.clearInterval(id);
      setMouth(0);
    };
  }, [speaking]);

  useEffect(() => () => stopSpeaking(), []);

  // errors show after a try at Next, and each one goes away as soon as it's fixed
  const live = Object.keys(errors).length ? check(step) : {};
  const err = (k: string) => (errors[k] ? live[k] : undefined);

  const self = d.setupBy === 'self';
  const them = d.addressAs.trim() || d.firstName.trim() || (self ? 'you' : 'them');
  const lang = d.language ?? 'auto';
  const parentHi = lang !== 'en';

  function go(s: Step) {
    stopSpeaking();
    setSpeaking(false);
    setErrors({});
    setFailure(null);
    setStep(s);
  }

  function check(s: Step): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 'who' && !d.setupBy) e.setupBy = 'Pick one to carry on.';
    if (s === 'parent') {
      if (!d.firstName.trim()) e.firstName = 'Please add a first name.';
      if (!d.addressAs.trim()) e.addressAs = 'How should Nami address them? Tap a suggestion or type one.';
      if (!d.city.trim()) e.city = 'Which city? It helps with the weather and the clinic.';
      if (!d.language) e.language = 'Pick a language.';
    }
    if (s === 'day') {
      if (!TIME_RE.test(d.checkinTime)) e.checkinTime = 'Pick a time for the daily check-in.';
      d.meds.forEach((m, i) => {
        if (!m.label.trim()) e[`med${i}`] = 'Name the medicine, or remove this row.';
        else if (!TIME_RE.test(m.time)) e[`med${i}`] = 'Pick a time for this one.';
      });
    }
    if (s === 'people') {
      d.people.forEach((p, i) => {
        if (!p.name.trim()) e[`p${i}name`] = 'Please add a name.';
        if (!p.relation.trim()) e[`p${i}rel`] = 'How are they related?';
        if (p.phone.trim() && !PHONE_RE.test(p.phone.trim())) e[`p${i}phone`] = 'That number looks off. Digits only, or leave it empty.';
      });
    }
    if (s === 'clinic' && !d.clinic.trim()) e.clinic = 'Which clinic do they usually go to?';
    return e;
  }

  function next(s: Step, to: Step) {
    const e = check(s);
    setErrors(e);
    if (Object.keys(e).length) {
      const firstKey = Object.keys(e)[0];
      window.setTimeout(() => document.getElementById(`f-${firstKey}`)?.focus(), 0);
      return;
    }
    go(to);
  }

  async function agree() {
    const body = {
      setupBy: d.setupBy,
      parent: { firstName: d.firstName.trim(), lastName: '', addressAs: d.addressAs.trim(), city: d.city.trim(), language: lang },
      checkinTime: d.checkinTime,
      medicines: d.meds.map((m) => ({ label: m.label.trim(), time: m.time })),
      water: d.water,
      walk: d.walk,
      contacts: d.people.map((p) => ({ name: p.name.trim(), relation: p.relation.trim(), phone: p.phone.trim() })),
      clinic: { name: d.clinic.trim(), doctor: d.doctor.trim() },
      consent: { source: 'button' as const },
    };
    const ok = OnboardProfile.safeParse(body);
    if (!ok.success) {
      setFailure("Something in the details doesn't look right. Go back and check them.");
      return;
    }
    go('saving');
    try {
      const res = await fetch('/api/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ok.data) });
      const out = (await res.json().catch(() => null)) as { ok?: boolean; next?: string; message?: string } | null;
      if (!res.ok || !out?.ok) throw new Error(out?.message || "We couldn't save that just now.");
      setStep('done');
      window.setTimeout(() => router.push(out.next || '/app'), reduced ? 400 : 1600);
    } catch (err) {
      setStep('ask');
      setFailure(err instanceof Error ? err.message : "We couldn't save that just now.");
    }
  }

  function listen() {
    const { hi, en } = consentLines(d);
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const text = (parentHi ? hi : en).join(' ');
    speak(text, { lang: parentHi ? 'hi' : 'en', onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) });
  }

  const dot = DOTS.indexOf(step === 'handoff' || step === 'notnow' || step === 'saving' || step === 'done' ? 'ask' : step);

  if (step === 'handoff') {
    const together = d.setupBy === 'together';
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-teal-900 px-5 py-10 text-center text-ivory-50">
        <div className="w-[min(46vw,200px)]">
          <NamiImage pose="idle" reducedMotion={reduced} className="w-full" />
        </div>
        <h1 ref={headRef} tabIndex={-1} className="mt-6 max-w-[16ch] font-display text-[clamp(2.2rem,7vw,3.6rem)] leading-[1.05] font-medium text-balance focus:outline-none focus-visible:outline-none">
          {together ? `Now let ${them} answer this one.` : `Please hand the phone to ${them}.`}
        </h1>
        <p className="mt-5 max-w-[30rem] text-[19px] leading-relaxed text-ivory-100">
          {together
            ? "Nami will ask them herself. It's their choice, and nothing is saved unless they say yes."
            : 'Nami would like to ask them herself. Nothing is saved unless they say yes.'}
        </p>
        <div className="mt-9 flex w-full max-w-[26rem] flex-col gap-3">
          <button type="button" onClick={() => go('ask')} className="min-h-16 rounded-full bg-ivory-50 px-7 text-[20px] font-semibold text-teal-900 transition hover:bg-white">
            {together ? "We're ready" : `${them} has the phone`}
          </button>
          <button type="button" onClick={() => go('clinic')} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-6 text-[17px] text-ivory-100 underline-offset-4 hover:underline">
            <ArrowLeft className="h-5 w-5" aria-hidden /> Back
          </button>
        </div>
      </main>
    );
  }

  const lines = consentLines(d);

  return (
    <main className="sb-paper flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-4 pt-5 sm:px-8">
        <Link href="/" className="flex items-baseline gap-2 rounded-lg" aria-label="Raynet home">
          <span className="font-display text-[24px] font-semibold tracking-tight text-teal-900 sm:text-[26px]">Raynet</span>
          <span className="font-hand hidden text-[16px] text-cocoa-500 sm:inline">setting up Nami</span>
        </Link>
        <ol aria-label={`Step ${dot + 1} of ${DOTS.length}`} className="flex items-center gap-2">
          {DOTS.map((s, i) => (
            <li
              key={s}
              aria-current={i === dot ? 'step' : undefined}
              className={`h-2.5 rounded-full transition-all ${i === dot ? 'w-7 bg-cocoa-500' : i < dot ? 'w-2.5 bg-teal-900' : 'w-2.5 bg-[#d9cdb8]'}`}
            >
              <span className="sr-only">{i < dot ? 'done' : i === dot ? 'current' : 'to do'}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className="mx-auto grid w-full max-w-[1120px] flex-1 grid-cols-1 gap-5 px-4 pt-6 pb-12 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12 lg:pt-12">
        {/* Nami and her question. The question is real text, never inside the picture. */}
        <section aria-label="Nami" className={`flex gap-3 lg:sticky ${step === 'ask' ? 'flex-col items-start' : 'items-start'} lg:top-8 lg:flex-col lg:items-center lg:self-start`}>
          <div className="w-[96px] shrink-0 sm:w-[120px] lg:order-2 lg:mt-2 lg:w-[min(100%,300px)]">
            <NamiImage pose={POSE[step]} mouth={mouth} reducedMotion={reduced} className="w-full drop-shadow-[0_16px_20px_rgba(23,61,56,.16)]" />
          </div>
          <div className={`sb-note sb-yellow sb-tape relative min-w-0 rounded-sm ${step === 'ask' ? 'w-full' : 'flex-1'} px-4 pt-5 pb-4 sm:px-6 lg:order-1 lg:w-full lg:flex-none`} style={{ ['--tilt' as string]: '-0.8deg' }}>
            <p className="font-hand text-[15px] text-cocoa-500">{step === 'ask' || step === 'notnow' || step === 'done' ? `Nami, to ${them}` : 'Nami asks'}</p>
            <h1 ref={headRef} tabIndex={-1} className={`mt-1 font-display font-medium text-teal-900 focus:outline-none focus-visible:outline-none ${step === 'ask' ? 'text-[clamp(1.25rem,3.6vw,1.6rem)] leading-[1.3]' : 'text-[clamp(1.35rem,4.6vw,2.1rem)] leading-[1.15] text-balance'}`}
              lang={step === 'ask' && parentHi ? 'hi' : undefined}>
              <Question step={step} d={d} them={them} self={self} parentHi={parentHi} />
            </h1>
          </div>
        </section>

        <section aria-label="Your answer" className="min-w-0">
          {step === 'who' && (
            <Card>
              <p className="text-[18px] leading-relaxed text-ink-600">It takes about two minutes. Nothing is saved until the person Nami will look after says yes.</p>
              <Choices
                label="Choose one"
                error={err('setupBy')}
                id="f-setupBy"
                value={d.setupBy}
                onPick={(v) => {
                  set('setupBy', v as SetupBy);
                  setErrors({});
                }}
                options={[
                  { v: 'child', t: 'For my mother or father', s: "You're helping a parent who lives on their own" },
                  { v: 'self', t: 'For myself', s: 'You want Nami for yourself' },
                  { v: 'together', t: "We're doing it together", s: 'Parent and family, side by side' },
                ]}
              />
              <Nav back={{ href: '/' }} onNext={() => next('who', 'parent')} />
            </Card>
          )}

          {step === 'parent' && (
            <Card>
              <Field id="f-firstName" label={self ? 'Your first name' : 'Their first name'} error={err('firstName')}>
                <input id="f-firstName" value={d.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" maxLength={40} className={inputCls(err('firstName'))} aria-invalid={!!err('firstName')} aria-describedby={err('firstName') ? 'f-firstName-err' : undefined} />
              </Field>
              <Field id="f-addressAs" label={self ? 'What should Nami call you?' : 'What should Nami call them?'} error={err('addressAs')}>
                <Chips
                  label="Suggestions"
                  value={d.addressAs}
                  onPick={(v) => set('addressAs', v)}
                  options={(self ? [d.firstName.trim() && `${d.firstName.trim()} ji`, d.firstName.trim(), 'Aunty', 'Uncle'] : ['Ma', 'Papa', d.firstName.trim() && `${d.firstName.trim()} ji`, 'Aunty', 'Uncle']).filter(Boolean) as string[]}
                />
                <input id="f-addressAs" value={d.addressAs} onChange={(e) => set('addressAs', e.target.value)} placeholder="or type it" autoComplete="off" maxLength={30} className={`${inputCls(err('addressAs'))} mt-3`} aria-invalid={!!err('addressAs')} aria-describedby={err('addressAs') ? 'f-addressAs-err' : undefined} />
              </Field>
              <Field id="f-city" label={self ? 'Which city do you live in?' : 'Which city do they live in?'} error={err('city')}>
                <input id="f-city" value={d.city} onChange={(e) => set('city', e.target.value)} placeholder="Jaipur, Lucknow, Kochi..." autoComplete="address-level2" maxLength={40} className={inputCls(err('city'))} aria-invalid={!!err('city')} aria-describedby={err('city') ? 'f-city-err' : undefined} />
              </Field>
              <Choices
                label={self ? 'Which language should Nami speak?' : 'Which language should Nami speak with them?'}
                id="f-language"
                error={err('language')}
                value={d.language}
                onPick={(v) => set('language', v as Lang)}
                row
                options={[
                  { v: 'hi', t: 'Hindi', s: 'हिन्दी', lang: 'hi' },
                  { v: 'en', t: 'English' },
                  { v: 'auto', t: 'Both', s: 'she follows their lead' },
                ]}
              />
              <Nav onBack={() => go('who')} onNext={() => next('parent', 'day')} />
            </Card>
          )}

          {step === 'day' && (
            <Card>
              <Field id="f-checkinTime" label="Daily check-in time" hint={`Nami says hello at this time. If ${self ? 'you don’t' : 'they don’t'} answer, she asks the family.`} error={err('checkinTime')}>
                <Chips
                  label="Check-in time"
                  value={d.customTime ? 'other' : d.checkinTime}
                  onPick={(v) => {
                    if (v === 'other') set('customTime', true);
                    else setD((x) => ({ ...x, checkinTime: v, customTime: false }));
                  }}
                  options={['08:00', '09:00', '10:00', 'other']}
                  show={(v) => (v === 'other' ? 'Another time' : enTime(v))}
                />
                {d.customTime && (
                  <input id="f-checkinTime" type="time" value={d.checkinTime} onChange={(e) => set('checkinTime', e.target.value)} className={`${inputCls(err('checkinTime'))} mt-3 max-w-[12rem]`} aria-label="Check-in time" />
                )}
              </Field>

              <fieldset className="mt-7">
                <legend className="text-[19px] font-semibold text-teal-900">Medicines to remind about</legend>
                <p className="mt-1 text-[16px] text-ink-600">Optional. Up to three now. More can be added later by just telling Nami.</p>
                <ul className="mt-3 space-y-3">
                  {d.meds.map((m, i) => (
                    <li key={i} className="rounded-xl border border-line bg-white/60 p-3">
                      <div className="grid grid-cols-[1fr_auto] items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
                        <label className="col-span-2 sm:col-span-1">
                          <span className="block text-[15px] font-medium text-ink-600">Medicine {i + 1}</span>
                          <input
                            id={`f-med${i}`}
                            value={m.label}
                            onChange={(e) => set('meds', d.meds.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                            placeholder="BP tablet after breakfast"
                            maxLength={60}
                            className={`${inputCls(err(`med${i}`))} mt-1`}
                            aria-invalid={!!err(`med${i}`)}
                            aria-describedby={err(`med${i}`) ? `f-med${i}-err` : undefined}
                          />
                        </label>
                        <label>
                          <span className="block text-[15px] font-medium text-ink-600">At</span>
                          <input type="time" value={m.time} onChange={(e) => set('meds', d.meds.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} className={`${inputCls()} mt-1 w-[10rem]`} aria-label={`Time for medicine ${i + 1}`} />
                        </label>
                        <button type="button" onClick={() => set('meds', d.meds.filter((_, j) => j !== i))} className="inline-flex min-h-14 min-w-14 items-center justify-center rounded-xl text-ink-600 hover:bg-[#efe6d6]" aria-label={`Remove medicine ${i + 1}`}>
                          <X className="h-6 w-6" aria-hidden />
                        </button>
                      </div>
                      {err(`med${i}`) && <Err id={`f-med${i}-err`}>{err(`med${i}`)}</Err>}
                    </li>
                  ))}
                </ul>
                {d.meds.length < 3 && (
                  <button type="button" onClick={() => set('meds', [...d.meds, { label: '', time: '09:00' }])} className="mt-3 inline-flex min-h-14 items-center gap-2 rounded-full border-2 border-dashed border-cocoa-300 px-5 text-[18px] font-medium text-cocoa-500 hover:border-cocoa-500">
                    <Plus className="h-5 w-5" aria-hidden /> {d.meds.length ? 'Add another medicine' : 'Add a medicine'}
                  </button>
                )}
              </fieldset>

              <fieldset className="mt-7">
                <legend className="text-[19px] font-semibold text-teal-900">Small things through the day</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Toggle on={d.water} onClick={() => set('water', !d.water)} title="Water reminders" sub="A glass at 11:30 and 3:30" />
                  <Toggle on={d.walk} onClick={() => set('walk', !d.walk)} title="Evening walk" sub="A nudge at 5:30" />
                </div>
              </fieldset>
              <Nav onBack={() => go('parent')} onNext={() => next('day', 'people')} />
            </Card>
          )}

          {step === 'people' && (
            <Card>
              <p className="text-[18px] leading-relaxed text-ink-600">
                Nami asks this person to get in touch with {self ? 'you' : them}, and waits for a real person to say they&rsquo;ve got it. She never decides that on her own.
              </p>
              {d.people.map((p, i) => (
                <fieldset key={i} className="mt-6 rounded-2xl border border-line bg-white/55 p-4 sm:p-5">
                  <legend className="px-1 font-hand text-[19px] text-cocoa-500">{i === 0 ? 'Ask first' : 'If they don’t reply, ask'}</legend>
                  <Field id={`f-p${i}name`} label="Name" error={err(`p${i}name`)} tight>
                    <input id={`f-p${i}name`} value={p.name} onChange={(e) => set('people', d.people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} autoComplete="off" maxLength={40} className={inputCls(err(`p${i}name`))} aria-invalid={!!err(`p${i}name`)} aria-describedby={err(`p${i}name`) ? `f-p${i}name-err` : undefined} />
                  </Field>
                  <Field id={`f-p${i}rel`} label={self ? 'How are they related to you?' : `How are they related to ${them}?`} error={err(`p${i}rel`)}>
                    <Chips label="Relation" value={p.relation} onPick={(v) => set('people', d.people.map((x, j) => (j === i ? { ...x, relation: v } : x)))} options={['Son', 'Daughter', 'Neighbour', 'Friend']} />
                    <input id={`f-p${i}rel`} value={p.relation} onChange={(e) => set('people', d.people.map((x, j) => (j === i ? { ...x, relation: e.target.value } : x)))} placeholder="or type it" autoComplete="off" maxLength={40} className={`${inputCls(err(`p${i}rel`))} mt-3`} aria-invalid={!!err(`p${i}rel`)} aria-describedby={err(`p${i}rel`) ? `f-p${i}rel-err` : undefined} />
                  </Field>
                  <Field id={`f-p${i}phone`} label="Phone (optional)" hint="In the demo, family is reached by a link, not a call." error={err(`p${i}phone`)}>
                    <input id={`f-p${i}phone`} type="tel" inputMode="tel" value={p.phone} onChange={(e) => set('people', d.people.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} placeholder="+91 98xxx xxxxx" autoComplete="off" className={`${inputCls(err(`p${i}phone`))} max-w-[18rem]`} aria-invalid={!!err(`p${i}phone`)} aria-describedby={`f-p${i}phone-hint${err(`p${i}phone`) ? ` f-p${i}phone-err` : ''}`} />
                  </Field>
                  {i === 1 && (
                    <button type="button" onClick={() => set('people', d.people.slice(0, 1))} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full px-3 text-[16px] text-ink-600 hover:bg-[#efe6d6]">
                      <X className="h-5 w-5" aria-hidden /> Remove this person
                    </button>
                  )}
                </fieldset>
              ))}
              {d.people.length < 2 && (
                <button type="button" onClick={() => set('people', [...d.people, { name: '', relation: '', phone: '' }])} className="mt-4 inline-flex min-h-14 items-center gap-2 rounded-full border-2 border-dashed border-cocoa-300 px-5 text-[18px] font-medium text-cocoa-500 hover:border-cocoa-500">
                  <Plus className="h-5 w-5" aria-hidden /> Add a second person
                </button>
              )}
              <Nav onBack={() => go('day')} onNext={() => next('people', 'clinic')} />
            </Card>
          )}

          {step === 'clinic' && (
            <Card>
              <Field id="f-clinic" label="Clinic name" error={err('clinic')}>
                <input id="f-clinic" value={d.clinic} onChange={(e) => set('clinic', e.target.value)} placeholder="Gupta Clinic" autoComplete="off" maxLength={60} className={inputCls(err('clinic'))} aria-invalid={!!err('clinic')} aria-describedby={err('clinic') ? 'f-clinic-err' : undefined} />
              </Field>
              <Field id="f-doctor" label="Doctor (optional)">
                <input id="f-doctor" value={d.doctor} onChange={(e) => set('doctor', e.target.value)} placeholder="Dr. Gupta" autoComplete="off" maxLength={60} className={inputCls()} />
              </Field>
              <p className="mt-6 rounded-xl bg-[#e9efe9] px-4 py-3 text-[16px] leading-relaxed text-teal-900">
                <span className="font-semibold">Simulated clinic.</span> In this demo Nami books with a pretend version of this clinic. She won&rsquo;t call a real one.
              </p>
              <Nav onBack={() => go('people')} onNext={() => next('clinic', self ? 'ask' : 'handoff')} nextLabel={self ? 'Next' : `Next: ask ${them}`} />
            </Card>
          )}

          {step === 'ask' && (
            <Card>
              <button type="button" onClick={listen} aria-pressed={speaking} className="inline-flex min-h-14 items-center gap-2 rounded-full bg-[#e9efe9] px-5 text-[18px] font-medium text-teal-900 hover:bg-[#dce7df]">
                <Volume2 className="h-5 w-5" aria-hidden /> {speaking ? (parentHi ? 'रोकिए · Stop' : 'Stop') : parentHi ? 'सुनिए · Listen' : 'Listen'}
              </button>
              <div className="mt-6 flex flex-col gap-3">
                <button type="button" onClick={agree} className="flex min-h-[88px] items-center justify-center gap-4 rounded-2xl bg-teal-900 px-6 text-ivory-50 shadow-[0_12px_28px_rgba(23,61,56,0.25)] transition hover:bg-teal-700">
                  <Check className="h-7 w-7 shrink-0" aria-hidden />
                  <span className="flex flex-col items-start text-left">
                    {parentHi ? (
                      <>
                        <span lang="hi" className="text-[28px] font-semibold leading-tight">हाँ, ठीक है</span>
                        <span className="text-[16px] opacity-85">Haan, theek hai · Yes, that&rsquo;s fine</span>
                      </>
                    ) : (
                      <span className="text-[26px] font-semibold">Yes, that&rsquo;s fine</span>
                    )}
                  </span>
                </button>
                <button type="button" onClick={() => go('notnow')} className="flex min-h-[76px] items-center justify-center gap-3 rounded-2xl border-2 border-cocoa-300 bg-white/70 px-6 text-cocoa-500 transition hover:border-cocoa-500">
                  <span className="flex flex-col items-start text-left">
                    {parentHi ? (
                      <>
                        <span lang="hi" className="text-[22px] font-semibold leading-tight">अभी नहीं</span>
                        <span className="text-[16px] opacity-85">Abhi nahi · Not now</span>
                      </>
                    ) : (
                      <span className="text-[22px] font-semibold">Not now</span>
                    )}
                  </span>
                </button>
              </div>
              {failure && (
                <p role="alert" className="mt-4 rounded-xl bg-[#f7e1dc] px-4 py-3 text-[17px] text-bad-600">
                  {failure} Please try again.
                </p>
              )}
              {parentHi && lang === 'hi' ? (
                <details className="mt-5 text-[16px] text-ink-600">
                  <summary className="cursor-pointer rounded-md py-1 font-medium text-teal-900">What Nami said, in English</summary>
                  <p className="mt-2 leading-relaxed">{lines.en.join(' ')}</p>
                </details>
              ) : null}
              <p className="mt-4 text-[15px] leading-relaxed text-ink-600">Nothing is saved before this yes. This is a 48-hour demo with a simulated clinic.</p>
              <Nav onBack={() => go(self ? 'clinic' : 'handoff')} />
            </Card>
          )}

          {step === 'notnow' && (
            <Card>
              <p className="text-[18px] leading-relaxed text-ink-900">
                Nothing was saved. Talk it over, and come back when {self ? 'you’re' : 'they’re'} ready. It&rsquo;s {self ? 'your' : 'their'} call.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={() => go(self ? 'ask' : 'handoff')} className="min-h-14 rounded-full bg-teal-900 px-6 text-[18px] font-semibold text-ivory-50 hover:bg-teal-700">
                  Ask again
                </button>
                <button type="button" onClick={() => go('parent')} className="min-h-14 rounded-full border-2 border-teal-900 px-6 text-[18px] font-semibold text-teal-900 hover:bg-white/60">
                  Change the details
                </button>
                <Link href="/" className="inline-flex min-h-14 items-center justify-center rounded-full px-6 text-[18px] text-ink-600 underline underline-offset-4">
                  Back to the home page
                </Link>
              </div>
            </Card>
          )}

          {(step === 'saving' || step === 'done') && (
            <Card>
              <p role="status" className="text-[20px] leading-relaxed text-teal-900">
                {step === 'saving' ? 'Setting things up…' : `All set. Taking you to ${them}'s screen.`}
              </p>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}

function Question({ step, d, them, self, parentHi }: { step: Step; d: Draft; them: string; self: boolean; parentHi: boolean }) {
  const lines = consentLines(d);
  switch (step) {
    case 'who':
      return <>Namaste, I&rsquo;m Nami. Who&rsquo;s setting me up today?</>;
    case 'parent':
      return self ? <>Lovely. Tell me a little about you.</> : <>Tell me a little about them, so I know how to talk to them.</>;
    case 'day':
      return self ? <>What does your day look like?</> : <>What does a day look like for {them}?</>;
    case 'people':
      return self ? <>If you don&rsquo;t answer, who should I ask first?</> : <>If {them} doesn&rsquo;t answer, who should I ask first?</>;
    case 'clinic':
      return self ? <>Which clinic do you usually go to?</> : <>Which clinic does {them} usually go to?</>;
    case 'ask':
      return (
        <span className="block space-y-2">
          {(parentHi ? lines.hi : lines.en).map((l) => (
            <span key={l} className="block">
              {l}
            </span>
          ))}
          {d.language === 'auto' && (
            <span lang="en" className="mt-3 block font-sans text-[16px] leading-relaxed font-normal text-ink-600">
              {lines.en.join(' ')}
            </span>
          )}
        </span>
      );
    case 'notnow':
      return parentHi ? (
        <span lang="hi">कोई बात नहीं। कुछ भी सेव नहीं हुआ है। जब मन हो, फिर पूछ लीजिए।</span>
      ) : (
        <>That&rsquo;s all right. Nothing has been saved. Ask me again whenever you like.</>
      );
    case 'saving':
      return parentHi ? <span lang="hi">धन्यवाद {them}। बस एक पल…</span> : <>Thank you, {them}. Just a moment…</>;
    case 'done':
      return parentHi ? <span lang="hi">धन्यवाद {them}। फिर मिलते हैं, {hiTime(d.checkinTime)}।</span> : <>Thank you, {them}. See you at {enTime(d.checkinTime)}.</>;
    default:
      return null;
  }
}

function Card({ children }: { children: ReactNode }) {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        // Enter submits: click the step's main button
        (e.currentTarget.querySelector('[data-next]') as HTMLButtonElement | null)?.click();
      }}
      className="rounded-[6px] bg-[#fffaf0] p-5 shadow-[0_1px_0_rgba(60,40,20,0.06),0_14px_34px_rgba(70,45,20,0.13)] sm:p-8"
    >
      {children}
    </form>
  );
}

const inputCls = (err?: string) =>
  `block w-full min-h-14 rounded-xl border-2 bg-white px-4 text-[20px] text-ink-900 placeholder:text-[#a59a88] transition focus:border-teal-700 ${err ? 'border-bad-600' : 'border-line'}`;

function Err({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-2 text-[16px] font-medium text-bad-600">
      {children}
    </p>
  );
}

function Field({ id, label, hint, error, tight, children }: { id: string; label: string; hint?: string; error?: string; tight?: boolean; children: ReactNode }) {
  return (
    <div className={tight ? 'mt-1' : 'mt-6 first:mt-0'}>
      <label htmlFor={id} className="block text-[19px] font-semibold text-teal-900">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[16px] text-ink-600">
          {hint}
        </p>
      )}
      <div className="mt-2">{children}</div>
      {error && <Err id={`${id}-err`}>{error}</Err>}
    </div>
  );
}

function Chips({ label, value, options, onPick, show }: { label: string; value: string; options: string[]; onPick: (v: string) => void; show?: (v: string) => string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(o)}
            className={`min-h-14 rounded-full border-2 px-5 text-[19px] font-medium transition ${on ? 'border-teal-900 bg-teal-900 text-ivory-50' : 'border-line bg-white text-teal-900 hover:border-teal-700'}`}
          >
            {show ? show(o) : o}
          </button>
        );
      })}
    </div>
  );
}

function Choices({
  label,
  id,
  value,
  options,
  onPick,
  error,
  row,
}: {
  label: string;
  id: string;
  value: string | null;
  options: { v: string; t: string; s?: string; lang?: string }[];
  onPick: (v: string) => void;
  error?: string;
  row?: boolean;
}) {
  return (
    <fieldset className="mt-6" aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="text-[19px] font-semibold text-teal-900">{label}</legend>
      <div className={`mt-3 grid gap-3 ${row ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}>
        {options.map((o, i) => {
          const on = value === o.v;
          return (
            <button
              key={o.v}
              id={i === 0 ? id : undefined}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(o.v)}
              className={`flex min-h-16 flex-col items-start justify-center rounded-2xl border-2 px-5 py-3 text-left transition ${on ? 'border-teal-900 bg-teal-900 text-ivory-50' : 'border-line bg-white text-teal-900 hover:border-teal-700'}`}
            >
              <span className="text-[21px] font-semibold leading-tight">{o.t}</span>
              {o.s && (
                <span lang={o.lang} className={`mt-0.5 text-[16px] ${on ? 'text-ivory-100' : 'text-ink-600'}`}>
                  {o.s}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error && <Err id={`${id}-err`}>{error}</Err>}
    </fieldset>
  );
}

function Toggle({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 px-5 py-3 text-left transition ${on ? 'border-teal-900 bg-[#e9efe9]' : 'border-line bg-white'}`}
    >
      <span>
        <span className="block text-[19px] font-semibold text-teal-900">{title}</span>
        <span className="block text-[15px] text-ink-600">{sub}</span>
      </span>
      <span aria-hidden className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? 'bg-teal-900' : 'bg-[#d9cdb8]'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
      </span>
    </button>
  );
}

function Nav({ onBack, back, onNext, nextLabel = 'Next' }: { onBack?: () => void; back?: { href: string }; onNext?: () => void; nextLabel?: string }) {
  const backCls = 'inline-flex min-h-14 items-center gap-2 rounded-full px-4 text-[18px] font-medium text-ink-600 hover:bg-[#efe6d6]';
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
      {back ? (
        <Link href={back.href} className={backCls}>
          <ArrowLeft className="h-5 w-5" aria-hidden /> Back
        </Link>
      ) : (
        <button type="button" onClick={onBack} className={backCls}>
          <ArrowLeft className="h-5 w-5" aria-hidden /> Back
        </button>
      )}
      {onNext && (
        <button type="submit" data-next onClick={(e) => {
          e.preventDefault();
          onNext();
        }} className="inline-flex min-h-14 items-center gap-2 rounded-full bg-cocoa-500 px-7 text-[19px] font-semibold text-ivory-50 shadow-[0_10px_24px_rgba(140,80,50,0.25)] transition hover:bg-[#7a4a32]">
          {nextLabel} <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      )}
    </div>
  );
}

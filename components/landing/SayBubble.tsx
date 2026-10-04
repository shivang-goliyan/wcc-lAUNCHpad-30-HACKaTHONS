'use client';

import { useEffect, useState } from 'react';
import { motion, type MotionValue } from 'motion/react';
import { pickVoice, speechSynthesisEnvelope } from '@/components/nami/lipsync';

const CHAR_MS = 30;
const VOWEL = /[aeiouyआइईउऊएऐओऔअ]/i;

/**
 * What Nami is saying right now, typed out beside her. Her mouth follows the
 * letters (or the real speech, when narration is on). The text is mirrored to
 * a polite live region by the page, so screen readers aren't spammed per letter.
 */
export function SayBubble({
  text,
  side,
  x,
  y,
  mouth,
  narrate,
}: {
  text: string;
  side: 'left' | 'right';
  x: MotionValue<number>;
  y: MotionValue<number>;
  mouth: MotionValue<number>;
  narrate: boolean;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let i = 0;
    let stopSpeech = () => {};
    let speaking = false;
    if (narrate && typeof window !== 'undefined' && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(['en-IN', 'en-GB', 'en-US']);
      if (v) u.voice = v;
      u.rate = 0.98;
      stopSpeech = speechSynthesisEnvelope(u, (m) => mouth.set(m));
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      speaking = true;
    }
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      if (!speaking) {
        const c = text[i - 1] ?? '';
        mouth.set(c === ' ' || /[.,!?—]/.test(c) ? 0 : VOWEL.test(c) ? 0.55 + Math.random() * 0.35 : 0.18 + Math.random() * 0.2);
      }
      if (i >= text.length) {
        clearInterval(id);
        if (!speaking) mouth.set(0);
      }
    }, CHAR_MS);
    return () => {
      clearInterval(id);
      stopSpeech();
      if (speaking) window.speechSynthesis.cancel();
      mouth.set(0);
      setShown(0);
    };
  }, [text, narrate, mouth]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-30"
      style={{ x, y }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.18 }}
    >
      <p
        className={
          'w-max max-w-[200px] -translate-y-full rounded-2xl bg-card px-3.5 py-2.5 text-[14px] leading-snug text-ink-900 shadow-[0_12px_32px_rgba(23,61,56,0.16)] ' +
          // side = where the bubble grows; its tail corner points down at her
          (side === 'left' ? '-translate-x-full rounded-br-md' : 'rounded-bl-md')
        }
      >
        {text.slice(0, shown)}
        <span className="invisible">{text.slice(shown)}</span>
      </p>
    </motion.div>
  );
}

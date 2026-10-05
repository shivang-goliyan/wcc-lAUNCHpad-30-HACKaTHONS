'use client';

/**
 * Nami walks along the bottom of the screen while you read (docs/DESIGN.md §1, §5).
 *
 * - The hero has its own Nami. This one only appears once that one has
 *   scrolled out of view, walking in from the side, and leaves when you go
 *   back up, so there is never more than one Nami on screen.
 * - Scrolling makes her walk: she paces along the bottom edge, speeding up and
 *   slowing down with a little inertia, and turns round at the ends. Her walk
 *   cycle plays at the speed she actually moves, so her feet don't skate.
 * - When you stop, she walks to the nearer corner, settles into the pose of the
 *   section you're reading and says its line (`[data-nami-cue]`, see NamiCue).
 * - Left alone she does small things on her own; poke her and she reacts.
 * - Reduced motion: nothing moves; she stays in the hero only.
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react';
import { Volume2, VolumeX } from 'lucide-react';
import { NamiImage } from '@/components/nami/NamiImage';
import { SayBubble } from './SayBubble';
import { useReducedMotionSafe } from './useReducedMotionSafe';
import type { PoseName } from '@/lib/nami/poses';

const POKES = [
  'Hehe! That tickles.',
  'Hi! I speak Hindi and English.',
  'No medical advice from me. I get you to a real doctor.',
  'I always say I’m an AI. No pretending.',
  'Try the demo. I’ll book Dr. Mehta for you.',
];
const ACTS: PoseName[] = ['greeting', 'heart', 'celebrate', 'heart'];

type Cue = { pose: PoseName; say?: string; side: 'left' | 'right'; y: number };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function sizeFor(vw: number) {
  return vw >= 1024 ? 168 : vw >= 640 ? 140 : 108;
}

function readCues(): Cue[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-nami-cue]')).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      pose: (el.dataset.pose as PoseName) || 'idle',
      say: el.dataset.say || undefined,
      side: el.dataset.side === 'left' ? 'left' : 'right',
      y: r.top + window.scrollY,
    };
  });
}

/** the cue of the section in the middle of the screen */
function cueAt(cues: Cue[], mid: number): Cue | null {
  let best: Cue | null = null;
  for (const c of cues) if (c.y <= mid + 120 && (!best || c.y > best.y)) best = c;
  return best;
}

export function RoamingNami() {
  const reduce = useReducedMotionSafe();
  const x = useMotionValue(-400);
  const y = useMotionValue(0);
  const opacity = useMotionValue(0);
  const bx = useMotionValue(0);
  const by = useMotionValue(0);
  const mouth = useMotionValue(0);
  const [size, setSize] = useState(140);
  const [pose, setPose] = useState<PoseName>('stand');
  const [speed, setSpeed] = useState(1);
  const [say, setSay] = useState<{ text: string; side: 'left' | 'right' } | null>(null);
  const [narrate, setNarrate] = useState(false);
  const [active, setActive] = useState(false);

  const st = useRef({ pokeUntil: 0, pokeText: '', pokes: 0 });

  useEffect(() => {
    if (reduce) return;
    const s = {
      x: -400,
      v: 0,
      dir: 1 as 1 | -1,
      size: sizeFor(window.innerWidth),
      cues: readCues(),
      lastScroll: -1e9,
      lastY: window.scrollY,
      scrollV: 0,
      present: false,
      stillSince: 0,
      pose: 'stand' as PoseName,
      speed: 1,
      say: '' as string,
      actUntil: 0,
      act: 'heart' as PoseName,
      nextActAt: performance.now() + 9000,
      nActs: 0,
    };
    const hero = document.querySelector<HTMLElement>('[data-hero-nami]');
    const measure = () => {
      s.cues = readCues();
      s.size = sizeFor(window.innerWidth);
      setSize(s.size);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    const onScroll = () => {
      s.lastScroll = performance.now();
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sz = s.size;
      const left = 10;
      const right = vw - sz - 10;
      // scroll speed, smoothed
      const sy = window.scrollY;
      const inst = Math.abs(sy - s.lastY) / Math.max(dt, 1e-3);
      s.lastY = sy;
      s.scrollV += (inst - s.scrollV) * Math.min(1, dt * 8);

      // she is around only once the hero's Nami has gone off the top
      const heroGone = !hero || hero.getBoundingClientRect().bottom < 0;
      if (heroGone && !s.present) {
        s.present = true;
        s.x = vw + 20; // walks in from the right
        s.dir = -1;
        s.v = 0;
        s.stillSince = now;
        opacity.set(1);
        setActive(true);
      } else if (!heroGone && s.present) {
        s.present = false;
        animate(opacity, 0, { duration: 0.18 });
        setActive(false);
      }

      const scrolling = now - s.lastScroll < 220;
      const cue = cueAt(s.cues, sy + vh * 0.5);
      // the nearer corner, so she is never walking for long after you stop
      const home = s.x + sz / 2 < vw / 2 ? left : right;
      const natural = sz * 0.62; // px/s at which the walk cycle plays at its own speed

      let want = 0; // desired velocity
      if (s.present) {
        if (s.x > right + 4 || s.x < left - 4) {
          // still walking in from off-screen
          want = (s.x > right ? -1 : 1) * natural * 1.6;
        } else if (scrolling) {
          // pace while the page moves, turning round at the ends
          if (s.x >= right - 1) s.dir = -1;
          else if (s.x <= left + 1) s.dir = 1;
          want = s.dir * clamp(s.scrollV * 0.22, natural * 0.9, natural * 2.2);
        } else {
          // walk home to this section's corner, then stop
          const d = home - s.x;
          want = Math.abs(d) < 2 ? 0 : Math.sign(d) * clamp(Math.abs(d) * 3, natural * 0.8, natural * 2.5);
        }
      }
      // inertia: she speeds up and slows down instead of snapping
      const acc = sz * 9;
      s.v += clamp(want - s.v, -acc * dt, acc * dt);
      if (!s.present) s.v = 0;
      s.x += s.v * dt;
      if (!scrolling && Math.abs(home - s.x) < 2 && Math.abs(s.v) < 8) {
        s.x = home;
        s.v = 0;
      }

      x.set(s.x);
      y.set(vh - sz - 6);

      // pose: walking while moving, the section's pose once she has stopped
      const moving = Math.abs(s.v) > 12;
      let p: PoseName;
      if (moving) {
        p = s.v > 0 ? 'walk' : 'walk-left';
        s.stillSince = now;
      } else if (now - s.stillSince < 450) p = 'stand';
      else p = cue?.pose ?? 'idle';
      const settled = !moving && now - s.stillSince > 900;
      // little things on her own
      if (settled && now > s.nextActAt && now > s.actUntil && p !== 'quiet' && !cue?.say) {
        s.act = ACTS[s.nActs++ % ACTS.length];
        s.actUntil = now + 3000;
        s.nextActAt = now + 10000 + Math.random() * 6000;
      }
      if (settled && now < s.actUntil) p = s.act;
      const poked = now < st.current.pokeUntil;
      if (poked) p = 'celebrate';
      if (p !== s.pose) {
        s.pose = p;
        setPose(p);
      }
      const sp = moving ? clamp(Math.abs(s.v) / natural, 0.6, 2.5) : 1;
      if (Math.abs(sp - s.speed) > 0.08) {
        s.speed = sp;
        setSpeed(Math.round(sp * 10) / 10);
      }

      // what she says, in a bubble above her head, toward the middle of the screen
      const text = poked ? st.current.pokeText : settled && s.present ? (cue?.say ?? '') : '';
      const side: 'left' | 'right' = s.x > vw / 2 ? 'left' : 'right';
      bx.set(side === 'left' ? s.x + sz * 0.7 : s.x + sz * 0.3);
      by.set(vh - sz - 6 + sz * 0.12);
      if (text !== s.say) {
        s.say = text;
        setSay(text ? { text, side } : null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [reduce, x, y, opacity, bx, by]);

  const poke = () => {
    const r = st.current;
    r.pokeText = POKES[r.pokes++ % POKES.length];
    r.pokeUntil = performance.now() + 2600;
  };

  // narration is opt-in and remembered
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        if (localStorage.getItem('nami_narrate') === '1') setNarrate(true);
      } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, []);
  const toggleNarrate = () => {
    setNarrate((n) => {
      try {
        localStorage.setItem('nami_narrate', n ? '0' : '1');
      } catch {}
      if (n) window.speechSynthesis?.cancel();
      return !n;
    });
  };

  if (reduce) return null;

  return (
    <>
      <AnimatePresence>{say && active && <SayBubble key={say.text} text={say.text} side={say.side} x={bx} y={by} mouth={mouth} narrate={narrate} />}</AnimatePresence>
      <p className="sr-only" aria-live="polite">
        {active ? (say?.text ?? '') : ''}
      </p>
      <button
        type="button"
        onClick={toggleNarrate}
        aria-pressed={narrate}
        aria-label={narrate ? 'Nami is talking. Turn her voice off' : 'Let Nami talk out loud'}
        title={narrate ? 'Nami is talking' : 'Let Nami talk'}
        className="fixed right-4 bottom-[calc(var(--nami-size,140px)+18px)] z-40 grid h-10 w-10 place-items-center rounded-full border border-teal-900/10 bg-card/95 text-teal-900 shadow-[0_6px_18px_rgba(23,61,56,0.16)] backdrop-blur hover:bg-card"
        style={{ opacity: active ? 1 : 0, pointerEvents: active ? 'auto' : 'none', transition: 'opacity .3s', ['--nami-size' as string]: `${size}px` }}
      >
        {narrate ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
      </button>
      <motion.div aria-hidden className="pointer-events-none fixed top-0 left-0 z-30 will-change-transform" style={{ x, y, opacity, width: size, height: size }}>
        {/* only her body is clickable, the box corners stay click-through */}
        <span onClick={poke} className="pointer-events-auto absolute inset-[18%_22%_8%_22%] cursor-pointer rounded-full" />
        <NamiImage pose={pose} speed={speed} mouth={mouth} className="h-full w-full" />
      </motion.div>
    </>
  );
}

export default RoamingNami;

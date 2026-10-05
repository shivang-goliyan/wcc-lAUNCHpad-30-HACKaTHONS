'use client';

/**
 * One Nami for the whole landing page (docs/DESIGN.md §1, §5).
 *
 * The layout reserves spots for her (`[data-nami-slot]`, see NamiSlot): on the hero desk,
 * in each painted moment of the day, beside the appointment, on the red thread, by the
 * final button and under the footer moon.
 *
 * - She sits in the spot of the section you're reading and moves with the page like
 *   part of it, taking that spot's pose and saying its line.
 * - When the section changes she gets up and walks to the next spot: a real walk, at a
 *   walking pace, facing where she's going, her walk cycle playing at the speed she
 *   actually moves. If the page runs ahead of her she keeps to the edge of the screen
 *   and catches up. She never fades out or jumps.
 * - On the hero she waves, follows the cursor and cheers at the main button. Left alone
 *   she does small things on her own; poke her and she reacts.
 * - Reduced motion: nothing moves; each spot shows a still Nami instead.
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue } from 'motion/react';
import { Volume2, VolumeX } from 'lucide-react';
import { NamiImage } from '@/components/nami/NamiImage';
import { SayBubble } from './SayBubble';
import { useReducedMotionSafe } from './useReducedMotionSafe';
import type { PoseName } from '@/lib/nami/poses';
import { NAMI_CLIPS, clipRoute } from '@/lib/nami/art';

const POKES = [
  'Hehe! That tickles.',
  'Hi! I speak Hindi and English.',
  'No medical advice from me. I get you to a real doctor.',
  'I always say I’m an AI. No pretending.',
  'Try the demo. I’ll book Dr. Mehta for you.',
];
const ACTS: PoseName[] = ['heart', 'greeting', 'celebrate', 'heart'];
const BASE = 200;

type Spot = { el: HTMLElement; pose: PoseName; say?: string; hero: boolean };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** how long her clips take to go from one pose to another (getting up before she walks) */
function transitionMs(from: PoseName | '', to: PoseName) {
  if (!from || from === to) return 0;
  const steps = clipRoute(from, to, () => true);
  const ms = steps.reduce((t, st) => t + (NAMI_CLIPS[st.key].frames / NAMI_CLIPS[st.key].fps) * 1000, 0);
  return Math.min(1600, ms);
}

function readSpots(): Spot[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-nami-slot]'))
    .filter((el) => el.dataset.path !== '1')
    .map((el) => ({ el, pose: (el.dataset.pose as PoseName) || 'idle', say: el.dataset.say || undefined, hero: el.dataset.hero === '1' }));
}

/** where a spot is on screen right now: a square, feet on the bottom edge */
function boxOf(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const size = Math.min(r.width, r.height);
  return { x: r.left + (r.width - size) / 2, y: r.bottom - size, size };
}

export function RoamingNami() {
  const reduce = useReducedMotionSafe();
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(0);
  const bx = useMotionValue(0);
  const by = useMotionValue(0);
  const mouth = useMotionValue(0);
  const [pose, setPose] = useState<PoseName>('greeting');
  const [speed, setSpeed] = useState(1);
  const [look, setLook] = useState<{ x: number; y: number } | null>(null);
  const [say, setSay] = useState<{ text: string; side: 'left' | 'right' } | null>(null);
  const [narrate, setNarrate] = useState(false);

  const ext = useRef({ pokeUntil: 0, pokeText: '', pokes: 0, cheerUntil: 0, pointer: null as { x: number; y: number } | null });

  useEffect(() => {
    if (reduce) return;
    let spots = readSpots();
    const s = {
      x: 0,
      y: 0,
      size: 0,
      v: 0, // speed along her path, px/s
      placed: false,
      target: null as Spot | null,
      attached: false,
      stillSince: performance.now(),
      bornAt: performance.now(),
      pose: '' as PoseName | '',
      speed: 1,
      say: '',
      dir: 1,
      departAt: 0, // she gets up in place before she starts walking
      act: 'heart' as PoseName,
      actUntil: 0,
      nextActAt: performance.now() + 9000,
      nActs: 0,
      look: '',
    };
    const ro = new ResizeObserver(() => (spots = readSpots()));
    ro.observe(document.body);
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') ext.current.pointer = { x: e.clientX, y: e.clientY };
    };
    const onCheer = () => (ext.current.cheerUntil = performance.now() + 2400);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('nami:cheer', onCheer);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mid = vh * 0.5;

      // the spot of the section in the middle of the screen, with some stickiness so she doesn't dither
      let best: { spot: Spot; d: number } | null = null;
      let curD = Infinity;
      for (const sp of spots) {
        const b = boxOf(sp.el);
        if (!b) continue;
        const d = Math.abs(b.y + b.size / 2 - mid);
        if (sp === s.target) curD = d;
        if (!best || d < best.d) best = { spot: sp, d };
      }
      if (!best) {
        opacity.set(0);
        return;
      }
      if (!s.target || (best.spot !== s.target && best.d < curD - 80)) {
        if (s.target && s.attached) {
          s.attached = false;
          // stand up first: hold still while her clips go from this pose to walking
          const nb = boxOf(best.spot.el);
          const goingRight = nb ? nb.x > s.x : true;
          s.departAt = now + transitionMs(s.pose, goingRight ? 'walk' : 'walk-left');
          s.dir = goingRight ? 1 : -1;
        }
        s.target = best.spot;
      }
      const tb = boxOf(s.target.el);
      if (!tb) return;

      if (!s.placed) {
        // she starts in her spot on the hero desk
        s.x = tb.x;
        s.y = tb.y;
        s.size = tb.size;
        s.placed = true;
        s.attached = true;
        opacity.set(1);
      }

      const natural = Math.max(60, s.size * 0.62); // px/s at which the walk cycle plays at its own speed
      if (s.attached) {
        // part of the page: she moves with her spot
        s.x = tb.x;
        s.y = tb.y;
        s.size = tb.size;
        s.v = 0;
      } else {
        // walk toward the spot, staying on screen while the page runs ahead of her
        const tx = clamp(tb.x, 0, vw - s.size);
        const ty = clamp(tb.y, 0, vh - s.size);
        const dx = tx - s.x;
        const dy = ty - s.y;
        const dist = Math.hypot(dx, dy);
        const want = dist < 2 || now < s.departAt ? 0 : clamp(dist * 2.4, natural * 0.9, natural * 2.6);
        const acc = natural * 6;
        s.v += clamp(want - s.v, -acc * dt, acc * dt);
        const step = Math.min(dist, s.v * dt);
        if (dist > 0.01) {
          s.x += (dx / dist) * step;
          s.y += (dy / dist) * step;
          if (Math.abs(dx) > 1) s.dir = dx > 0 ? 1 : -1;
        }
        // grow or shrink to the spot's size on the way
        s.size += (tb.size - s.size) * Math.min(1, dt * 2.5);
        const onScreen = tb.y >= -4 && tb.y <= vh - tb.size + 4;
        if (onScreen && Math.hypot(tb.x - s.x, tb.y - s.y) < 6 && Math.abs(tb.size - s.size) < 6) {
          s.attached = true;
          s.stillSince = now;
        }
      }

      x.set(s.x);
      y.set(s.y);
      scale.set(s.size / BASE);

      const gettingUp = !s.attached && now < s.departAt;
      const moving = !s.attached && (s.v > 14 || gettingUp);
      if (moving) s.stillSince = now;
      const settled = s.attached && now - s.stillSince > 700;
      let p: PoseName;
      if (moving) p = s.dir > 0 ? 'walk' : 'walk-left';
      else if (!s.attached) p = 'stand';
      else if (s.target.hero) p = now - s.bornAt < 2600 ? 'greeting' : 'idle';
      else p = s.target.pose;
      // little things on her own once she has sat a while
      if (settled && now > s.nextActAt && now > s.actUntil && p !== 'quiet') {
        s.act = ACTS[s.nActs++ % ACTS.length];
        s.actUntil = now + 3000;
        s.nextActAt = now + 11000 + Math.random() * 6000;
      }
      if (settled && now < s.actUntil) p = s.act;
      if (s.attached && s.target.hero && now < ext.current.cheerUntil) p = 'celebrate';
      const poked = now < ext.current.pokeUntil;
      if (poked && !moving) p = 'celebrate';
      if (p !== s.pose) {
        s.pose = p;
        setPose(p);
      }
      const sp = moving && !gettingUp ? clamp(s.v / natural, 0.6, 2.5) : 1;
      if (Math.abs(sp - s.speed) > 0.08) {
        s.speed = sp;
        setSpeed(Math.round(sp * 10) / 10);
      }

      // eyes follow the cursor while she sits on the hero
      const ptr = ext.current.pointer;
      let lk = '';
      if (s.attached && s.target.hero && ptr) {
        const lx = Math.round(clamp((ptr.x - (s.x + s.size / 2)) / (vw * 0.45), -1, 1) * 20) / 20;
        const ly = Math.round(clamp((ptr.y - (s.y + s.size * 0.35)) / (vh * 0.45), -1, 1) * 20) / 20;
        lk = `${lx},${ly}`;
      }
      if (lk !== s.look) {
        s.look = lk;
        const [a, b] = lk.split(',');
        setLook(lk ? { x: +a, y: +b } : null);
      }

      // her line, in a bubble above her head toward the middle of the screen (the hero has its own bubble)
      const text = poked ? ext.current.pokeText : settled && !s.target.hero ? (s.target.say ?? '') : '';
      const side: 'left' | 'right' = s.x + s.size / 2 > vw / 2 ? 'left' : 'right';
      bx.set(side === 'left' ? Math.min(vw - 8, s.x + s.size * 0.75) : Math.max(8, s.x + s.size * 0.25));
      by.set(s.y + s.size * 0.1);
      if (text !== s.say) {
        s.say = text;
        setSay(text ? { text, side } : null);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('nami:cheer', onCheer);
    };
  }, [reduce, x, y, scale, opacity, bx, by]);

  const poke = () => {
    const r = ext.current;
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
      <AnimatePresence>{say && <SayBubble key={say.text} text={say.text} side={say.side} x={bx} y={by} mouth={mouth} narrate={narrate} />}</AnimatePresence>
      <p className="sr-only" aria-live="polite">
        {say?.text ?? ''}
      </p>
      <button
        type="button"
        onClick={toggleNarrate}
        aria-pressed={narrate}
        aria-label={narrate ? 'Nami is talking. Turn her voice off' : 'Let Nami talk out loud'}
        title={narrate ? 'Nami is talking' : 'Let Nami talk'}
        className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full border border-teal-900/10 bg-card/95 px-3.5 py-2 text-[13.5px] font-semibold text-teal-900 shadow-[0_6px_18px_rgba(23,61,56,0.16)] backdrop-blur hover:bg-card"
      >
        {narrate ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
        <span className="hidden sm:inline">{narrate ? 'Nami is talking' : 'Let Nami talk'}</span>
      </button>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-30 will-change-transform"
        style={{ x, y, scale, opacity, width: BASE, height: BASE, transformOrigin: '0 0' }}
      >
        {/* only her body is clickable, the box corners stay click-through */}
        <span onClick={poke} className="pointer-events-auto absolute inset-[18%_22%_8%_22%] cursor-pointer rounded-full" />
        <NamiImage pose={pose} speed={speed} lookAt={look} mouth={mouth} className="h-full w-full" />
      </motion.div>
    </>
  );
}

export default RoamingNami;

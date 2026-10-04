'use client';

import { useReducedMotionSafe } from './useReducedMotionSafe';
/**
 * RoamingNami (docs/DESIGN.md §1, §5): one fixed-position Nami that travels
 * down the landing page as you scroll.
 *
 * How it works
 * - The layout reserves empty boxes for her: every visible `[data-nami-slot]`
 *   (see NamiSlot). Each slot carries a pose. `data-path` slots are strips on
 *   a water divider that she swims across.
 * - Each slot gets a "focus" scroll position (slot centred in the viewport).
 *   Around the focus she HOLDS: pinned to the slot, so she moves with the
 *   content and covers nothing. Between holds she TRAVELS to the next slot.
 * - Desktop (xl): slots sit in the gutters ("lanes") either side of the
 *   content column, and sides only switch on a water divider, so travel never
 *   crosses text. Elsewhere (mobile/tablet, or two slots that are not in the
 *   same lane) she dives instead: fades out mid-travel and resurfaces at the
 *   next slot.
 * - Hero: waves once, then her eyes follow the cursor. Hovering the main
 *   button makes her cheer.
 * - Left alone for a few seconds she does small things on her own (waves,
 *   a heart, a little cheer), always through real clips via idle.
 * - Reduced motion: renders nothing; NamiSlot shows static poses instead.
 * - Tab hidden: NamiImage pauses its own loop; we drop pointer tracking.
 * - Always `pointer-events: none` and `aria-hidden`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useScroll } from 'motion/react';
import { Volume2, VolumeX } from 'lucide-react';
import { clsx } from 'clsx';
import { NamiImage } from '@/components/nami/NamiImage';
import { SayBubble } from './SayBubble';
import type { PoseName } from '@/lib/nami/poses';

const BASE = 200; // px size of the rendered Nami box before scaling

// what she says when someone pokes her
const POKES = [
  'Hehe! That tickles.',
  'Hi! I speak Hindi and English.',
  'No medical advice from me. I get you to a real doctor.',
  'I always say I’m an AI. No pretending.',
  'Try the demo. I’ll book Dr. Mehta for you.',
];
const DESKTOP_MIN = 1280; // matches Tailwind `xl`, where the lanes exist

type Slot = {
  id: string;
  pose: PoseName;
  path: boolean;
  /** walk across instead of swimming */
  walk: boolean;
  hero: boolean;
  say?: string;
  /** viewport x of the box (fixed for normal slots) */
  x: number;
  /** path slots: start and end x */
  x0: number;
  x1: number;
  /** document y of the box top */
  top: number;
  size: number;
  /** focus scroll position and hold half-width */
  f: number;
  h: number;
};

type Frame = { x: number; y: number; size: number; opacity: number; pose: PoseName; heroHold: boolean; say?: string };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const smooth = (e0: number, e1: number, v: number) => {
  const t = clamp((v - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Document position from the offset chain, so CSS transforms (reveals) never skew it. */
function docBox(el: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

function measure(): { slots: Slot[]; desktop: boolean } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const desktop = vw >= DESKTOP_MIN;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-nami-slot]'));
  const raw: Slot[] = [];
  for (const el of els) {
    if (!el.offsetParent || el.offsetWidth === 0) continue; // display:none at this breakpoint
    const b = docBox(el);
    const path = el.dataset.path === '1';
    const size = path ? b.h : Math.min(b.w, b.h);
    const x = path ? b.x : b.x + (b.w - size) / 2;
    const top = path ? b.y : b.y + b.h - size;
    raw.push({
      id: el.dataset.namiSlot ?? '',
      pose: (el.dataset.pose as PoseName) ?? 'idle',
      path,
      walk: path && el.dataset.walk === '1',
      hero: el.dataset.hero === '1',
      say: el.dataset.say || undefined,
      x,
      x0: x,
      x1: x,
      top,
      size,
      f: clamp(top + size / 2 - vh * 0.5, 0, maxScroll),
      h: 0,
    });
  }
  raw.sort((a, b) => a.f - b.f || a.top - b.top);
  // focus points must be strictly increasing
  for (let i = 1; i < raw.length; i++) raw[i].f = Math.max(raw[i].f, raw[i - 1].f + 24);

  // Path endpoints: from the previous slot's centre to the next slot's centre (desktop),
  // or across to the far edge (mobile, where she then dives to the next slot).
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    if (!s.path) continue;
    const prev = raw[i - 1];
    const next = raw[i + 1];
    const startC = prev ? prev.x + prev.size / 2 : vw * 0.8;
    s.x0 = clamp(startC - s.size / 2, 4, vw - s.size - 4);
    if (desktop && next) s.x1 = clamp(next.x + next.size / 2 - s.size / 2, 4, vw - s.size - 4);
    else s.x1 = startC > vw / 2 ? 8 : vw - s.size - 8;
  }

  for (let i = 0; i < raw.length; i++) {
    const gp = i > 0 ? raw[i].f - raw[i - 1].f : Infinity;
    const gn = i < raw.length - 1 ? raw[i + 1].f - raw[i].f : Infinity;
    const max = raw[i].path ? vh * 0.32 : vh * 0.2;
    raw[i].h = Math.min(max, gp * 0.4, gn * 0.4);
  }
  return { slots: raw, desktop };
}

/** what she looks like while crossing a path slot */
function travelPose(s: Slot): PoseName {
  if (!s.walk) return 'swim';
  return s.x1 >= s.x0 ? 'walk' : 'walk-left';
}

function pinned(s: Slot, scroll: number, p: number) {
  return { x: s.path ? lerp(s.x0, s.x1, ease(clamp(p, 0, 1))) : s.x, y: s.top - scroll, size: s.size };
}

function frameAt(slots: Slot[], scroll: number, desktop: boolean): Frame | null {
  if (!slots.length) return null;
  let i = 0;
  while (i < slots.length - 1 && scroll >= slots[i + 1].f - slots[i + 1].h) i++;
  const a = slots[i];
  const holdEnd = a.f + a.h;
  const p = a.h > 0 ? (scroll - (a.f - a.h)) / (2 * a.h) : 1;
  if (i === slots.length - 1 || scroll <= holdEnd) {
    const q = pinned(a, scroll, p);
    // she only talks once she has settled in the middle of the hold
    const settled = Math.abs(p - 0.5) < 0.42;
    return { ...q, opacity: 1, pose: a.path ? travelPose(a) : a.pose, heroHold: a.hero, say: !a.path && settled ? a.say : undefined };
  }
  const b = slots[i + 1];
  const t = clamp((scroll - holdEnd) / (b.f - b.h - holdEnd), 0, 1);
  const e = ease(t);
  const qa = pinned(a, scroll, 1);
  const qb = pinned(b, scroll, 0);
  const ca = qa.x + qa.size / 2;
  const cb = qb.x + qb.size / 2;
  const solid = a.path || b.path ? desktop || (a.hero && b.path) : desktop && Math.abs(ca - cb) < 48;
  if (!solid) {
    // Dive: sink and fade out while pinned to the old slot, resurface pinned to the new one.
    // She never moves across content while visible.
    const q = t < 0.5 ? qa : qb;
    // short and decisive, so she is never a half-transparent ghost over text for long
    const vis = smooth(0.55, 0.95, Math.abs(t - 0.5) * 2);
    const sz = q.size * (0.9 + 0.1 * vis);
    return {
      x: q.x + (q.size - sz) / 2,
      y: q.y + (q.size - sz) + (1 - vis) * 14,
      size: sz,
      opacity: vis,
      pose: t < 0.5 ? (a.path ? travelPose(a) : a.pose) : b.path ? travelPose(b) : b.pose,
      heroHold: false,
    };
  }
  const size = lerp(qa.size, qb.size, e);
  const cx = lerp(ca, cb, e);
  const by = lerp(qa.y + qa.size, qb.y + qb.size, e); // interpolate the baseline, keep feet steady
  const pa: PoseName = a.path ? travelPose(a) : a.pose;
  const pb: PoseName = b.path ? travelPose(b) : b.pose;
  let pose: PoseName = t < 0.5 ? pa : pb;
  // gliding into or out of the water: swim for the whole move, settle at the ends
  if (solid && (a.path || b.path)) pose = t < 0.12 ? pa : t > 0.88 ? pb : (a.path ? travelPose(a) : travelPose(b));
  return { x: cx - size / 2, y: by - size, size, opacity: 1, pose, heroHold: false };
}

export function RoamingNami() {
  const reduce = useReducedMotionSafe();
  const { scrollY } = useScroll();

  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(0);

  const bx = useMotionValue(-1000);
  const by = useMotionValue(-1000);
  const mouth = useMotionValue(0);
  const [say, setSay] = useState<{ text: string; side: 'left' | 'right' } | null>(null);
  const [narrate, setNarrate] = useState(false);

  const [pose, setPose] = useState<PoseName>('greeting');
  const [look, setLook] = useState<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);

  const st = useRef({
    slots: [] as Slot[],
    desktop: true,
    greetUntil: 0,
    frame: null as Frame | null,
    pose: 'greeting' as PoseName,
    raf: 0,
    pointer: null as { x: number; y: number } | null,
    say: undefined as string | undefined,
    pokeUntil: 0,
    scrolledAt: 0,
    pokeText: '',
    pokes: 0,
    act: 'greeting' as PoseName,
    actUntil: 0,
    nextActAt: 0,
    cheerUntil: 0,
  });

  const apply = useCallback(() => {
    const r = st.current;
    const f = frameAt(r.slots, scrollY.get(), r.desktop);
    r.frame = f;
    if (!f) {
      opacity.set(0);
      return;
    }
    x.set(f.x);
    y.set(f.y);
    scale.set(f.size / BASE);
    opacity.set(f.opacity);
    const now = performance.now();
    let p = f.pose;
    if (f.heroHold) p = now < r.greetUntil ? 'greeting' : 'idle';
    // no treadmill: when the page stops moving, so does she
    if ((p === 'walk' || p === 'walk-left') && now - r.scrolledAt > 260) p = 'stand';
    const still = f.opacity > 0.9 && p !== 'swim' && p !== 'walk' && p !== 'walk-left' && p !== 'quiet';
    if (still && now < r.actUntil) p = r.act;
    if (f.heroHold && now < r.cheerUntil) p = 'celebrate';
    const poked = now < r.pokeUntil && f.opacity > 0.9;
    if (poked && p !== 'swim') p = 'celebrate';
    if (p !== r.pose) {
      r.pose = p;
      setPose(p);
    }
    // speech bubble above her head, kept inside her lane so it never covers content
    const side = f.x + f.size / 2 > window.innerWidth / 2 ? 'left' : 'right';
    bx.set(side === 'left' ? Math.min(window.innerWidth - 8, f.x + f.size) : Math.max(8, f.x));
    by.set(f.y + f.size * 0.1);
    const text = poked ? r.pokeText : f.opacity > 0.9 ? f.say : undefined;
    if (text !== r.say) {
      r.say = text;
      setSay(text ? { text, side } : null);
    }
    // gaze: follow the cursor while she sits on the rock
    if (f.heroHold && r.pointer) {
      const cx = f.x + f.size / 2;
      const cy = f.y + f.size * 0.35;
      const lx = Math.round(clamp((r.pointer.x - cx) / (window.innerWidth * 0.45), -1, 1) * 20) / 20;
      const ly = Math.round(clamp((r.pointer.y - cy) / (window.innerHeight * 0.45), -1, 1) * 20) / 20;
      setLook((o) => (o && o.x === lx && o.y === ly ? o : { x: lx, y: ly }));
    } else {
      setLook((o) => (o === null ? o : null));
    }
  }, [scrollY, x, y, scale, opacity, bx, by]);

  // measure on mount, resize and any layout change
  useEffect(() => {
    if (reduce) return;
    const r = st.current;
    const remeasure = () => {
      cancelAnimationFrame(r.raf);
      r.raf = requestAnimationFrame(() => {
        const m = measure();
        r.slots = m.slots;
        r.desktop = m.desktop;
        apply();
        setReady(true);
      });
    };
    r.greetUntil = performance.now() + 2600;
    const greetTimer = setTimeout(apply, 2650);
    remeasure();
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.body);
    window.addEventListener('resize', remeasure);
    // fonts change line heights after first paint
    document.fonts?.ready.then(remeasure).catch(() => {});
    return () => {
      clearTimeout(greetTimer);
      ro.disconnect();
      window.removeEventListener('resize', remeasure);
      cancelAnimationFrame(r.raf);
    };
  }, [reduce, apply]);

  // scroll → position; a settle check afterwards lets a walking Nami stop and stand
  useEffect(() => {
    if (reduce) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const unsub = scrollY.on('change', () => {
      st.current.scrolledAt = performance.now();
      apply();
      clearTimeout(settle);
      settle = setTimeout(apply, 300);
    });
    return () => {
      unsub();
      clearTimeout(settle);
    };
  }, [scrollY, apply, reduce]);

  // cursor tracking (hero only); skipped while the tab is hidden
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || document.hidden) return;
      st.current.pointer = { x: e.clientX, y: e.clientY };
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (st.current.frame?.heroHold) apply();
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [apply, reduce]);

  // little things she does on her own when nobody is scrolling
  useEffect(() => {
    if (reduce) return;
    const ACTS: PoseName[] = ['greeting', 'heart', 'celebrate', 'thinking', 'heart'];
    let n = 0;
    st.current.nextActAt = performance.now() + 6000;
    const id = setInterval(() => {
      const r = st.current;
      const now = performance.now();
      if (document.hidden || now < r.nextActAt || now < r.actUntil || now - r.scrolledAt < 3500) return;
      const f = r.frame;
      if (!f || f.opacity < 0.95 || f.say) return;
      r.act = ACTS[n++ % ACTS.length];
      r.actUntil = now + 3000;
      r.nextActAt = now + 9000 + Math.random() * 6000;
      apply();
      setTimeout(apply, 3050);
    }, 700);
    return () => clearInterval(id);
  }, [apply, reduce]);

  // the main button makes her cheer
  useEffect(() => {
    if (reduce) return;
    const onCheer = () => {
      st.current.cheerUntil = performance.now() + 2400;
      apply();
      setTimeout(apply, 2450);
    };
    window.addEventListener('nami:cheer', onCheer);
    return () => window.removeEventListener('nami:cheer', onCheer);
  }, [apply, reduce]);

  const poke = () => {
    const r = st.current;
    r.pokeText = POKES[r.pokes++ % POKES.length];
    r.pokeUntil = performance.now() + 2600;
    apply();
    setTimeout(apply, 2650);
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

  if (reduce || !ready) return null;

  return (
    <>
    <AnimatePresence>
      {say && <SayBubble key={say.text} text={say.text} side={say.side} x={bx} y={by} mouth={mouth} narrate={narrate} />}
    </AnimatePresence>
    <p className="sr-only" aria-live="polite">
      {say?.text ?? ''}
    </p>
    <button
      type="button"
      onClick={toggleNarrate}
      aria-pressed={narrate}
      className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full border border-teal-900/10 bg-card/90 px-4 py-2.5 text-sm font-semibold text-teal-900 shadow-[0_8px_24px_rgba(23,61,56,0.14)] backdrop-blur transition hover:bg-card"
    >
      {narrate ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
      {narrate ? 'Nami is talking' : 'Let Nami talk'}
    </button>
    <motion.div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-30 will-change-transform"
      style={{ x, y, scale, opacity, width: BASE, height: BASE, transformOrigin: '0 0' }}
    >
      {/* only her body is clickable, the box corners stay click-through */}
      <span onClick={poke} className="pointer-events-auto absolute inset-[18%_22%_8%_22%] cursor-pointer rounded-full" />
      <motion.div
        className="h-full w-full"
        style={{ transformOrigin: '50% 90%' }}
        initial={{ opacity: 0, scale: 0.86, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 170, damping: 16, delay: 0.15 }}
      >
        <NamiImage pose={pose} lookAt={look} mouth={mouth} className={clsx('h-full w-full', pose === 'swim' && 'lp-swim-mask')} />
      </motion.div>
    </motion.div>
    </>
  );
}

export default RoamingNami;

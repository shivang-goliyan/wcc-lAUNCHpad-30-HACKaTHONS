'use client';

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
 * - Fast scrolling switches her to the swim pose.
 * - Hero: waves once, then her eyes follow the cursor.
 * - Reduced motion: renders nothing; NamiSlot shows static poses instead.
 * - Tab hidden: NamiSvg pauses its own loop; we drop pointer tracking.
 * - Always `pointer-events: none` and `aria-hidden`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useScroll, useVelocity } from 'motion/react';
import { clsx } from 'clsx';
import { NamiSvg } from '@/components/nami/NamiSvg';
import type { PoseName } from '@/lib/nami/poses';

const BASE = 200; // px size of the rendered Nami box before scaling
const DESKTOP_MIN = 1280; // matches Tailwind `xl`, where the lanes exist
const FAST = 1900; // px/s → swim
const SLOW = 900;

type Slot = {
  id: string;
  pose: PoseName;
  path: boolean;
  hero: boolean;
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

type Frame = { x: number; y: number; size: number; opacity: number; pose: PoseName; heroHold: boolean };

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
      hero: el.dataset.hero === '1',
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
    return { ...q, opacity: 1, pose: a.path ? 'swim' : a.pose, heroHold: a.hero };
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
    const vis = smooth(0.25, 0.9, Math.abs(t - 0.5) * 2);
    const sz = q.size * (0.9 + 0.1 * vis);
    return {
      x: q.x + (q.size - sz) / 2,
      y: q.y + (q.size - sz) + (1 - vis) * 14,
      size: sz,
      opacity: vis,
      pose: t < 0.5 ? (a.path ? 'swim' : a.pose) : b.path ? 'swim' : b.pose,
      heroHold: false,
    };
  }
  const size = lerp(qa.size, qb.size, e);
  const cx = lerp(ca, cb, e);
  const by = lerp(qa.y + qa.size, qb.y + qb.size, e); // interpolate the baseline, keep feet steady
  const pa: PoseName = a.path ? 'swim' : a.pose;
  const pb: PoseName = b.path ? 'swim' : b.pose;
  let pose: PoseName = t < 0.5 ? pa : pb;
  // gliding into or out of the water: swim for the whole move, settle at the ends
  if (solid && (a.path || b.path)) pose = t < 0.12 ? pa : t > 0.88 ? pb : 'swim';
  return { x: cx - size / 2, y: by - size, size, opacity: 1, pose, heroHold: false };
}

export function RoamingNami() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);

  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(0);

  const [pose, setPose] = useState<PoseName>('greeting');
  const [look, setLook] = useState<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);

  const st = useRef({
    slots: [] as Slot[],
    desktop: true,
    fastUntil: 0,
    greetUntil: 0,
    frame: null as Frame | null,
    pose: 'greeting' as PoseName,
    raf: 0,
    pointer: null as { x: number; y: number } | null,
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
    if (now < r.fastUntil && !f.heroHold) p = 'swim';
    if (p !== r.pose) {
      r.pose = p;
      setPose(p);
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
  }, [scrollY, x, y, scale, opacity]);

  // measure on mount, resize and any layout change
  useEffect(() => {
    if (reduce !== false) return;
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

  // hide the server-rendered hero Nami once we are positioned
  useEffect(() => {
    if (!ready || reduce !== false) return;
    document.documentElement.dataset.namiRoam = 'on';
    return () => {
      delete document.documentElement.dataset.namiRoam;
    };
  }, [ready, reduce]);

  // scroll → position
  useEffect(() => {
    if (reduce !== false) return;
    return scrollY.on('change', apply);
  }, [scrollY, apply, reduce]);

  // fast scroll → swim, with a short tail so it doesn't flicker
  useEffect(() => {
    if (reduce !== false) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = velocity.on('change', (v) => {
      const r = st.current;
      const fast = Math.abs(v) > FAST || (performance.now() < r.fastUntil && Math.abs(v) > SLOW);
      if (!fast) return;
      r.fastUntil = performance.now() + 380;
      clearTimeout(timer);
      timer = setTimeout(apply, 400);
      apply();
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [velocity, apply, reduce]);

  // cursor tracking (hero only); skipped while the tab is hidden
  useEffect(() => {
    if (reduce !== false) return;
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

  if (reduce !== false || !ready) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-30 will-change-transform"
      style={{ x, y, scale, opacity, width: BASE, height: BASE, transformOrigin: '0 0' }}
    >
      <NamiSvg pose={pose} lookAt={look} className={clsx('h-full w-full', pose === 'swim' && 'lp-swim-mask')} />
    </motion.div>
  );
}

export default RoamingNami;

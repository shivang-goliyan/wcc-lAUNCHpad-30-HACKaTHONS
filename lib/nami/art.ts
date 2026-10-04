import type { MouthShape, PoseName } from "./poses";
import { WAN_CLIPS } from "./clips";

// Which overlays exist for each painted pose (files live in public/nami/).
// Overlays are full-canvas images that are transparent except for the part
// that changes, so they stack exactly on top of the pose.
export type PoseArt = {
  blink?: boolean;
  wave?: boolean;
  mouths?: MouthShape[];
  breathe?: boolean;
  /** mouth already painted on the pose; asking for it shows no overlay */
  base?: MouthShape;
  /** overlay shown while silent, when the painted pose has its mouth open */
  silent?: MouthShape;
  /** no art of its own yet: draw this pose instead */
  alias?: PoseName;
};

export const NAMI_ART: Record<PoseName, PoseArt> = {
  idle: { blink: true, mouths: ["small", "wide"] },
  greeting: { wave: true },
  listening: { blink: true },
  thinking: { blink: true },
  // painted mid-sentence, so lip flaps go closed <-> wide
  speaking: { blink: true, mouths: ["closed-smile", "wide"], base: "small", silent: "closed-smile" },
  reminder: { blink: true },
  acknowledged: {},
  calling: { blink: true },
  help: { blink: true, mouths: ["small", "wide"] },
  quiet: {},
  swim: { breathe: false },
  peek: { breathe: false },
  "point-left": {},
  "point-right": {},
  stand: {},
  walk: { breathe: false },
  "walk-left": { breathe: false },
  celebrate: {},
  hop: { breathe: false },
  heart: {},
};

/**
 * Animation clips: stacked-alpha MP4s (colour on top, alpha below) made from the
 * Wan clips by design/nami-art/pack_clips.py.
 *   "a~b"     plays from pose a to pose b; `rev` is the same clip backwards (b -> a)
 *   "p@loop"  loops while pose p is held; its first and last frames are the pose itself
 */
export type Clip = { src: string; frames: number; cols: number; fps: number; rev?: string };

export const NAMI_CLIPS: Record<string, Clip> = WAN_CLIPS;

export const hasLoop = (pose: PoseName) => `${pose}@loop` in NAMI_CLIPS;

// bump when the art changes so the CDN never serves a stale pose
export const NAMI_ART_VERSION = 3;

export function namiSrc(pose: PoseName, part?: string) {
  const p = NAMI_ART[pose].alias ?? pose;
  return `/nami/${p}${part ? `-${part}` : ""}.webp?v=${NAMI_ART_VERSION}`;
}

export const clipSrc = (c: Clip) => `${c.src}?v=${NAMI_ART_VERSION}`;

export type ClipStep = { key: string; reverse: boolean };

/**
 * Shortest chain of clips from one pose to another (at most 3 hops), using only
 * clips that are loaded. Empty when there is no path; the caller crossfades.
 */
export function clipRoute(
  from: PoseName,
  to: PoseName,
  ready: (key: string) => boolean,
  keys: string[] = Object.keys(NAMI_CLIPS),
): ClipStep[] {
  if (from === to) return [];
  const edges = new Map<string, { to: string; step: ClipStep }[]>();
  const add = (a: string, b: string, step: ClipStep) => {
    if (!edges.has(a)) edges.set(a, []);
    edges.get(a)!.push({ to: b, step });
  };
  for (const key of keys) {
    if (!key.includes("~") || !ready(key)) continue;
    const [a, b] = key.split("~");
    add(a, b, { key, reverse: false });
    add(b, a, { key, reverse: true });
  }
  const prev = new Map<string, { from: string; step: ClipStep }>();
  const seen = new Set<string>([from]);
  let frontier: string[] = [from];
  for (let depth = 0; depth < 3 && frontier.length; depth++) {
    const next: string[] = [];
    for (const n of frontier) {
      for (const e of edges.get(n) ?? []) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        prev.set(e.to, { from: n, step: e.step });
        if (e.to === to) {
          const out: ClipStep[] = [];
          for (let cur: string = to; cur !== from; cur = prev.get(cur)!.from) out.unshift(prev.get(cur)!.step);
          return out;
        }
        next.push(e.to);
      }
    }
    frontier = next;
  }
  return [];
}

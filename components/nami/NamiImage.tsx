"use client";

/**
 * Nami from the painted pose art (docs/DECISIONS.md D18–D19). Same props as
 * NamiSvg, so screens can swap renderers without touching care logic.
 *
 * Every pose is an aligned still on one square canvas. Motion comes from clips
 * (lib/nami/art.ts) played by ClipPlayer: a pose change plays the shortest chain
 * of transition clips, then the pose's living loop if it has one. Whenever no
 * clip is on screen the still shows, with breathing, blinks and lip-sync
 * overlays, and she leans a little toward lookAt either way.
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { isMotionValue, type MotionValue } from "motion/react";
import { mouthForLevel, type PoseName } from "@/lib/nami/poses";
import { NAMI_ART, NAMI_CLIPS, clipRoute, clipSrc, namiSrc } from "@/lib/nami/art";
import { ClipPlayer, type ClipRef } from "./clipPlayer";
import type { NamiSvgProps } from "./NamiSvg";

const FADE_MS = 120;

/** a still that failed (e.g. mid-deploy) tries again a few times instead of showing a broken image */
function retryImg(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const n = Number(img.dataset.retry ?? 0);
  if (n >= 4) return;
  img.dataset.retry = String(n + 1);
  const url = new URL(img.src, location.href);
  url.searchParams.set('r', String(n + 1));
  setTimeout(() => (img.src = url.toString()), 800 * (n + 1));
}

type Props = NamiSvgProps & {
  /** stills only, no clip player (galleries, thumbnails) */
  still?: boolean;
  /** speed of looping clips, 1 = as rendered */
  speed?: number;
};

export function NamiImage({
  pose = "idle",
  mouth = 0,
  lookAt = null,
  blink = "auto",
  reducedMotion = false,
  still = false,
  speed = 1,
  className,
  style,
  title,
}: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const blinkRef = useRef<HTMLImageElement>(null);
  const waveRef = useRef<HTMLImageElement>(null);
  const mouthRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const baseRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // poses we've shown at least once stay mounted, so going back never flashes
  const [seen, setSeen] = useState<PoseName[]>([pose]);
  if (!seen.includes(pose)) setSeen([...seen, pose]);

  const animated = !reducedMotion && !still;

  const rt = useRef({
    pose,
    reduced: reducedMotion,
    blinkOn: blink === "auto",
    level: 0,
    blinkAt: -1,
    double: false,
    nodAt: -1,
    waveAt: -1,
    lx: 0,
    ly: 0,
    gx: 0,
    gy: 0,
    t0: 0,
    raf: 0,
    running: false,
    player: null as ClipPlayer | null,
    ready: new Set<string>(),
    loopPaused: false,
    /** keep this still on screen until the new clip has drawn its first frame */
    holdPose: null as PoseName | null,
    paint: (() => {}) as (now: number) => void,
  });

  // the per-frame painter: only touches styles and the canvas, never React state
  useEffect(() => {
    const r = rt.current;
    r.t0 = performance.now();
    r.paint = (now) => {
      const art = NAMI_ART[r.pose];
      const live = !r.reduced;
      const t = (now - r.t0) / 1000;
      const pl = r.player;

      // talking over a looping pose: pause the loop so the mouth overlays sit on the still
      const talking = r.level >= 0.08 && !!art.mouths;
      if (pl) {
        if (talking && pl.looping) {
          pl.stop();
          r.loopPaused = true;
        } else if (!talking && r.loopPaused) {
          r.loopPaused = false;
          const l = loopOf(r.pose, r.ready);
          if (l) pl.play([], l);
        }
        pl.draw();
      }
      const clipOn = !!pl?.showing;
      if (canvasRef.current) canvasRef.current.style.visibility = clipOn ? "visible" : "hidden";
      if (baseRef.current) {
        baseRef.current.style.visibility = clipOn ? "hidden" : "visible";
        // until the clip draws, show the pose we're leaving, never the one we're heading to
        if (clipOn || !pl?.pending) r.holdPose = null;
        const show = r.holdPose ?? r.pose;
        for (const img of baseRef.current.querySelectorAll<HTMLImageElement>("img[data-p]")) {
          const on = img.dataset.p === show ? "1" : "0";
          if (img.style.opacity !== on) {
            if (r.holdPose) img.style.transition = "none";
            img.style.opacity = on;
          }
        }
      }

      let blinkOn = false;
      if (live && r.blinkOn && r.blinkAt >= 0) {
        const dt = now - r.blinkAt;
        blinkOn = dt < 120 || (r.double && dt > 190 && dt < 310);
        if (dt > (r.double ? 320 : 130)) r.blinkAt = -1;
      }

      let nod = 0;
      if (live && r.nodAt >= 0) {
        const p = (now - r.nodAt) / 900;
        if (p >= 1) r.nodAt = -1;
        else if (p > 0) nod = Math.abs(Math.sin(p * Math.PI * 2)) * (1 - p * 0.4);
      }

      // wave without clips: swap the two greeting frames a few times
      let waveB = false;
      if (live && r.waveAt >= 0 && art.wave) {
        const dt = now - r.waveAt;
        if (dt > 1500) r.waveAt = -1;
        else if (dt > 0) waveB = Math.floor(dt / 250) % 2 === 1;
      }

      // ease the lean toward the gaze target
      const k = live ? 0.12 : 1;
      r.gx += ((live ? r.lx : 0) - r.gx) * k;
      r.gy += ((live ? r.ly : 0) - r.gy) * k;

      // clips carry their own breathing; the still gets a gentle one
      const breath = live && !clipOn && art.breathe !== false ? 0.5 - 0.5 * Math.cos((t / 5) * Math.PI * 2) : 0;
      const talk = live ? r.level : 0;
      const body = bodyRef.current;
      if (body) {
        const sy = 1 + breath * 0.012 + talk * 0.006;
        const sx = 1 + breath * 0.005;
        const n = clipOn ? 0 : nod;
        body.style.transform = `translate(${r.gx * 1.2}%, ${r.gy * 0.8 + n * 1.4}%) rotate(${r.gx * 1.6 + n * 1.2}deg) scale(${sx}, ${sy})`;
      }

      if (clipOn) {
        waveB = false;
        blinkOn = false;
      }
      if (waveRef.current) waveRef.current.style.opacity = waveB ? "1" : "0";
      if (blinkRef.current) blinkRef.current.style.opacity = blinkOn && !waveB ? "1" : "0";

      let shape: string | null = r.level >= 0.08 ? mouthForLevel(r.level, "closed-smile", Math.floor(now / 140) % 2 === 1) : (art.silent ?? null);
      if (shape === art.base || clipOn) shape = null;
      for (const [m, el] of Object.entries(mouthRefs.current)) {
        if (!el) continue;
        const on = !blinkOn && !waveB && shape !== null && (art.mouths?.includes(m as never) ?? false) && pickMouth(shape, art.mouths ?? []) === m;
        el.style.opacity = on ? "1" : "0";
      }
    };
    r.paint(performance.now());
  }, []);

  // walk cycles follow how fast she is actually moving
  useEffect(() => {
    rt.current.player?.setRate(speed);
  }, [speed]);

  // the clip player lives as long as this Nami animates
  useEffect(() => {
    if (!animated || !canvasRef.current) return;
    const r = rt.current;
    const pl = new ClipPlayer(canvasRef.current);
    if (!pl.ok) return;
    r.player = pl;
    // fetch clips in idle time, ones touching this pose first; a clip that isn't ready is skipped
    const keys = Object.keys(NAMI_CLIPS).sort((a, b) => Number(b.includes(r.pose)) - Number(a.includes(r.pose)));
    let cancelled = false;
    const go = async () => {
      for (const key of keys) {
        if (cancelled) return;
        const c = NAMI_CLIPS[key];
        try {
          await pl.preload(clipSrc(c));
          if (c.rev) await pl.preload(clipSrc({ ...c, src: c.rev }));
          if (cancelled) return;
          r.ready.add(key);
          // the current pose's loop just arrived: start it
          if (key === `${r.pose}@loop` && !pl.showing && !r.loopPaused) pl.play([], loopOf(r.pose, r.ready));
        } catch {
          // a missing clip just means a crossfade instead
        }
      }
    };
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = ric ? ric(() => void go()) : window.setTimeout(() => void go(), 300);
    return () => {
      cancelled = true;
      if (!ric) clearTimeout(id);
      r.player = null;
      r.ready.clear();
      pl.dispose();
    };
  }, [animated]);

  // idle loop: ~30 fps unless something quick is happening; stops when hidden
  useEffect(() => {
    const r = rt.current;
    r.reduced = reducedMotion;
    let blinkTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      r.running = false;
      cancelAnimationFrame(r.raf);
      clearTimeout(blinkTimer);
    };
    const queueBlink = () => {
      clearTimeout(blinkTimer);
      blinkTimer = setTimeout(() => {
        r.blinkAt = performance.now();
        r.double = Math.random() < 0.18;
        queueBlink();
      }, 3000 + Math.random() * 4000);
    };
    const start = () => {
      if (r.running || reducedMotion || document.hidden) return;
      r.running = true;
      let last = 0;
      const tick = (now: number) => {
        if (!r.running) return;
        const busy =
          !!r.player?.showing || r.blinkAt >= 0 || r.nodAt >= 0 || r.waveAt >= 0 || r.level > 0 || Math.abs(r.gx - r.lx) + Math.abs(r.gy - r.ly) > 0.01;
        if (busy || now - last >= 32) {
          last = now;
          r.paint(now);
        }
        r.raf = requestAnimationFrame(tick);
      };
      r.raf = requestAnimationFrame(tick);
      queueBlink();
    };
    const onVis = () => (document.hidden ? stop() : start());
    if (reducedMotion) {
      stop();
      r.paint(performance.now());
    } else start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [reducedMotion]);

  // layout effect: start the clip before the browser paints the new still
  useLayoutEffect(() => {
    const r = rt.current;
    const prev = r.pose;
    r.pose = pose;
    if (!reducedMotion && prev !== pose) {
      const now = performance.now();
      const pl = r.player;
      let steps = pl ? clipRoute(prev, pose, (k) => r.ready.has(k)) : [];
      // help must never wait on a flourish: only a direct clip, else straight there
      if (pose === "help" && steps.length > 1) steps = [];
      r.loopPaused = false;
      if (pl) {
        const seq = steps.map((st) => {
          const c = NAMI_CLIPS[st.key];
          return { src: clipSrc(st.reverse && c.rev ? { ...c, src: c.rev } : c), fps: c.fps };
        });
        const loop = loopOf(pose, r.ready);
        if (seq.length || loop) {
          // a still on screen now stays until the clip's first frame replaces it
          if (!pl.showing) r.holdPose = prev;
          pl.play(seq, loop);
        } else pl.stop();
      }
      // without clips, the code adds the nod and the wave
      const settle = steps.reduce((ms, st) => ms + (NAMI_CLIPS[st.key].frames / NAMI_CLIPS[st.key].fps) * 1000, 0);
      if (pose === "acknowledged" && !steps.length) r.nodAt = now + settle;
      if (pose === "greeting" && !loopOf("greeting", r.ready)) r.waveAt = now + settle;
    }
    r.paint(performance.now());
  }, [pose, reducedMotion]);

  useEffect(() => {
    rt.current.blinkOn = blink === "auto";
  }, [blink]);

  useEffect(() => {
    const r = rt.current;
    if (isMotionValue(mouth)) {
      const mv = mouth as MotionValue<number>;
      r.level = mv.get();
      return mv.on("change", (v) => {
        r.level = v;
        if (!r.running) r.paint(performance.now());
      });
    }
    r.level = typeof mouth === "number" && Number.isFinite(mouth) ? mouth : 0;
    if (!r.running) r.paint(performance.now());
  }, [mouth]);

  const lx = lookAt ? Math.max(-1, Math.min(1, lookAt.x)) : 0;
  const ly = lookAt ? Math.max(-1, Math.min(1, lookAt.y)) : 0;
  useEffect(() => {
    rt.current.lx = lx;
    rt.current.ly = ly;
  }, [lx, ly]);

  const art = NAMI_ART[pose];
  const layer: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", userSelect: "none" };

  return (
    <div
      className={className}
      style={{ position: "relative", aspectRatio: "1 / 1", ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-pose={pose}
    >
      <div ref={bodyRef} style={{ position: "absolute", inset: 0, transformOrigin: "50% 92%", willChange: reducedMotion ? undefined : "transform" }}>
        {animated && <canvas ref={canvasRef} width={384} height={384} style={{ ...layer, visibility: "hidden" }} />}
        <div ref={baseRef} style={{ position: "absolute", inset: 0 }}>
          {seen.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img onError={retryImg}
              key={p}
              data-p={p}
              src={namiSrc(p)}
              alt=""
              draggable={false}
              decoding="async"
              style={{ ...layer, opacity: p === pose ? 1 : 0, transition: reducedMotion ? undefined : `opacity ${FADE_MS}ms ease-out` }}
            />
          ))}
        </div>
        {art.wave && (
          // eslint-disable-next-line @next/next/no-img-element
          <img onError={retryImg} ref={waveRef} src={namiSrc(pose, "wave")} alt="" draggable={false} style={{ ...layer, opacity: 0 }} />
        )}
        {art.blink && (
          // eslint-disable-next-line @next/next/no-img-element
          <img onError={retryImg} ref={blinkRef} key={`blink-${pose}`} src={namiSrc(pose, "blink")} alt="" draggable={false} style={{ ...layer, opacity: 0 }} />
        )}
        {(art.mouths ?? []).map((m) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img onError={retryImg}
            key={`${pose}-${m}`}
            ref={(el) => {
              mouthRefs.current[m] = el;
            }}
            src={namiSrc(pose, `mouth-${m}`)}
            alt=""
            draggable={false}
            style={{ ...layer, opacity: 0 }}
          />
        ))}
      </div>
    </div>
  );
}

/** the pose's loop, if it is loaded */
function loopOf(pose: PoseName, ready: Set<string>): ClipRef | null {
  const key = `${pose}@loop`;
  const c = NAMI_CLIPS[key];
  return c && ready.has(key) ? { src: clipSrc(c), fps: c.fps } : null;
}

// fall back to the nearest mouth we actually have art for
function pickMouth(shape: string, have: readonly string[]) {
  if (have.includes(shape)) return shape;
  if (shape === "round" && have.includes("wide")) return "wide";
  if (shape === "wide" && have.includes("small")) return "small";
  return have[0];
}

export default NamiImage;

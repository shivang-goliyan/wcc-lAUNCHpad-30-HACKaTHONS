"use client";

/**
 * Nami from the painted pose art (docs/DECISIONS.md D18). Same props as NamiSvg,
 * so screens can swap renderers without touching care logic.
 *
 * Every pose is a separate aligned image on one square canvas. Motion comes from
 * clips (lib/nami/art.ts): a pose change plays the shortest chain of transition
 * clips, then the pose's loop if it has one. Without clips she still breathes,
 * blinks and lip-syncs through overlays on the still pose, and leans toward lookAt.
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { isMotionValue, type MotionValue } from "motion/react";
import { mouthForLevel, type PoseName } from "@/lib/nami/poses";
import { NAMI_ART, NAMI_CLIPS, clipRoute, clipSrc, namiSrc, type ClipStep } from "@/lib/nami/art";
import type { NamiSvgProps } from "./NamiSvg";

const FADE_MS = 120;

const clipMs = (key: string) => (NAMI_CLIPS[key].frames / NAMI_CLIPS[key].fps) * 1000;

/** which sheet cell to show now, or null when nothing is playing */
function sheetFrame(steps: ClipStep[], startedAt: number, now: number): { key: string; i: number } | null {
  let t = Math.max(0, now - startedAt);
  for (const st of steps) {
    const c = NAMI_CLIPS[st.key];
    const ms = clipMs(st.key);
    if (t < ms) {
      const i = Math.min(c.frames - 1, Math.floor((t / 1000) * c.fps));
      return { key: st.key, i: st.reverse ? c.frames - 1 - i : i };
    }
    t -= ms;
  }
  return null;
}

export function NamiImage({
  pose = "idle",
  mouth = 0,
  lookAt = null,
  blink = "auto",
  reducedMotion = false,
  className,
  style,
  title,
}: NamiSvgProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const blinkRef = useRef<HTMLImageElement>(null);
  const waveRef = useRef<HTMLImageElement>(null);
  const mouthRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const baseRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);

  // poses we've shown at least once stay mounted, so going back never flashes
  const [seen, setSeen] = useState<PoseName[]>([pose]);
  if (!seen.includes(pose)) setSeen([...seen, pose]);

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
    steps: [] as ClipStep[],
    stepsAt: -1,
    loopAt: 0,
    ready: new Set<string>(),
    running: false,
    paint: (() => {}) as (now: number) => void,
  });

  // the per-frame painter: only touches styles, never React state
  useEffect(() => {
    const r = rt.current;
    r.t0 = performance.now();
    r.paint = (now) => {
      const art = NAMI_ART[r.pose];
      const live = !r.reduced;
      const t = (now - r.t0) / 1000;

      // a pose change in progress, else the pose's loop (paused while she talks over the still pose)
      let cell: { key: string; i: number } | null = null;
      if (live && r.stepsAt >= 0) {
        cell = sheetFrame(r.steps, r.stepsAt, now);
        if (!cell) {
          r.stepsAt = -1;
          r.loopAt = now;
        }
      }
      const loopKey = `${r.pose}@loop`;
      const talking = r.level >= 0.08 && !!art.mouths;
      if (live && !cell && !talking && r.ready.has(loopKey)) {
        const c = NAMI_CLIPS[loopKey];
        cell = { key: loopKey, i: Math.floor((Math.max(0, now - r.loopAt) / 1000) * c.fps) % c.frames };
      }
      const cl = clipRef.current;
      if (cl) {
        if (cell) {
          const c = NAMI_CLIPS[cell.key];
          const rows = Math.ceil(c.frames / c.cols);
          const url = `url("${clipSrc(c)}")`;
          if (cl.style.backgroundImage !== url) {
            cl.style.backgroundImage = url;
            cl.style.backgroundSize = `${c.cols * 100}% ${rows * 100}%`;
          }
          const col = cell.i % c.cols;
          const row = Math.floor(cell.i / c.cols);
          cl.style.backgroundPosition = `${c.cols > 1 ? (col / (c.cols - 1)) * 100 : 0}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%`;
          cl.style.visibility = "visible";
        } else cl.style.visibility = "hidden";
      }
      const step = cell;
      if (baseRef.current) baseRef.current.style.visibility = step ? "hidden" : "visible";

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

      // wave: swap the two greeting frames a few times, then hold the first
      let waveB = false;
      if (live && r.waveAt >= 0 && art.wave) {
        const dt = now - r.waveAt;
        if (dt > 1500) r.waveAt = -1;
        else waveB = Math.floor(dt / 250) % 2 === 1;
      }

      // ease the lean toward the gaze target
      const k = live ? 0.12 : 1;
      r.gx += ((live ? r.lx : 0) - r.gx) * k;
      r.gy += ((live ? r.ly : 0) - r.gy) * k;

      const breath = live && art.breathe !== false ? 0.5 - 0.5 * Math.cos((t / 5) * Math.PI * 2) : 0;
      const talk = live ? r.level : 0;
      const body = bodyRef.current;
      if (body) {
        const sy = 1 + breath * 0.012 + talk * 0.006;
        const sx = 1 + breath * 0.005;
        const rot = r.gx * 1.6 + nod * 1.2;
        body.style.transform = `translate(${r.gx * 1.2}%, ${r.gy * 0.8 + nod * 1.4}%) rotate(${rot}deg) scale(${sx}, ${sy})`;
      }

      if (step) waveB = false;
      if (waveRef.current) waveRef.current.style.opacity = waveB ? "1" : "0";
      if (blinkRef.current) blinkRef.current.style.opacity = blinkOn && !waveB ? "1" : "0";

      if (step) blinkOn = false;
      let shape: string | null = r.level >= 0.08 ? mouthForLevel(r.level, "closed-smile", Math.floor(now / 140) % 2 === 1) : (art.silent ?? null);
      if (shape === art.base) shape = null;
      for (const [m, el] of Object.entries(mouthRefs.current)) {
        if (!el) continue;
        const on = !blinkOn && !waveB && shape !== null && (art.mouths?.includes(m as never) ?? false) && pickMouth(shape, art.mouths ?? []) === m;
        el.style.opacity = on ? "1" : "0";
      }
    };
    r.paint(performance.now());
  }, []);

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
        const busy = r.stepsAt >= 0 || r.ready.has(`${r.pose}@loop`) || r.blinkAt >= 0 || r.nodAt >= 0 || r.waveAt >= 0 || r.level > 0 || Math.abs(r.gx - r.lx) + Math.abs(r.gy - r.ly) > 0.01;
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

  // layout effect: the tween has to cover the new pose before the browser paints it
  useLayoutEffect(() => {
    const r = rt.current;
    const prev = r.pose;
    r.pose = pose;
    if (!reducedMotion && prev !== pose) {
      const now = performance.now();
      let steps = clipRoute(prev, pose, (k) => r.ready.has(k));
      // help must never wait on a flourish: only a direct clip, else straight there
      if (pose === "help" && steps.length > 1) steps = [];
      r.steps = steps;
      r.stepsAt = steps.length ? now : -1;
      r.loopAt = now;
      const settle = steps.reduce((ms, st) => ms + clipMs(st.key), 0);
      if (pose === "acknowledged") r.nodAt = now + settle;
      if (pose === "greeting") r.waveAt = now + settle;
    }
    r.paint(performance.now());
  }, [pose, reducedMotion]);

  // fetch clip sheets in idle time, this pose's loop first; a clip that isn't loaded is skipped
  useEffect(() => {
    if (reducedMotion) return;
    const r = rt.current;
    const todo = Object.keys(NAMI_CLIPS)
      .filter((k) => !r.ready.has(k))
      .sort((a) => (a === `${pose}@loop` ? -1 : 0));
    if (!todo.length) return;
    const go = () =>
      todo.forEach((k) => {
        const img = new Image();
        img.onload = () => {
          // decode before first use so the first frame never flashes empty
          img.decode?.().catch(() => {}).finally(() => r.ready.add(k));
        };
        img.src = clipSrc(NAMI_CLIPS[k]);
      });
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = ric ? ric(go) : window.setTimeout(go, 800);
    return () => {
      if (!ric) clearTimeout(id);
    };
    // pose is only used to order the queue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

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
        <div ref={clipRef} style={{ ...layer, visibility: "hidden", backgroundRepeat: "no-repeat" }} />
        <div ref={baseRef} style={{ position: "absolute", inset: 0 }}>
        {seen.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p}
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
          <img ref={waveRef} src={namiSrc(pose, "wave")} alt="" draggable={false} style={{ ...layer, opacity: 0 }} />
        )}
        {art.blink && (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={blinkRef} key={`blink-${pose}`} src={namiSrc(pose, "blink")} alt="" draggable={false} style={{ ...layer, opacity: 0 }} />
        )}
        {(art.mouths ?? []).map((m) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
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

// fall back to the nearest mouth we actually have art for
function pickMouth(shape: string, have: readonly string[]) {
  if (have.includes(shape)) return shape;
  if (shape === "round" && have.includes("wide")) return "wide";
  if (shape === "wide" && have.includes("small")) return "small";
  return have[0];
}

export default NamiImage;

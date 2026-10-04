"use client";

/**
 * Nami: a layered SVG otter rig (docs/DESIGN.md §4–5, DECISIONS.md D10).
 *
 * The art is static markup with named part groups (`data-part`). Each part
 * has an explicit pivot (see RIG in lib/nami/poses.ts). Pose changes spring
 * every part transform with `motion` (no crossfades, no jumps); idle life
 * (breathing, blinking, tail and scarf sway, pupil tracking) is layered on
 * top in a single rAF loop that writes SVG attributes directly, so React does
 * not re-render per frame.
 */

import {
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { animate, isMotionValue, motionValue, type MotionValue } from "motion/react";
import {
  MOUTH_SHAPES,
  PAW_SHAPES,
  PROP_KINDS,
  RIG,
  getPose,
  mouthForLevel,
  type MouthShape,
  type Pose,
  type PoseName,
  type Xform,
} from "@/lib/nami/poses";

export type NamiSvgProps = {
  pose?: PoseName;
  /** 0..1 output-audio envelope (DESIGN.md §7). A MotionValue avoids React re-renders at audio rate. */
  mouth?: number | MotionValue<number>;
  /** Gaze target, each axis in -1..1 (screen space; +y is down). */
  lookAt?: { x: number; y: number } | null;
  /** "auto" (default) blinks every 3–7 s; "off" keeps the eyes open. */
  blink?: "auto" | "off";
  /** Static poses only: no breathing, blinking, sway, tracking or springs. */
  reducedMotion?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Accessible name. Without it the SVG is decorative (aria-hidden). */
  title?: string;
};

/* ------------------------------------------------------------------------ */
/* Palette                                                                   */
/* ------------------------------------------------------------------------ */

const C = {
  furHi: "#AD7E5F",
  fur: "#8A6046",
  furDark: "#6A4532",
  furDeep: "#4F3324",
  creamHi: "#FFF7EA",
  cream: "#F5E3CA",
  creamDark: "#E2C6A2",
  sole: "#C29878",
  pad: "#5A3A2A",
  nose: "#33201A",
  mouth: "#4B2620",
  tongue: "#D98A7C",
  ink: "#2A1912",
  brow: "#5A3828",
  scarfHi: "#A3C7BA",
  scarf: "#80A99B",
  scarfDark: "#618C7E",
  scarfDeep: "#4C7266",
  teal: "#173D38",
  ivory: "#FFFDF7",
  line: "#DCD6C8",
};

/* ------------------------------------------------------------------------ */
/* Channels: every animatable number, flattened                              */
/* ------------------------------------------------------------------------ */

const XFORM_PARTS = [
  "root",
  "body",
  "belly",
  "legs",
  "tail",
  "head",
  "scarfKnot",
  "scarfTail",
  "browL",
  "browR",
] as const;
type XformPart = (typeof XFORM_PARTS)[number];
const XFORM_KEYS = ["x", "y", "rotate", "scaleX", "scaleY"] as const;

type Values = Record<string, number>;

function poseValues(p: Pose): Values {
  const v: Values = {};
  for (const part of XFORM_PARTS) {
    const t: Xform = p[part];
    for (const k of XFORM_KEYS) v[`${part}.${k}`] = t[k];
  }
  for (const side of ["L", "R"] as const) {
    const arm = side === "L" ? p.armL : p.armR;
    v[`arm${side}.liftX`] = arm.lift.x;
    v[`arm${side}.liftY`] = arm.lift.y;
    v[`arm${side}.upper`] = arm.upper;
    v[`arm${side}.fore`] = arm.fore;
    for (const s of PAW_SHAPES) v[`paw${side}.${s}`] = arm.paw === s ? 1 : 0;
  }
  v.lid = p.eyes.lid;
  v.lookX = p.eyes.look.x;
  v.lookY = p.eyes.look.y;
  v.track = p.eyes.track;
  v.happy = p.eyes.style === "happy" ? 1 : 0;
  for (const k of PROP_KINDS) v[`prop.${k}.opacity`] = p.prop?.kind === k ? 1 : 0;
  if (p.prop) {
    const k = p.prop.kind;
    v[`prop.${k}.x`] = p.prop.x;
    v[`prop.${k}.y`] = p.prop.y;
    v[`prop.${k}.rotate`] = p.prop.rotate;
    v[`prop.${k}.scale`] = p.prop.scale;
  }
  v.water = p.water ? 1 : 0;
  v.shadow = p.shadow;
  v.wave = p.motion.wave ? 1 : 0;
  v.nod = p.motion.nod ? 1 : 0;
  v.gesture = p.motion.gesture ? 1 : 0;
  v.bob = p.motion.bob ? 1 : 0;
  return v;
}

/** Default placement for every prop so inactive props have sane values. */
function allChannelDefaults(p: Pose): Values {
  const v = poseValues(p);
  for (const k of PROP_KINDS) {
    v[`prop.${k}.x`] ??= 200;
    v[`prop.${k}.y`] ??= 290;
    v[`prop.${k}.rotate`] ??= 0;
    v[`prop.${k}.scale`] ??= 1;
  }
  return v;
}

/* ------------------------------------------------------------------------ */
/* Frame computation (pure; used for SSR markup and every animation frame)    */
/* ------------------------------------------------------------------------ */

type Overlay = {
  breath: number; // 0..1
  tailSway: number; // degrees
  scarfSway: number; // degrees
  wave: number; // degrees added to the right forearm
  gesture: number; // degrees added to the left forearm
  nod: number; // head drop in units
  bob: number; // head lift in units
  blink: number; // 0..1 lid
  look: { x: number; y: number }; // external gaze in -1..1, already smoothed
  mouth: MouthShape | null; // null = pose default
};

const NO_OVERLAY: Overlay = {
  breath: 0,
  tailSway: 0,
  scarfSway: 0,
  wave: 0,
  gesture: 0,
  nod: 0,
  bob: 0,
  blink: 0,
  look: { x: 0, y: 0 },
  mouth: null,
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function tf(
  x: number,
  y: number,
  rot: number,
  sx: number,
  sy: number,
  px: number,
  py: number,
): string {
  return `translate(${r3(x + px)} ${r3(y + py)}) rotate(${r3(rot)}) scale(${r3(sx)} ${r3(sy)}) translate(${-px} ${-py})`;
}

function partTf(v: Values, part: XformPart, pivot: { x: number; y: number }, extra?: Partial<Xform>) {
  return tf(
    v[`${part}.x`] + (extra?.x ?? 0),
    v[`${part}.y`] + (extra?.y ?? 0),
    v[`${part}.rotate`] + (extra?.rotate ?? 0),
    v[`${part}.scaleX`] * (extra?.scaleX ?? 1),
    v[`${part}.scaleY`] * (extra?.scaleY ?? 1),
    pivot.x,
    pivot.y,
  );
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

type Frame = {
  attrs: Record<string, Record<string, string>>;
  mouth: MouthShape;
};

function computeFrame(v: Values, o: Overlay, silentMouth: MouthShape): Frame {
  const a: Frame["attrs"] = {};
  const set = (part: string, name: string, value: string | number) => {
    (a[part] ??= {})[name] = typeof value === "number" ? String(r3(value)) : value;
  };

  set("root", "transform", partTf(v, "root", RIG.root));
  set("tail", "transform", partTf(v, "tail", RIG.tail, { rotate: o.tailSway }));
  const breathY = 1 + 0.015 * o.breath;
  set("breath", "transform", tf(0, 0, 0, 1, breathY, RIG.body.x, RIG.body.y));
  set("body", "transform", partTf(v, "body", RIG.body));
  set("belly", "transform", partTf(v, "belly", RIG.belly));
  set("legs", "transform", partTf(v, "legs", RIG.legs));
  // Counter-scale the head slightly so breathing reads in the torso, not the face.
  set(
    "head",
    "transform",
    partTf(v, "head", RIG.head, { y: o.nod - o.bob, scaleY: 1 / breathY }),
  );
  set("scarf-knot", "transform", partTf(v, "scarfKnot", RIG.scarfKnot));
  set("scarf-tail", "transform", partTf(v, "scarfTail", RIG.scarfTail, { rotate: o.scarfSway }));
  set("brow-l", "transform", partTf(v, "browL", RIG.browL));
  set("brow-r", "transform", partTf(v, "browR", RIG.browR));

  for (const side of ["L", "R"] as const) {
    const rig = side === "L" ? RIG.armL : RIG.armR;
    const s = side.toLowerCase();
    const upper = v[`arm${side}.upper`];
    const fore = v[`arm${side}.fore`] + (side === "R" ? o.wave : o.gesture);
    set(
      `arm-${s}`,
      "transform",
      `translate(${r3(v[`arm${side}.liftX`])} ${r3(v[`arm${side}.liftY`])}) rotate(${r3(upper)} ${rig.shoulder.x} ${rig.shoulder.y})`,
    );
    set(`forearm-${s}`, "transform", `rotate(${r3(fore)} ${rig.elbow.x} ${rig.elbow.y})`);
    for (const shape of PAW_SHAPES) {
      set(`paw-${s}-${shape}`, "opacity", clamp01(v[`paw${side}.${shape}`]));
    }
  }

  // Eyes: gaze = pose look + tracked look, clamped to a ~7 unit radius.
  let lx = v.lookX + v.track * o.look.x * 6;
  let ly = v.lookY + v.track * o.look.y * 5;
  const len = Math.hypot(lx, ly);
  if (len > 7) {
    lx = (lx / len) * 7;
    ly = (ly / len) * 7;
  }
  const lid = clamp01(Math.max(v.lid, o.blink));
  const happy = clamp01(v.happy);
  for (const s of ["l", "r"] as const) {
    const eye = s === "l" ? RIG.eyeL : RIG.eyeR;
    set(`iris-${s}`, "transform", `translate(${r3(lx)} ${r3(ly)})`);
    // Lid drops from the top of the eye (ry = 19).
    set(`lid-${s}`, "transform", tf(0, 0, 0, 1, Math.max(lid, 0.001), eye.x, eye.y - 22));
    set(`lash-${s}`, "transform", `translate(0 ${r3(-(1 - lid) * 36)})`);
    set(`lash-${s}`, "opacity", clamp01((lid - 0.55) / 0.35));
    set(`eyeline-${s}`, "opacity", 1 - clamp01((lid - 0.4) / 0.5));
  }
  set("open-eyes", "opacity", 1 - happy);
  set("happy-eyes", "opacity", happy);

  for (const k of PROP_KINDS) {
    const op = clamp01(v[`prop.${k}.opacity`]);
    const pop = 0.82 + 0.18 * op;
    set(
      `prop-${k}`,
      "transform",
      `translate(${r3(v[`prop.${k}.x`])} ${r3(v[`prop.${k}.y`])}) rotate(${r3(v[`prop.${k}.rotate`])}) scale(${r3(v[`prop.${k}.scale`] * pop)})`,
    );
    set(`prop-${k}`, "opacity", op);
    set(`prop-${k}`, "visibility", op < 0.01 ? "hidden" : "visible");
  }

  set("water", "opacity", clamp01(v.water));
  set("water", "visibility", v.water < 0.01 ? "hidden" : "visible");
  set("shadow", "opacity", clamp01(v.shadow));

  const mouth = o.mouth ?? silentMouth;
  for (const m of MOUTH_SHAPES) set(`mouth-${m}`, "visibility", m === mouth ? "visible" : "hidden");

  return { attrs: a, mouth };
}

/* ------------------------------------------------------------------------ */
/* Static art                                                                */
/* ------------------------------------------------------------------------ */

type ArtProps = { uid: string; initial: Frame["attrs"] };

/** "x y" pivot annotation (documentation for devtools; transforms already use these). */
const pv = (p: { x: number; y: number }) => `${p.x} ${p.y}`;

const HEAD_PATH =
  "M200 64 C252 64 287 92 291 132 C293 146 297 157 301 168 Q309 175 303 181 Q309 189 300 195 C296 214 280 226 258 231 C239 235 220 237 200 237 C180 237 161 235 142 231 C120 226 104 214 100 195 Q91 189 97 181 Q91 175 99 168 C103 157 107 146 109 132 C113 92 148 64 200 64 Z";

const BODY_PATH =
  "M200 200 C160 200 136 222 130 258 C122 300 117 338 136 358 C156 376 244 376 264 358 C283 338 278 300 270 258 C264 222 240 200 200 200 Z";

const MASK_PATH =
  "M104 182 C106 164 126 160 146 168 C160 174 176 172 185 160 C191 151 209 151 215 160 C224 172 240 174 254 168 C274 160 294 164 296 182 C300 212 256 238 200 238 C144 238 100 212 104 182 Z";

const TAIL_PATH =
  "M190 368 C150 374 96 371 62 362 C38 355 28 336 36 318 C42 304 60 304 62 318 C63 330 80 337 108 336 C140 334 166 328 186 326 Z";

function Arm({ side, uid, initial }: { side: "l" | "r"; uid: string; initial: Frame["attrs"] }) {
  const rig = side === "l" ? RIG.armL : RIG.armR;
  const { shoulder: S, elbow: E, paw: P } = rig;
  const u = (id: string) => `url(#${uid}-${id})`;
  const out = side === "l" ? 1 : -1; // outward x direction
  return (
    <g data-part={`arm-${side}`} data-pivot={pv(S)} {...initial[`arm-${side}`]}>
      {/* upper arm: capsule shoulder → elbow, round cap centred on the pivot */}
      <rect
        x={S.x - 18.5}
        y={S.y - 18.5}
        width={37}
        height={E.y - S.y + 37}
        rx={18.5}
        fill={u("limb")}
      />
      <g data-part={`forearm-${side}`} data-pivot={pv(E)} {...initial[`forearm-${side}`]}>
        <path
          d={`M${E.x - 17} ${E.y} A17 17 0 0 1 ${E.x + 17} ${E.y} L${E.x + 16} ${P.y} L${E.x - 16} ${P.y} Z`}
          fill={u("limb")}
        />
        <g data-part={`paw-${side}`}>
        {/* paw: closed (default, holding) */}
        <g data-part={`paw-${side}-closed`} {...initial[`paw-${side}-closed`]}>
          <ellipse cx={P.x} cy={P.y + 3} rx={19.5} ry={17} fill={u("paw")} />
          <path
            d={`M${P.x - 8} ${P.y + 14} q1.5 3.5 0 6 M${P.x} ${P.y + 15.5} q1.5 3.5 0 6 M${P.x + 8} ${P.y + 14} q1.5 3.5 0 6`}
            stroke={C.furDeep}
            strokeOpacity={0.55}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
        </g>
        {/* paw: open, palm towards the viewer */}
        <g data-part={`paw-${side}-open`} {...initial[`paw-${side}-open`]}>
          <ellipse cx={P.x} cy={P.y + 5} rx={20} ry={19} fill={u("paw")} />
          <ellipse cx={P.x} cy={P.y + 6} rx={14} ry={13} fill={C.sole} />
          <ellipse cx={P.x} cy={P.y + 3} rx={7} ry={5.5} fill={C.pad} />
          <ellipse cx={P.x - 9} cy={P.y + 13} rx={3.3} ry={3.7} fill={C.pad} />
          <ellipse cx={P.x} cy={P.y + 16} rx={3.3} ry={3.7} fill={C.pad} />
          <ellipse cx={P.x + 9} cy={P.y + 13} rx={3.3} ry={3.7} fill={C.pad} />
        </g>
        {/* paw: pointing (one digit extended along the forearm) */}
        <g data-part={`paw-${side}-point`} {...initial[`paw-${side}-point`]}>
          <rect
            x={P.x - 5.5 + out * 2}
            y={P.y + 4}
            width={11}
            height={23}
            rx={5.5}
            fill="#93684C"
          />
          <ellipse cx={P.x} cy={P.y + 2} rx={19} ry={16} fill={u("paw")} />
          <path
            d={`M${P.x - 9} ${P.y + 10} q5 5 11 2`}
            stroke={C.furDeep}
            strokeOpacity={0.5}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
        </g>
        </g>
      </g>
    </g>
  );
}

function Foot({ x, y, rot, uid }: { x: number; y: number; rot: number; uid: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <ellipse cx={0} cy={0} rx={26} ry={17} fill={`url(#${uid}-paw)`} />
      <ellipse cx={0} cy={1.5} rx={19} ry={12} fill={C.sole} />
      <ellipse cx={0} cy={5} rx={8.5} ry={5.5} fill={C.pad} />
      <ellipse cx={-10} cy={-5} rx={3.6} ry={3.2} fill={C.pad} />
      <ellipse cx={-3.4} cy={-8} rx={3.6} ry={3.2} fill={C.pad} />
      <ellipse cx={3.4} cy={-8} rx={3.6} ry={3.2} fill={C.pad} />
      <ellipse cx={10} cy={-5} rx={3.6} ry={3.2} fill={C.pad} />
    </g>
  );
}

function Eye({ side, uid, initial }: { side: "l" | "r"; uid: string; initial: Frame["attrs"] }) {
  const e = side === "l" ? RIG.eyeL : RIG.eyeR;
  const clip = `${uid}-eyeclip-${side}`;
  // Highlights sit up-right on both eyes (one light source).
  return (
    <g data-part={`eye-${side}`}>
      <clipPath id={clip}>
        <ellipse cx={e.x} cy={e.y} rx={17} ry={19} />
      </clipPath>
      {/* the lid clip is a touch larger so a closed lid fully covers the eye-white edge */}
      <clipPath id={`${clip}-lid`}>
        <ellipse cx={e.x} cy={e.y} rx={18.6} ry={20.6} />
      </clipPath>
      <ellipse cx={e.x} cy={e.y} rx={17} ry={19} fill="#FFFBF4" />
      <g clipPath={`url(#${clip})`}>
        <g data-part={`iris-${side}`} {...initial[`iris-${side}`]}>
          <circle cx={e.x} cy={e.y + 1} r={16} fill={`url(#${uid}-iris)`} />
          <circle data-part={`pupil-${side}`} cx={e.x} cy={e.y + 1.5} r={8.4} fill={C.ink} />
          <g data-part={`highlight-${side}`}>
            <circle cx={e.x + 5.5} cy={e.y - 5.5} r={6} fill="#FFFFFF" />
            <circle cx={e.x - 5.5} cy={e.y + 7.5} r={2.4} fill="#FFFFFF" fillOpacity={0.85} />
          </g>
        </g>
        {/* soft upper-lid shadow on the eyeball */}
        <ellipse cx={e.x} cy={e.y - 20} rx={20} ry={9} fill={C.furDeep} fillOpacity={0.18} />
      </g>
      <g clipPath={`url(#${clip}-lid)`}>
        <g data-part={`lid-${side}`} data-pivot={`${e.x} ${e.y - 20}`} {...initial[`lid-${side}`]}>
          <path
            d={`M${e.x - 22} ${e.y - 22} H${e.x + 22} V${e.y + 15} Q${e.x} ${e.y + 25} ${e.x - 22} ${e.y + 15} Z`}
            fill={`url(#${uid}-head)`}
          />
        </g>
      </g>
      <ellipse
        data-part={`eyeline-${side}`}
        {...initial[`eyeline-${side}`]}
        cx={e.x}
        cy={e.y}
        rx={17}
        ry={19}
        fill="none"
        stroke={C.furDeep}
        strokeOpacity={0.35}
        strokeWidth={1.2}
      />
      {/* closed-eye lash line rides on the lid edge */}
      <g data-part={`lash-${side}`} {...initial[`lash-${side}`]}>
        <path
          d={`M${e.x - 15} ${e.y + 13} Q${e.x} ${e.y + 21} ${e.x + 15} ${e.y + 13}`}
          stroke={C.ink}
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </g>
  );
}

const NamiArt = memo(function NamiArt({ uid, initial }: ArtProps) {
  const u = (id: string) => `url(#${uid}-${id})`;
  const at = (part: string) => initial[part];
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-fur`} cx="0.42" cy="0.32" r="0.78">
          <stop offset="0" stopColor={C.furHi} />
          <stop offset="0.55" stopColor={C.fur} />
          <stop offset="1" stopColor={C.furDark} />
        </radialGradient>
        <radialGradient id={`${uid}-head`} gradientUnits="userSpaceOnUse" cx="190" cy="110" r="150">
          <stop offset="0" stopColor="#B4876A" />
          <stop offset="0.5" stopColor="#966A4E" />
          <stop offset="1" stopColor={C.furDark} />
        </radialGradient>
        <linearGradient id={`${uid}-limb`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6E4834" />
          <stop offset="0.35" stopColor="#93684C" />
          <stop offset="0.75" stopColor="#875E44" />
          <stop offset="1" stopColor="#6A4532" />
        </linearGradient>
        <radialGradient id={`${uid}-paw`} cx="0.45" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#9C7054" />
          <stop offset="1" stopColor={C.furDark} />
        </radialGradient>
        <linearGradient id={`${uid}-tail`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9A6D51" />
          <stop offset="0.6" stopColor={C.fur} />
          <stop offset="1" stopColor={C.furDeep} />
        </linearGradient>
        <radialGradient id={`${uid}-haunch`} cx="0.5" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#9C6F53" />
          <stop offset="1" stopColor={C.furDark} />
        </radialGradient>
        <radialGradient id={`${uid}-belly`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor={C.creamHi} />
          <stop offset="0.7" stopColor={C.cream} />
          <stop offset="0.92" stopColor={C.creamDark} />
          <stop offset="1" stopColor={C.creamDark} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-mask`} cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor={C.creamHi} />
          <stop offset="0.75" stopColor={C.cream} />
          <stop offset="1" stopColor={C.creamDark} />
        </radialGradient>
        <radialGradient id={`${uid}-iris`} cx="0.5" cy="0.78" r="0.75">
          <stop offset="0" stopColor="#A86B3C" />
          <stop offset="0.45" stopColor="#5A341F" />
          <stop offset="1" stopColor="#24150E" />
        </radialGradient>
        <radialGradient id={`${uid}-nose`} cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#6B4535" />
          <stop offset="1" stopColor={C.nose} />
        </radialGradient>
        <linearGradient id={`${uid}-scarf`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.scarfHi} />
          <stop offset="0.55" stopColor={C.scarf} />
          <stop offset="1" stopColor={C.scarfDark} />
        </linearGradient>
        <linearGradient id={`${uid}-scarfTail`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.scarfDark} />
          <stop offset="0.45" stopColor={C.scarfHi} />
          <stop offset="1" stopColor={C.scarfDark} />
        </linearGradient>
        <linearGradient id={`${uid}-rim`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0.45" stopColor="#FFE3C6" stopOpacity="0" />
          <stop offset="1" stopColor="#FFE3C6" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#1E2422" stopOpacity="0.22" />
          <stop offset="1" stopColor="#1E2422" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A9D3C9" stopOpacity="0.82" />
          <stop offset="0.35" stopColor="#86BAAE" stopOpacity="0.95" />
          <stop offset="1" stopColor="#5F988B" stopOpacity="1" />
        </linearGradient>
        <pattern id={`${uid}-knit`} width="7" height="6" patternUnits="userSpaceOnUse">
          <path
            d="M0.5 0.5 L3.5 4.5 L6.5 0.5"
            stroke={C.scarfDeep}
            strokeOpacity="0.28"
            strokeWidth="1.1"
            fill="none"
            strokeLinecap="round"
          />
        </pattern>
        <clipPath id={`${uid}-headclip`}>
          <path d={HEAD_PATH} />
        </clipPath>
        <clipPath id={`${uid}-bodyclip`}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>

      {/* ground shadow (not part of the character, fades out when floating) */}
      <ellipse
        data-part="shadow"
        {...at("shadow")}
        cx={190}
        cy={369}
        rx={150}
        ry={14}
        fill={u("shadow")}
      />

      <g data-part="root" {...at("root")} data-pivot={pv(RIG.root)}>
        {/* ---------------- tail (behind everything) ---------------- */}
        <g data-part="tail" {...at("tail")} data-pivot={pv(RIG.tail)}>
          <path d={TAIL_PATH} fill={u("tail")} />
          <path
            d="M176 333 C148 336 116 344 86 343"
            stroke="#B08566"
            strokeOpacity="0.45"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        <g data-part="breath" {...at("breath")}>
          <g data-part="body" {...at("body")} data-pivot={pv(RIG.body)}>
            {/* ---------------- torso ---------------- */}
            <path d={BODY_PATH} fill={u("fur")} />
            <g data-part="belly" {...at("belly")} data-pivot={pv(RIG.belly)}>
              <ellipse cx={200} cy={302} rx={56} ry={68} fill={u("belly")} />
            </g>
            <g clipPath={`url(#${uid}-bodyclip)`}>
              {/* soft occlusion under the scarf */}
              <ellipse cx={200} cy={256} rx={78} ry={16} fill={C.furDeep} fillOpacity={0.22} />
              <path d={BODY_PATH} fill="none" stroke={u("rim")} strokeWidth={5} />
            </g>

            {/* ---------------- legs ---------------- */}
            <g data-part="legs" {...at("legs")} data-pivot={pv(RIG.legs)}>
              <ellipse cx={144} cy={338} rx={34} ry={30} fill={u("haunch")} />
              <ellipse cx={256} cy={338} rx={34} ry={30} fill={u("haunch")} />
              <Foot x={150} y={359} rot={-14} uid={uid} />
              <Foot x={250} y={359} rot={14} uid={uid} />
            </g>

            {/* ---------------- scarf band (neck) ---------------- */}
            <g data-part="scarf-band">
              <path
                d="M126 220 C156 244 244 244 274 220 C286 228 290 244 281 258 C250 281 150 281 119 258 C110 244 114 228 126 220 Z"
                fill={u("scarf")}
              />
              <path
                d="M126 220 C156 244 244 244 274 220 C286 228 290 244 281 258 C250 281 150 281 119 258 C110 244 114 228 126 220 Z"
                fill={u("knit")}
              />
              <path
                d="M120 250 C154 273 246 273 280 250"
                stroke={C.scarfDeep}
                strokeOpacity="0.35"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </g>

            {/* ---------------- head ---------------- */}
            <g data-part="head" {...at("head")} data-pivot={pv(RIG.head)}>
              <g data-part="ear-r">
                <circle cx={117} cy={104} r={19} fill={u("paw")} />
                <circle cx={119} cy={106} r={10.5} fill={C.furDeep} fillOpacity={0.8} />
              </g>
              <g data-part="ear-l">
                <circle cx={283} cy={104} r={19} fill={u("paw")} />
                <circle cx={281} cy={106} r={10.5} fill={C.furDeep} fillOpacity={0.8} />
              </g>
              <path d={HEAD_PATH} fill={u("head")} />
              <g clipPath={`url(#${uid}-headclip)`}>
                <path data-part="muzzle" d={MASK_PATH} fill={u("mask")} />
                <ellipse cx={136} cy={196} rx={14} ry={8} fill="#E8987F" fillOpacity={0.3} />
                <ellipse cx={264} cy={196} rx={14} ry={8} fill="#E8987F" fillOpacity={0.3} />
                <path d={HEAD_PATH} fill="none" stroke={u("rim")} strokeWidth={5} />
              </g>

              <g data-part="open-eyes" {...at("open-eyes")}>
                <Eye side="r" uid={uid} initial={initial} />
                <Eye side="l" uid={uid} initial={initial} />
              </g>
              <g data-part="happy-eyes" {...at("happy-eyes")}>
                {[RIG.eyeR, RIG.eyeL].map((e) => (
                  <path
                    key={e.x}
                    d={`M${e.x - 13} ${e.y + 5} Q${e.x} ${e.y - 13} ${e.x + 13} ${e.y + 5}`}
                    stroke={C.ink}
                    strokeWidth={4.4}
                    strokeLinecap="round"
                    fill="none"
                  />
                ))}
              </g>

              <g data-part="brow-r" {...at("brow-r")} data-pivot={pv(RIG.browR)}>
                <path
                  d={`M${RIG.browR.x - 11} ${RIG.browR.y + 3} Q${RIG.browR.x} ${RIG.browR.y - 4} ${RIG.browR.x + 11} ${RIG.browR.y + 1}`}
                  stroke={C.brow}
                  strokeWidth={5}
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g data-part="brow-l" {...at("brow-l")} data-pivot={pv(RIG.browL)}>
                <path
                  d={`M${RIG.browL.x - 11} ${RIG.browL.y + 1} Q${RIG.browL.x} ${RIG.browL.y - 4} ${RIG.browL.x + 11} ${RIG.browL.y + 3}`}
                  stroke={C.brow}
                  strokeWidth={5}
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* whisker pads */}
              <ellipse cx={186} cy={194} rx={18} ry={13} fill="#FFF8EE" />
              <ellipse cx={214} cy={194} rx={18} ry={13} fill="#FFF8EE" />
              <g fill={C.furDark} fillOpacity={0.35}>
                <circle cx={180} cy={192} r={1.3} />
                <circle cx={186} cy={197} r={1.3} />
                <circle cx={178} cy={199} r={1.3} />
                <circle cx={220} cy={192} r={1.3} />
                <circle cx={214} cy={197} r={1.3} />
                <circle cx={222} cy={199} r={1.3} />
              </g>

              <g data-part="mouth">
                <g data-part="mouth-closed-smile" {...at("mouth-closed-smile")}>
                  <path
                    d="M200 186 V194 M186 192 Q193 201 200 194 Q207 201 214 192"
                    stroke={C.nose}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </g>
                <g data-part="mouth-small" {...at("mouth-small")}>
                  <path d="M200 186 V192" stroke={C.nose} strokeWidth={2.4} strokeLinecap="round" />
                  <path d="M189 192 Q200 189 211 192 Q209 205 200 206 Q191 205 189 192 Z" fill={C.mouth} />
                  <path d="M194 202.5 Q200 199 206 202.5 Q203 206 200 206 Q197 206 194 202.5 Z" fill={C.tongue} />
                </g>
                <g data-part="mouth-wide" {...at("mouth-wide")}>
                  <path d="M200 186 V192" stroke={C.nose} strokeWidth={2.4} strokeLinecap="round" />
                  <path d="M181 191 Q200 186 219 191 Q216 220 200 221 Q184 220 181 191 Z" fill={C.mouth} />
                  <path d="M188 214 Q200 205 212 214 Q207 221 200 221 Q193 221 188 214 Z" fill={C.tongue} />
                </g>
                <g data-part="mouth-round" {...at("mouth-round")}>
                  <path d="M200 186 V191" stroke={C.nose} strokeWidth={2.4} strokeLinecap="round" />
                  <ellipse cx={200} cy={204} rx={10} ry={13} fill={C.mouth} />
                  <ellipse cx={200} cy={211.5} rx={6} ry={4} fill={C.tongue} />
                </g>
                <g data-part="mouth-soft-o" {...at("mouth-soft-o")}>
                  <path d="M200 186 V192" stroke={C.nose} strokeWidth={2.4} strokeLinecap="round" />
                  <ellipse cx={200} cy={199.5} rx={6} ry={6.6} fill={C.mouth} />
                </g>
              </g>

              <g data-part="nose">
                <path
                  d="M184 174 C184 165 216 165 216 174 C216 183 206 189 200 189 C194 189 184 183 184 174 Z"
                  fill={u("nose")}
                />
                <ellipse cx={193} cy={171.5} rx={5} ry={2.6} fill="#FFFFFF" fillOpacity={0.45} />
              </g>

              <g
                data-part="whiskers"
                stroke="#5A3D2C"
                strokeOpacity={0.32}
                strokeWidth={1.3}
                strokeLinecap="round"
                fill="none"
              >
                <path d="M172 191 Q146 185 112 186" />
                <path d="M173 199 Q146 203 116 212" />
                <path d="M228 191 Q254 185 288 186" />
                <path d="M227 199 Q254 203 284 212" />
              </g>
            </g>
            {/* ---------------- prop slot ---------------- */}
            <g data-part="prop">
              <g data-part="prop-clock-card" {...at("prop-clock-card")}>
                <rect x={-50} y={-38} width={100} height={76} rx={12} fill={C.ivory} stroke={C.line} strokeWidth={2.5} />
                <rect x={-50} y={-38} width={100} height={18} rx={12} fill={C.scarf} fillOpacity={0.35} />
                <circle cx={-30} cy={-12} r={11} fill="#FFFFFF" stroke={C.teal} strokeWidth={2.6} />
                <path d="M-30 -18 V-12 L-25.5 -9" stroke={C.teal} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <rect x={-14} y={-17} width={50} height={8} rx={4} fill={C.line} fillOpacity={0.6} />
                <rect x={-38} y={4} width={76} height={24} rx={7} fill="#F3EEE2" />
              </g>
              <g data-part="prop-notebook" {...at("prop-notebook")}>
                <rect x={-23} y={-29} width={50} height={62} rx={5} fill="#EFE7D6" />
                <rect x={-27} y={-31} width={52} height={64} rx={6} fill="#4F8277" />
                <rect x={-27} y={-31} width={52} height={10} rx={5} fill="#3F6C62" />
                <rect x={14} y={-31} width={5} height={64} fill="#E9C46A" fillOpacity={0.9} />
                <rect x={-15} y={-12} width={26} height={15} rx={3} fill={C.ivory} fillOpacity={0.9} />
                <g fill="none" stroke="#C9C2B3" strokeWidth={2.4} strokeLinecap="round">
                  <path d="M-18 -35 v7 M-8 -35 v7 M2 -35 v7 M12 -35 v7" />
                </g>
              </g>
              <g data-part="prop-phone" {...at("prop-phone")}>
                <rect x={-12.5} y={-25} width={25} height={50} rx={7} fill="#1E2422" />
                <rect x={-9.5} y={-19} width={19} height={36} rx={3.5} fill="#3D7068" />
                <rect x={-4} y={-22.5} width={8} height={1.8} rx={0.9} fill="#8FA39E" />
                <path d="M-6 -15 L4 -15" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
              </g>
              <g data-part="prop-heart" {...at("prop-heart")}>
                <path
                  d="M0 18 C-26 2 -24 -20 -10 -20 C-4 -20 0 -15 0 -11 C0 -15 4 -20 10 -20 C24 -20 26 2 0 18 Z"
                  fill="#E08A7D"
                />
                <ellipse cx={-10} cy={-10} rx={5} ry={3.4} fill="#FFFFFF" fillOpacity={0.45} transform="rotate(-30 -10 -10)" />
              </g>
              <g data-part="prop-sign" {...at("prop-sign")}>
                <rect x={-62} y={-42} width={124} height={84} rx={14} fill={C.ivory} stroke={C.teal} strokeWidth={4} />
                <rect x={-52} y={-32} width={104} height={64} rx={8} fill="#F3EEE2" />
              </g>
            </g>

            {/* ---------------- arms (in front of the scarf and props) ---------------- */}
            <Arm side="r" uid={uid} initial={initial} />

            {/* ---------------- scarf knot + hanging end (her right side) ---------------- */}
            <g data-part="scarf-tail" {...at("scarf-tail")} data-pivot={pv(RIG.scarfTail)}>
              <path
                d="M140 268 C130 290 118 314 108 340 L141 351 C146 323 154 297 162 272 Z"
                fill={u("scarfTail")}
              />
              <path
                d="M140 268 C130 290 118 314 108 340 L141 351 C146 323 154 297 162 272 Z"
                fill={u("knit")}
              />
              <path
                d="M147 274 C139 298 129 320 119 344 M155 275 C148 299 141 322 131 347"
                stroke={C.scarfDeep}
                strokeOpacity="0.3"
                strokeWidth="1.6"
                fill="none"
              />
              <g stroke={C.scarfDark} strokeWidth="4" strokeLinecap="round">
                <path d="M111 343 l-1.5 10" />
                <path d="M118 345.5 l-1 10" />
                <path d="M125 347.5 l-0.5 10" />
                <path d="M132 349.5 l0 10" />
                <path d="M139 351.5 l0.5 9" />
              </g>
            </g>
            <g data-part="scarf-knot" {...at("scarf-knot")} data-pivot={pv(RIG.scarfKnot)}>
              <ellipse cx={150} cy={263} rx={19} ry={16} transform="rotate(-18 150 263)" fill={u("scarf")} />
              <ellipse cx={150} cy={263} rx={19} ry={16} transform="rotate(-18 150 263)" fill={u("knit")} />
              <path
                d="M137 258 Q150 269 164 258 M141 271 Q151 275 161 269"
                stroke={C.scarfDeep}
                strokeOpacity="0.45"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            </g>
            <Arm side="l" uid={uid} initial={initial} />
          </g>
        </g>
      </g>

      {/* water band for the swim pose (in front of the character) */}
      <g data-part="water" {...at("water")}>
        <path
          d="M0 296 Q25 286 50 296 T100 296 T150 296 T200 296 T250 296 T300 296 T350 296 T400 296 V400 H0 Z"
          fill={u("water")}
        />
        <path
          d="M0 296 Q25 286 50 296 T100 296 T150 296 T200 296 T250 296 T300 296 T350 296 T400 296"
          stroke="#E4F3EE"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M30 326 q14 -6 28 0 M140 348 q14 -6 28 0 M262 330 q14 -6 28 0 M330 362 q12 -5 24 0 M80 372 q12 -5 24 0"
          stroke="#E4F3EE"
          strokeOpacity="0.7"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </>
  );
});

/* ------------------------------------------------------------------------ */
/* Runtime                                                                   */
/* ------------------------------------------------------------------------ */

const SPRING = { type: "spring" as const, visualDuration: 0.25, bounce: 0.12 };
const FADE = { duration: 0.16, ease: "easeOut" as const };

export function NamiSvg({
  pose = "idle",
  mouth = 0,
  lookAt = null,
  blink = "auto",
  reducedMotion = false,
  className,
  style,
  title,
}: NamiSvgProps) {
  const rawId = useId();
  const uid = `nami${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);

  // Initial frame is computed once so server HTML already shows the right pose.
  const [init] = useState(() => {
    const p = getPose(pose);
    const values = allChannelDefaults(p);
    return { values, frame: computeFrame(values, NO_OVERLAY, p.mouth) };
  });

  // Motion values for every channel (created once).
  const [mv] = useState(() => {
    const m: Record<string, MotionValue<number>> = {};
    for (const [k, val] of Object.entries(init.values)) m[k] = motionValue(val);
    return m;
  });

  // Mutable runtime state shared by the loop (never read during render).
  const rt = useRef({
    pose: getPose(pose),
    poseName: pose,
    reduced: reducedMotion,
    blinkEnabled: blink !== "auto" ? false : true,
    mouthLevel: 0,
    blinkAt: -1,
    double: false,
    nodAt: -1,
    lookX: motionValue(0),
    lookY: motionValue(0),
    raf: 0,
    pending: false,
    running: false,
    t0: 0,
    els: new Map<string, Element>(),
    render: (() => {}) as (now?: number) => void,
    schedule: () => {},
  });

  /* ---- collect parts + the render function ---- */
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = rt.current;
    r.els.clear();
    svg.querySelectorAll("[data-part]").forEach((el) => {
      r.els.set(el.getAttribute("data-part")!, el);
    });
    r.t0 = performance.now();

    r.render = (now = performance.now()) => {
      const t = (now - r.t0) / 1000;
      const v: Values = {};
      for (const k in mv) v[k] = mv[k].get();
      const live = !r.reduced;
      const tau = Math.PI * 2;

      // Blink: lids visible for ~120 ms (close 45, hold 30, open 45).
      let blinkLid = 0;
      if (live && r.blinkAt >= 0) {
        const dt = now - r.blinkAt;
        const one = (d: number) =>
          d < 0 ? 0 : d < 45 ? d / 45 : d < 75 ? 1 : d < 120 ? 1 - (d - 75) / 45 : 0;
        blinkLid = Math.max(one(dt), r.double ? one(dt - 190) : 0);
        if (dt > (r.double ? 320 : 130)) r.blinkAt = -1;
      }

      // Nod: two soft dips over 900 ms.
      let nod = 0;
      if (live && r.nodAt >= 0) {
        const p = (now - r.nodAt) / 900;
        if (p >= 1) r.nodAt = -1;
        else nod = 6 * Math.abs(Math.sin(p * tau)) * (1 - p * 0.4);
      }

      const level = r.mouthLevel;
      const alt = live && Math.floor(now / 140) % 2 === 1;
      const mouthShape = level >= 0.08 ? mouthForLevel(level, r.pose.mouth, alt) : null;

      const o: Overlay = live
        ? {
            breath: 0.5 - 0.5 * Math.cos((t / 5) * tau),
            tailSway: 4 * Math.sin((t / 6) * tau),
            scarfSway: 3 * Math.sin((t / 4.2) * tau + 1.3),
            wave: v.wave * 16 * Math.sin(t * tau * 1.7),
            gesture: v.gesture * (6 * Math.sin((t / 2.6) * tau) + 4 * level),
            nod,
            bob: v.bob * level * 1.6,
            blink: r.blinkEnabled ? blinkLid : 0,
            look: { x: r.lookX.get(), y: r.lookY.get() },
            mouth: mouthShape,
          }
        : { ...NO_OVERLAY, mouth: mouthShape };

      const frame = computeFrame(v, o, r.pose.mouth);
      for (const part in frame.attrs) {
        const el = r.els.get(part);
        if (!el) continue;
        const attrs = frame.attrs[part];
        for (const name in attrs) {
          if (el.getAttribute(name) !== attrs[name]) el.setAttribute(name, attrs[name]);
        }
      }
    };

    r.schedule = () => {
      if (r.running || r.pending) return;
      r.pending = true;
      r.raf = requestAnimationFrame((now) => {
        r.pending = false;
        r.render(now);
      });
    };

    r.render();
    const unsubs = [...Object.values(mv), r.lookX, r.lookY].map((m) =>
      m.on("change", () => r.schedule()),
    );
    return () => {
      unsubs.forEach((u) => u());
      cancelAnimationFrame(r.raf);
      r.pending = false;
    };
  }, [mv]);

  /* ---- continuous loop (idle life), paused when hidden or reduced ---- */
  useEffect(() => {
    const r = rt.current;
    r.reduced = reducedMotion;
    let blinkTimer: ReturnType<typeof setTimeout> | undefined;

    const stopLoop = () => {
      r.running = false;
      cancelAnimationFrame(r.raf);
      r.pending = false;
      clearTimeout(blinkTimer);
    };
    const scheduleBlink = () => {
      clearTimeout(blinkTimer);
      blinkTimer = setTimeout(
        () => {
          r.blinkAt = performance.now();
          r.double = Math.random() < 0.18;
          scheduleBlink();
        },
        3000 + Math.random() * 4000,
      );
    };
    const startLoop = () => {
      if (r.running || reducedMotion || document.hidden) return;
      r.running = true;
      let lastPaint = 0;
      const tick = (now: number) => {
        if (!r.running) return;
        // Idle life (breathing, sway) is slow: ~30 fps is plenty and halves idle CPU.
        // Springs, blinks, nods, waves, gestures, gaze and speech get every frame.
        const busy =
          r.blinkAt >= 0 ||
          r.nodAt >= 0 ||
          r.mouthLevel > 0 ||
          r.lookX.isAnimating() ||
          r.lookY.isAnimating() ||
          mv.wave.get() > 0 ||
          mv.gesture.get() > 0 ||
          Object.values(mv).some((m) => m.isAnimating());
        if (busy || now - lastPaint >= 32) {
          lastPaint = now;
          r.render(now);
        }
        r.raf = requestAnimationFrame(tick);
      };
      r.raf = requestAnimationFrame(tick);
      scheduleBlink();
    };
    const onVis = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };

    if (reducedMotion) {
      // Settle every channel instantly onto the pose and paint once.
      stopLoop();
      r.lookX.jump(0);
      r.lookY.jump(0);
      r.render();
    } else {
      startLoop();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stopLoop();
    };
  }, [reducedMotion, mv]);

  /* ---- pose changes: spring every channel ---- */
  useEffect(() => {
    const r = rt.current;
    const prevName = r.poseName;
    const p = getPose(pose);
    r.pose = p;
    r.poseName = pose;
    const target = poseValues(p);
    const instant = reducedMotion;

    // A prop that appears jumps to its spot, then fades/pops in.
    if (p.prop) {
      const k = p.prop.kind;
      if (mv[`prop.${k}.opacity`].get() < 0.05) {
        for (const c of ["x", "y", "rotate", "scale"]) mv[`prop.${k}.${c}`].jump(target[`prop.${k}.${c}`]);
      }
    }
    for (const [k, val] of Object.entries(target)) {
      const m = mv[k];
      if (!m) continue;
      if (instant) {
        m.jump(val);
        continue;
      }
      const isFade =
        k.endsWith(".opacity") ||
        k.startsWith("paw") ||
        k === "happy" ||
        k === "water" ||
        k === "shadow";
      animate(m, val, isFade ? FADE : SPRING);
    }
    if (pose === "acknowledged" && prevName !== "acknowledged") r.nodAt = performance.now();
    r.render();
  }, [pose, reducedMotion, mv]);

  /* ---- blink prop ---- */
  useEffect(() => {
    rt.current.blinkEnabled = blink === "auto";
  }, [blink]);

  /* ---- mouth (number or MotionValue) ---- */
  useEffect(() => {
    const r = rt.current;
    if (isMotionValue(mouth)) {
      const mvMouth = mouth as MotionValue<number>;
      r.mouthLevel = mvMouth.get();
      r.schedule();
      return mvMouth.on("change", (val) => {
        r.mouthLevel = val;
        r.schedule();
      });
    }
    r.mouthLevel = typeof mouth === "number" && Number.isFinite(mouth) ? mouth : 0;
    r.schedule();
  }, [mouth]);

  /* ---- gaze ---- */
  const lx = lookAt ? Math.max(-1, Math.min(1, lookAt.x)) : 0;
  const ly = lookAt ? Math.max(-1, Math.min(1, lookAt.y)) : 0;
  useEffect(() => {
    const r = rt.current;
    if (reducedMotion) {
      r.lookX.jump(0);
      r.lookY.jump(0);
      return;
    }
    const opts = { type: "spring" as const, stiffness: 140, damping: 20 };
    animate(r.lookX, lx, opts);
    animate(r.lookY, ly, opts);
  }, [lx, ly, reducedMotion]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 400 400"
      className={className}
      style={{ display: "block", overflow: "hidden", ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-pose={pose}
    >
      {title ? <title>{title}</title> : null}
      <NamiArt uid={uid} initial={init.frame.attrs} />
    </svg>
  );
}

export default NamiSvg;

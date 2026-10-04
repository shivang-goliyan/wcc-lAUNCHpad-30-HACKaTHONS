/**
 * Nami pose tables (docs/DESIGN.md §4).
 *
 * Poses are data, not separate art: each pose is a table of part transforms
 * that `components/nami/NamiSvg.tsx` spring-animates between.
 *
 * Coordinate system: the 400×400 viewBox of NamiSvg, feet baseline at y = 370.
 * Left/right in part names are the CHARACTER's own left/right (stage
 * convention): `armR`, `brow-r`, `eye-r` and the scarf tail are drawn on the
 * viewer's LEFT; `armL`, `brow-l`, `eye-l` on the viewer's RIGHT.
 * Pose names that mention a direction (`point-left`, `point-right`) refer to
 * the SCREEN direction, because that is what page layouts care about.
 *
 * Rotations are in degrees, clockwise-positive (SVG convention). Arm angles
 * are measured from the rest pose (arm hanging straight down).
 */

/** Poses the SVG rig can draw. */
export type RigPose =
  | "idle"
  | "greeting"
  | "listening"
  | "thinking"
  | "speaking"
  | "reminder"
  | "acknowledged"
  | "calling"
  | "help"
  | "quiet"
  | "swim"
  | "peek"
  | "point-left"
  | "point-right";

/** Painted-only poses; the SVG rig shows idle for these. */
export type PoseName = RigPose | "stand" | "walk" | "walk-left" | "celebrate" | "hop" | "heart";

export const POSE_NAMES: readonly PoseName[] = [
  "idle",
  "greeting",
  "listening",
  "thinking",
  "speaking",
  "reminder",
  "acknowledged",
  "calling",
  "help",
  "quiet",
  "swim",
  "peek",
  "point-left",
  "point-right",
  "stand",
  "walk",
  "walk-left",
  "celebrate",
  "hop",
  "heart",
];

export type MouthShape = "closed-smile" | "small" | "wide" | "round" | "soft-o";
export const MOUTH_SHAPES: readonly MouthShape[] = [
  "closed-smile",
  "small",
  "wide",
  "round",
  "soft-o",
];

export type PropKind = "phone" | "clock-card" | "notebook" | "heart" | "sign";
export const PROP_KINDS: readonly PropKind[] = [
  "phone",
  "clock-card",
  "notebook",
  "heart",
  "sign",
];

export type PawShape = "closed" | "open" | "point";
export const PAW_SHAPES: readonly PawShape[] = ["closed", "open", "point"];

export type Pt = { x: number; y: number };

/** A 2D part transform applied about the part's pivot. */
export type Xform = {
  x: number;
  y: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
};

export type ArmPose = {
  /** Shoulder shrug: translation of the whole arm (e.g. lifting a paw to the ear). */
  lift: Pt;
  /** Upper arm rotation about the shoulder, from hanging straight down. */
  upper: number;
  /** Forearm rotation about the elbow, relative to the upper arm. */
  fore: number;
  paw: PawShape;
};

export type PropPose = {
  kind: PropKind;
  /** Centre of the prop in body coordinates. */
  x: number;
  y: number;
  rotate: number;
  scale: number;
};

export type EyePose = {
  /** 0 = fully open, 1 = fully closed (lids down). */
  lid: number;
  /** Pose-defined gaze offset in viewBox units (pupils move up to ~6). */
  look: Pt;
  /** "happy" swaps the eyes for ^ ^ arcs. */
  style: "open" | "happy";
  /** 0..1 how much the external `lookAt` prop is allowed to steer the gaze. */
  track: number;
};

export type Pose = {
  root: Xform;
  body: Xform;
  belly: Xform;
  legs: Xform;
  tail: Xform;
  head: Xform;
  scarfKnot: Xform;
  scarfTail: Xform;
  browL: Xform;
  browR: Xform;
  armL: ArmPose;
  armR: ArmPose;
  eyes: EyePose;
  /** Mouth shape used while Nami is silent (mouth envelope < 0.08). */
  mouth: MouthShape;
  prop: PropPose | null;
  /** Show the water band (swim). */
  water: boolean;
  /** Ground shadow opacity multiplier. */
  shadow: number;
  /** Procedural overlays that run on top of the pose (unless reduced motion). */
  motion: {
    wave?: boolean;
    nod?: boolean;
    gesture?: boolean;
    bob?: boolean;
  };
};

/* ------------------------------------------------------------------------ */
/* Rig geometry (shared with NamiSvg so pivots and IK always agree).         */
/* ------------------------------------------------------------------------ */

export const RIG = {
  baseline: 370,
  /** Pivot of the whole character (pose `root`). */
  root: { x: 200, y: 300 },
  /** Body pivot: bottom centre, so leaning keeps the seat planted. */
  body: { x: 200, y: 370 },
  belly: { x: 200, y: 300 },
  legs: { x: 200, y: 352 },
  tail: { x: 176, y: 350 },
  /** Head pivot: the neck, hidden under the scarf. */
  head: { x: 200, y: 226 },
  scarfKnot: { x: 150, y: 262 },
  scarfTail: { x: 146, y: 266 },
  browL: { x: 242, y: 116 },
  browR: { x: 158, y: 116 },
  eyeL: { x: 240, y: 146 },
  eyeR: { x: 160, y: 146 },
  armR: {
    shoulder: { x: 142, y: 260 },
    elbow: { x: 142, y: 294 },
    paw: { x: 142, y: 326 },
  },
  armL: {
    shoulder: { x: 258, y: 260 },
    elbow: { x: 258, y: 294 },
    paw: { x: 258, y: 326 },
  },
} as const;

const UPPER_LEN = RIG.armR.elbow.y - RIG.armR.shoulder.y; // 34
const FORE_LEN = RIG.armR.paw.y - RIG.armR.elbow.y; // 32

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

export const X0: Xform = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };

export function xf(p: Partial<Xform> & { scale?: number } = {}): Xform {
  const { scale, ...rest } = p;
  return {
    ...X0,
    ...(scale !== undefined ? { scaleX: scale, scaleY: scale } : null),
    ...rest,
  };
}

const deg = (rad: number) => (rad * 180) / Math.PI;
const norm = (a: number) => {
  let v = ((a + 180) % 360 + 360) % 360 - 180;
  if (v === -180) v = 180;
  return v;
};

/**
 * Two-bone IK: returns the arm angles that put the paw centre on `target`
 * (body coordinates). `bend` picks which of the two elbow solutions to use.
 */
export function reach(
  side: "l" | "r",
  target: Pt,
  bend: "out" | "in" | "up" | "down" = "out",
  paw: PawShape = "closed",
  lift: Pt = { x: 0, y: 0 },
): ArmPose {
  const base = side === "l" ? RIG.armL.shoulder : RIG.armR.shoulder;
  const s = { x: base.x + lift.x, y: base.y + lift.y };
  const dx = target.x - s.x;
  const dy = target.y - s.y;
  const raw = Math.hypot(dx, dy);
  const d = Math.min(
    Math.max(raw, Math.abs(UPPER_LEN - FORE_LEN) + 1),
    UPPER_LEN + FORE_LEN - 0.01,
  );
  const a = Math.atan2(dy, dx);
  const cosAlpha =
    (UPPER_LEN * UPPER_LEN + d * d - FORE_LEN * FORE_LEN) / (2 * UPPER_LEN * d);
  const alpha = Math.acos(Math.min(1, Math.max(-1, cosAlpha)));
  const candidates = [a + alpha, a - alpha].map((dir) => ({
    dir,
    ex: s.x + UPPER_LEN * Math.cos(dir),
    ey: s.y + UPPER_LEN * Math.sin(dir),
  }));
  const outward = side === "l" ? 1 : -1;
  const score = (c: { ex: number; ey: number }) => {
    switch (bend) {
      case "out":
        return (c.ex - s.x) * outward;
      case "in":
        return -(c.ex - s.x) * outward;
      case "down":
        return c.ey;
      case "up":
        return -c.ey;
    }
  };
  const best = score(candidates[0]) >= score(candidates[1]) ? candidates[0] : candidates[1];
  // Point the forearm at the (possibly unreachable) real target.
  const tx = s.x + (dx / (raw || 1)) * d;
  const ty = s.y + (dy / (raw || 1)) * d;
  const foreDir = Math.atan2(ty - best.ey, tx - best.ex);
  return {
    lift,
    upper: norm(deg(best.dir) - 90),
    fore: norm(deg(foreDir) - deg(best.dir)),
    paw,
  };
}

/** Rotate a point about an origin (degrees, clockwise-positive). */
export function rotatePoint(p: Pt, origin: Pt, degrees: number): Pt {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

/** Where a paw should grip the left/right edge of a rotated prop. */
function grip(prop: PropPose, halfWidth: number, side: "l" | "r", dy = 0): Pt {
  const sign = side === "l" ? 1 : -1;
  return rotatePoint(
    { x: prop.x + sign * halfWidth * prop.scale, y: prop.y + dy * prop.scale },
    { x: prop.x, y: prop.y },
    prop.rotate,
  );
}

const restR = (): ArmPose => reach("r", { x: 174, y: 308 }, "out");
const restL = (): ArmPose => reach("l", { x: 226, y: 308 }, "out");

const eyes = (p: Partial<EyePose> = {}): EyePose => ({
  lid: 0,
  look: { x: 0, y: 0 },
  style: "open",
  track: 1,
  ...p,
});

function pose(p: Partial<Pose>): Pose {
  return {
    root: X0,
    body: X0,
    belly: X0,
    legs: X0,
    tail: X0,
    head: X0,
    scarfKnot: X0,
    scarfTail: X0,
    browL: X0,
    browR: X0,
    armL: restL(),
    armR: restR(),
    eyes: eyes(),
    mouth: "closed-smile",
    prop: null,
    water: false,
    shadow: 1,
    motion: {},
    ...p,
  };
}

/* ------------------------------------------------------------------------ */
/* Pose tables                                                               */
/* ------------------------------------------------------------------------ */

const reminderCard: PropPose = { kind: "clock-card", x: 204, y: 292, rotate: -3, scale: 1 };
const notebook: PropPose = { kind: "notebook", x: 238, y: 300, rotate: 8, scale: 1 };
const phone: PropPose = { kind: "phone", x: 280, y: 176, rotate: 8, scale: 1 };
const swimCard: PropPose = { kind: "sign", x: 340, y: 262, rotate: 68, scale: 0.72 };

/** Point on a rotated prop given an offset in the prop's own (unscaled) frame. */
function onProp(prop: PropPose, dx: number, dy: number): Pt {
  return rotatePoint(
    { x: prop.x + dx * prop.scale, y: prop.y + dy * prop.scale },
    { x: prop.x, y: prop.y },
    prop.rotate,
  );
}

export const POSES: Record<RigPose, Pose> = {
  idle: pose({}),

  greeting: pose({
    head: xf({ rotate: -4 }),
    browL: xf({ y: -3 }),
    browR: xf({ y: -3 }),
    armR: reach("r", { x: 104, y: 188 }, "down", "open", { x: 2, y: -10 }),
    mouth: "small",
    motion: { wave: true },
  }),

  listening: pose({
    head: xf({ rotate: 7, x: 2 }),
    browL: xf({ y: -2, rotate: 4 }),
    browR: xf({ y: -1 }),
    armL: reach("l", { x: 296, y: 178 }, "out", "open", { x: 8, y: -22 }),
    body: xf({ rotate: 1.5 }),
    eyes: eyes({ look: { x: -1, y: 0 } }),
  }),

  thinking: pose({
    head: xf({ rotate: -5 }),
    browL: xf({ y: -5, rotate: -4 }),
    browR: xf({ y: -2, rotate: 4 }),
    armR: reach("r", { x: 178, y: 238 }, "down", "closed"),
    armL: reach("l", grip(notebook, 4, "l", 16), "down", "closed"),
    prop: notebook,
    eyes: eyes({ look: { x: 4, y: -6 }, track: 0.25 }),
    mouth: "soft-o",
  }),

  speaking: pose({
    head: xf({ rotate: -2 }),
    browL: xf({ y: -2 }),
    browR: xf({ y: -2 }),
    armL: reach("l", { x: 296, y: 262 }, "down", "open"),
    motion: { gesture: true, bob: true },
  }),

  reminder: pose({
    head: xf({ rotate: 3, y: -2 }),
    browL: xf({ y: -2 }),
    browR: xf({ y: -2 }),
    prop: reminderCard,
    scarfTail: xf({ rotate: 12 }),
    armR: reach("r", grip(reminderCard, 46, "r", 12), "down", "closed"),
    armL: reach("l", grip(reminderCard, 46, "l", 12), "down", "closed"),
  }),

  acknowledged: pose({
    eyes: eyes({ style: "happy", track: 0 }),
    browL: xf({ y: -2 }),
    browR: xf({ y: -2 }),
    head: xf({ rotate: 2 }),
    motion: { nod: true },
  }),

  calling: pose({
    head: xf({ rotate: 6, x: 2 }),
    armL: reach("l", { x: 270, y: 198 }, "out", "closed", { x: -2, y: -10 }),
    prop: phone,
    eyes: eyes({ look: { x: -2, y: 1 }, track: 0.4 }),
    browL: xf({ y: -1, rotate: 3 }),
  }),

  help: pose({
    body: xf({ scaleY: 1.02 }),
    head: xf({ y: -3 }),
    browR: xf({ rotate: -8, y: -1 }),
    browL: xf({ rotate: 8, y: -1 }),
    armL: reach("l", { x: 304, y: 282 }, "down", "open"),
    armR: reach("r", { x: 184, y: 282 }, "down", "closed"),
    eyes: eyes({ track: 0.6 }),
  }),

  quiet: pose({
    body: xf({ scaleY: 0.985 }),
    head: xf({ rotate: -8, y: 5 }),
    browL: xf({ y: 3 }),
    browR: xf({ y: 3 }),
    // paws folded on her tummy
    armR: reach("r", { x: 194, y: 300 }, "out"),
    armL: reach("l", { x: 210, y: 312 }, "out"),
    tail: xf({ rotate: 8 }),
    scarfTail: xf({ rotate: 2 }),
    eyes: eyes({ lid: 1, track: 0 }),
  }),

  swim: pose({
    // Reclined on her back in the water: head up-left, toes up, card on her chest.
    root: xf({ rotate: -60, x: 20, y: -35, scale: 0.85 }),
    head: xf({ rotate: 36, y: -2 }),
    tail: xf({ rotate: -110 }),
    legs: xf({ rotate: -16 }),
    scarfTail: xf({ rotate: 48 }),
    prop: swimCard,
    // her top paw holds the card up out of the water; the other rests on her tummy
    armL: reach("l", onProp(swimCard, -8, 40), "out", "closed"),
    armR: reach("r", { x: 186, y: 300 }, "out", "closed"),
    eyes: eyes({ look: { x: 1, y: -2 }, track: 0.6 }),
    mouth: "small",
    water: true,
    shadow: 0,
  }),

  peek: pose({
    root: xf({ y: 168, scale: 1.08 }),
    head: xf({ rotate: 4, y: 4 }),
    browL: xf({ y: -4 }),
    browR: xf({ y: -4 }),
    armR: reach("r", { x: 122, y: 222 }, "down", "closed"),
    armL: reach("l", { x: 278, y: 222 }, "down", "closed"),
    eyes: eyes({ look: { x: 0, y: -2 } }),
    shadow: 0,
  }),

  "point-left": pose({
    body: xf({ rotate: -2 }),
    head: xf({ rotate: -5, x: -3 }),
    browL: xf({ y: -3 }),
    browR: xf({ y: -3 }),
    armR: reach("r", { x: 74, y: 244 }, "down", "point"),
    eyes: eyes({ look: { x: -6, y: -1 }, track: 0.2 }),
    mouth: "small",
  }),

  "point-right": pose({
    body: xf({ rotate: 2 }),
    head: xf({ rotate: 5, x: 3 }),
    browL: xf({ y: -3 }),
    browR: xf({ y: -3 }),
    armL: reach("l", { x: 326, y: 244 }, "down", "point"),
    eyes: eyes({ look: { x: 6, y: -1 }, track: 0.2 }),
    mouth: "small",
  }),
};

export function getPose(name: PoseName): Pose {
  return POSES[name as RigPose] ?? POSES.idle;
}

/** DESIGN.md §7 thresholds (single frame; the 140 ms wide/round alternation is applied by the renderer). */
export function mouthForLevel(level: number, silent: MouthShape, alternate = false): MouthShape {
  if (!(level >= 0.08)) return silent;
  if (level < 0.35) return "small";
  if (level < 0.7) return "wide";
  return alternate ? "round" : "wide";
}

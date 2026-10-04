/**
 * Hero lake illustration (after design/reference/concept-000.png): misty
 * mountains, a far tree line, still water with CSS-animated shimmer.
 * Pure SVG, rendered on the server. Deterministic (seeded) tree placement so
 * server and client markup always match.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Tree = { x: number; y: number; r: number; kind: 'round' | 'pine' };

function treeLine(seed: number, y0: number, spread: number, minR: number, maxR: number, from = 0, to = 1600): Tree[] {
  const r = rng(seed);
  const out: Tree[] = [];
  let x = from - 10;
  while (x < to + 20) {
    const rad = minR + r() * (maxR - minR);
    out.push({ x, y: y0 + r() * spread, r: rad, kind: r() < 0.28 ? 'pine' : 'round' });
    x += rad * (0.9 + r() * 0.6);
  }
  return out;
}

function TreeShapes({ trees, fill }: { trees: Tree[]; fill: string }) {
  return (
    <g fill={fill}>
      {trees.map((t, i) =>
        t.kind === 'round' ? (
          <ellipse key={i} cx={t.x} cy={t.y} rx={t.r} ry={t.r * 1.15} />
        ) : (
          <path
            key={i}
            d={`M${t.x - t.r * 0.75} ${t.y + t.r} L${t.x} ${t.y - t.r * 2} L${t.x + t.r * 0.75} ${t.y + t.r} Z`}
          />
        ),
      )}
    </g>
  );
}

const SHIMMER = (() => {
  const r = rng(7);
  return Array.from({ length: 34 }, () => {
    const y = 506 + Math.pow(r(), 1.4) * 186;
    const depth = (y - 500) / 200; // 0 far → 1 near
    return {
      x: 40 + r() * 1520,
      y,
      w: 16 + depth * 70 * (0.5 + r()),
      sw: 1.2 + depth * 2.4,
      delay: -r() * 5.5,
      dur: 4 + r() * 3,
    };
  });
})();

const HOUSES = [
  { x: 228, y: 478, w: 16, roof: '#B4735A' },
  { x: 250, y: 482, w: 12, roof: '#C08A6E' },
  { x: 268, y: 476, w: 18, roof: '#A9664E' },
  { x: 1190, y: 480, w: 14, roof: '#B4735A' },
  { x: 1210, y: 476, w: 18, roof: '#A9664E' },
];

const BACK = treeLine(11, 470, 10, 10, 18);
const FRONT = treeLine(23, 486, 8, 9, 16);
const LEFT_HILL = treeLine(31, 452, 26, 13, 22, 0, 420);
const RIGHT_HILL = treeLine(41, 440, 30, 13, 24, 1180, 1600);

export function LakeScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1600 700"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="lp-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A9C0BA" />
          <stop offset="0.55" stopColor="#C4D4CF" />
          <stop offset="1" stopColor="#E3EAE4" />
        </linearGradient>
        <linearGradient id="lp-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#86A79D" />
          <stop offset="0.6" stopColor="#A9C2BA" />
          <stop offset="1" stopColor="#D3DFD9" />
        </linearGradient>
        <linearGradient id="lp-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6E9386" />
          <stop offset="1" stopColor="#8DAA9F" />
        </linearGradient>
        <linearGradient id="lp-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D9E6E0" />
          <stop offset="0.25" stopColor="#BCD5CD" />
          <stop offset="1" stopColor="#93BCB1" />
        </linearGradient>
        <linearGradient id="lp-mistband" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7F3EA" stopOpacity="0" />
          <stop offset="0.5" stopColor="#F7F3EA" stopOpacity="0.75" />
          <stop offset="1" stopColor="#F7F3EA" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lp-reflect" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3E6A5E" stopOpacity="0.35" />
          <stop offset="1" stopColor="#3E6A5E" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lp-glint" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF8EA" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFF8EA" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* far range */}
      <path
        d="M0 330 C120 300 200 255 300 246 C380 238 440 282 520 272 C620 258 690 196 780 176 C850 160 900 204 980 216 C1080 232 1150 150 1250 122 C1320 102 1380 150 1450 176 C1520 200 1570 192 1600 188 L1600 500 L0 500 Z"
        fill="url(#lp-far)"
      />
      {/* snow-light ridges on the far range */}
      <path
        d="M1250 122 C1270 130 1282 150 1300 156 M780 176 C796 186 806 200 822 204"
        stroke="#F4F1E8"
        strokeOpacity="0.7"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <g className="lp-mist">
        <rect x="-120" y="300" width="1840" height="120" fill="url(#lp-mistband)" />
      </g>
      {/* mid range */}
      <path
        d="M0 400 C100 382 160 344 262 348 C362 352 420 392 520 382 C640 370 700 304 820 302 C920 300 980 362 1080 362 C1180 362 1240 282 1350 272 C1450 264 1520 322 1600 334 L1600 500 L0 500 Z"
        fill="url(#lp-mid)"
      />
      <g className="lp-mist" style={{ animationDuration: '52s', animationDelay: '-20s' }}>
        <rect x="-160" y="380" width="1920" height="90" fill="url(#lp-mistband)" />
      </g>
      {/* near hills either side */}
      <path d="M0 450 C80 420 180 410 300 436 C360 450 420 470 460 490 L0 500 Z" fill="url(#lp-near)" />
      <path d="M1600 430 C1500 404 1380 410 1270 444 C1220 460 1180 476 1150 492 L1600 500 Z" fill="url(#lp-near)" />
      <TreeShapes trees={LEFT_HILL} fill="#5F8577" />
      <TreeShapes trees={RIGHT_HILL} fill="#5F8577" />
      {/* tree line along the far shore */}
      <TreeShapes trees={BACK} fill="#6F9688" />
      {HOUSES.map((h, i) => (
        <g key={i}>
          <rect x={h.x} y={h.y} width={h.w} height={h.w * 0.62} fill="#F4EEE2" />
          <path d={`M${h.x - 2} ${h.y} L${h.x + h.w / 2} ${h.y - h.w * 0.42} L${h.x + h.w + 2} ${h.y} Z`} fill={h.roof} />
        </g>
      ))}
      <TreeShapes trees={FRONT} fill="#4E7769" />

      {/* lake */}
      <rect x="0" y="496" width="1600" height="204" fill="url(#lp-lake)" />
      {/* reflection of the shore */}
      <rect x="0" y="496" width="1600" height="56" fill="url(#lp-reflect)" />
      <path d="M0 496 H1600" stroke="#F7F3EA" strokeOpacity="0.7" strokeWidth="2" />
      <ellipse cx="1180" cy="560" rx="260" ry="26" fill="url(#lp-glint)" opacity="0.7" />
      <g stroke="#FFFDF7" strokeLinecap="round">
        {SHIMMER.map((s, i) => (
          <line
            key={i}
            className="lp-shimmer"
            x1={s.x}
            x2={s.x + s.w}
            y1={s.y}
            y2={s.y}
            strokeWidth={s.sw}
            style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
          />
        ))}
      </g>
    </svg>
  );
}

/** Two birds drifting in the sky. */
export function Birds({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 50" className={className} aria-hidden focusable="false">
      <g className="lp-bird" fill="none" stroke="#4A5552" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round">
        <path className="lp-flap" d="M10 22 q8 -8 14 0 q6 -8 14 0" />
        <path className="lp-flap" style={{ animationDelay: '-0.4s' }} d="M52 34 q6 -6 10 0 q4 -6 10 0" />
      </g>
    </svg>
  );
}

/** The rock Nami sits on. Its base is hidden by the near water in front of it. */
export function Rock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 160" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="lp-rock" x1="0.2" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#C8C0AF" />
          <stop offset="0.5" stopColor="#9D9483" />
          <stop offset="1" stopColor="#6B6356" />
        </linearGradient>
        <linearGradient id="lp-rock-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4F483E" stopOpacity="0" />
          <stop offset="1" stopColor="#4F483E" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#FFFDF7" strokeWidth="2.5">
        <ellipse className="lp-ripple" cx="180" cy="142" rx="176" ry="13" />
        <ellipse className="lp-ripple" style={{ animationDelay: '-2.1s' }} cx="180" cy="142" rx="176" ry="13" />
      </g>
      <path
        d="M10 160 C6 128 26 98 60 82 C86 70 104 52 140 46 C176 40 216 41 250 51 C288 62 318 84 334 110 C346 128 350 146 348 160 Z"
        fill="url(#lp-rock)"
      />
      <path d="M232 48 C276 58 316 82 334 110 C346 128 350 146 348 160 L268 160 C300 126 290 80 232 48 Z" fill="url(#lp-rock-side)" />
      {/* small second stone */}
      <path d="M296 160 C298 140 316 128 336 130 C352 132 362 146 360 160 Z" fill="#7F776A" />
      <path d="M306 140 C314 133 326 131 336 133" stroke="#BDB5A5" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
      {/* lit top where she sits */}
      <path d="M76 78 C104 60 144 49 190 47 C232 46 264 55 292 70 C252 64 206 62 164 66 C126 69 98 74 76 78 Z" fill="#E4DCCB" opacity="0.75" />
      <path d="M120 98 C150 92 170 96 190 104 M222 88 C240 92 252 100 258 112" stroke="#6F6759" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.45" />
      {/* moss */}
      <path d="M34 112 C42 96 62 86 84 86 C76 98 58 108 34 112 Z" fill="#7E9A72" opacity="0.9" />
      <path d="M270 60 C288 62 304 72 310 84 C294 80 280 72 270 60 Z" fill="#7E9A72" opacity="0.75" />
    </svg>
  );
}

/**
 * Near water across the bottom of the hero, in the same sea-greens as Nami's
 * swim pose so her water melts into it. Waves drift sideways.
 */
export function NearWater({ className }: { className?: string }) {
  const wave = (y: number, a: number, w: number) => {
    let d = `M0 ${y}`;
    for (let x = 0; x < 3200; x += w) d += ` q${w / 4} ${-a} ${w / 2} 0 t${w / 2} 0`;
    return d;
  };
  return (
    <div className={className} aria-hidden>
      <div className="absolute inset-0 overflow-hidden">
        <svg viewBox="0 0 3200 120" preserveAspectRatio="none" className="lp-wave-x-slow absolute inset-y-0 left-0 h-full w-[200%]">
          <path d={`${wave(22, 8, 200)} V120 H0 Z`} fill="#BFDDD5" opacity="0.6" />
        </svg>
        <svg viewBox="0 0 3200 120" preserveAspectRatio="none" className="lp-wave-x absolute inset-y-0 left-0 h-full w-[200%]">
          <defs>
            <linearGradient id="lp-near-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#A9D3C9" stopOpacity="0.9" />
              <stop offset="0.4" stopColor="#86BAAE" stopOpacity="0.97" />
              <stop offset="1" stopColor="#6FA497" />
            </linearGradient>
          </defs>
          <path d={`${wave(28, 10, 160)} V120 H0 Z`} fill="url(#lp-near-water)" />
          <path d={wave(28, 10, 160)} stroke="#E4F3EE" strokeWidth="3" fill="none" />
          <g stroke="#E4F3EE" strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round">
            {Array.from({ length: 24 }, (_, i) => (
              <path key={i} d={`M${60 + i * 133} ${58 + (i % 3) * 14} q14 -6 28 0`} fill="none" />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

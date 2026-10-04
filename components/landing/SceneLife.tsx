/**
 * Small moving things painted over each day scene, in the painting's own
 * coordinates (1920×1081, `slice` = object-cover). Pure CSS animation, no JS.
 */

const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

function Birds() {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i} className="sl-fly" style={{ animationDuration: `${34 + i * 7}s`, animationDelay: `${-i * 11}s` }}>
          <g transform={`translate(0 ${150 + i * 55}) scale(${1 - i * 0.18})`}>
            <path className="sl-flap" style={{ animationDelay: `${-i * 0.3}s` }} d="M-22 0 Q-11 -10 0 0 Q11 -10 22 0" fill="none" stroke="#5a3a2e" strokeWidth="3.2" strokeLinecap="round" opacity="0.7" />
          </g>
        </g>
      ))}
    </g>
  );
}

function Motes({ x0, x1, y0, y1, n = 14 }: { x0: number; x1: number; y0: number; y1: number; n?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <circle
          key={i}
          className="sl-mote"
          cx={x0 + rnd(i, 1) * (x1 - x0)}
          cy={y0 + rnd(i, 2) * (y1 - y0)}
          r={2 + rnd(i, 3) * 3}
          fill="#fff7dc"
          style={{ animationDuration: `${7 + rnd(i, 4) * 8}s`, animationDelay: `${-rnd(i, 5) * 10}s` }}
        />
      ))}
    </g>
  );
}

function Steam({ x, y }: { x: number; y: number }) {
  return (
    <g filter="url(#sl-blur)" opacity="0.7">
      {[0, 1].map((i) => (
        <path
          key={i}
          className="hz-steam"
          style={{ animationDelay: `${-i * 3}s` }}
          d={`M${x + i * 22} ${y} c-20 -40 22 -60 0 -100 c-16 -30 12 -50 4 -80`}
          fill="none"
          stroke="#fff"
          strokeWidth={12 - i * 3}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

function Glow({ x, y, r, color, flicker }: { x: number; y: number; r: number; color: string; flicker?: boolean }) {
  return <circle className={flicker ? 'sl-flicker' : 'sl-breathe'} cx={x} cy={y} r={r} fill={`url(#sl-glow-${color})`} />;
}

function Petals({ x0, x1, color, n = 5 }: { x0: number; x1: number; color: string; n?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i} className="hz-fall" style={{ animationDuration: `${14 + rnd(i, 7) * 9}s`, animationDelay: `${-rnd(i, 8) * 20}s` }}>
          <g className="hz-sway" style={{ animationDuration: `${3 + (i % 3)}s` }}>
            <ellipse cx={x0 + rnd(i, 9) * (x1 - x0)} cy={0} rx={8} ry={5} fill={color} opacity="0.9" />
          </g>
        </g>
      ))}
    </g>
  );
}

function Stars() {
  return (
    <g>
      {Array.from({ length: 22 }, (_, i) => (
        <circle key={i} className="lp-twinkle" cx={760 + rnd(i, 11) * 1150} cy={20 + rnd(i, 12) * 260} r={1.6 + rnd(i, 13) * 1.8} fill="#fff8e6" style={{ animationDelay: `${-rnd(i, 14) * 4}s`, animationDuration: `${2.5 + rnd(i, 15) * 3}s` }} />
      ))}
    </g>
  );
}

function Fireflies() {
  return (
    <g>
      {Array.from({ length: 9 }, (_, i) => (
        <circle
          key={i}
          className="sl-firefly"
          cx={40 + rnd(i, 21) * 520}
          cy={520 + rnd(i, 22) * 380}
          r={4}
          fill="#ffe9a8"
          style={{ animationDuration: `${6 + rnd(i, 23) * 6}s`, animationDelay: `${-rnd(i, 24) * 8}s` }}
        />
      ))}
    </g>
  );
}

const SCENES: Record<string, () => React.ReactNode> = {
  'day-sunrise': () => (
    <>
      <Glow x={1500} y={220} r={260} color="sun" />
      <Birds />
      <Petals x0={60} x1={560} color="#e2558e" />
    </>
  ),
  'day-morning': () => (
    <>
      <path className="sl-beam" d="M300 0 L760 0 L1240 1081 L620 1081 Z" fill="url(#sl-beam)" />
      <Motes x0={380} x1={1150} y0={120} y1={900} />
      <Steam x={1075} y={420} />
    </>
  ),
  'day-lane': () => (
    <>
      <path className="sl-beam" d="M1100 0 L1500 0 L1900 1081 L1300 1081 Z" fill="url(#sl-beam)" />
      <Motes x0={1000} x1={1800} y0={200} y1={900} n={10} />
      <Petals x0={80} x1={600} color="#f3b8c9" n={4} />
    </>
  ),
  'day-night': () => (
    <>
      <Stars />
      <Glow x={355} y={95} r={150} color="lamp" flicker />
      <Glow x={1000} y={640} r={110} color="lamp" flicker />
      <Fireflies />
    </>
  ),
};

export function SceneLife({ scene }: { scene: string }) {
  const draw = SCENES[scene];
  if (!draw) return null;
  return (
    <svg aria-hidden viewBox="0 0 1920 1081" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <filter id="sl-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <radialGradient id="sl-glow-sun">
          <stop offset="0" stopColor="#fff2c4" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffb86b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sl-glow-lamp">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ff9d3a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sl-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6d6" stopOpacity="0.32" />
          <stop offset="1" stopColor="#fff6d6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {draw()}
    </svg>
  );
}

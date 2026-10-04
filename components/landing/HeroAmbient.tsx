/**
 * Small living things on the painted desk: steam off the chai and a few jasmine
 * petals drifting down. The SVG uses the painting's own coordinates with
 * `slice`, so it stays locked to the picture like `object-cover` does.
 */
const PETALS = [
  { x: 1700, d: 0, t: 15, s: 1 },
  { x: 1540, d: -6, t: 19, s: 0.8 },
  { x: 1830, d: -11, t: 17, s: 0.9 },
  { x: 1380, d: -3, t: 22, s: 0.7 },
  { x: 1620, d: -15, t: 20, s: 1.1 },
];

export function HeroAmbient() {
  return (
    <svg aria-hidden viewBox="0 0 1920 1081" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 -z-10 hidden h-full w-full lg:block">
      <defs>
        <filter id="hz-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <radialGradient id="hz-petal" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="1" stopColor="#efe6d0" />
        </radialGradient>
      </defs>
      {/* steam over the cup */}
      <g filter="url(#hz-blur)" opacity="0.75">
        <path className="hz-steam" style={{ animationDelay: '0s' }} d="M1795 770 C1770 720 1820 690 1795 640 C1775 600 1810 570 1800 530" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
        <path className="hz-steam" style={{ animationDelay: '-2.1s' }} d="M1830 770 C1855 725 1810 690 1835 645 C1855 605 1825 575 1835 540" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" />
        <path className="hz-steam" style={{ animationDelay: '-4.2s' }} d="M1812 775 C1800 735 1830 700 1815 660 C1800 620 1825 595 1818 560" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
      </g>
      {PETALS.map((p, i) => (
        <g key={i} className="hz-fall" style={{ animationDuration: `${p.t}s`, animationDelay: `${p.d}s` }}>
          <g className="hz-sway" style={{ animationDuration: `${3 + (i % 3)}s` }}>
            <ellipse cx={p.x} cy={0} rx={9 * p.s} ry={5 * p.s} fill="url(#hz-petal)" opacity="0.92" />
          </g>
        </g>
      ))}
    </svg>
  );
}

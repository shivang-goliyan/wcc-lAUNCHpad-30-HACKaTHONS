import { NamiSlot } from './NamiSlot';
import { Container } from './ui';

function wavePath(y: number, a: number, w: number, total = 3200) {
  let d = `M0 ${y}`;
  for (let x = 0; x < total; x += w) d += ` q${w / 4} ${-a} ${w / 2} 0 t${w / 2} 0`;
  return d;
}

/** A band of moving water between two sections, in Nami's swim-pose greens. */
function Water({ top, bottom, height, surface }: { top: string; bottom: string; height: string; surface: number }) {
  return (
    <div aria-hidden className={`absolute inset-x-0 ${height} overflow-hidden`} style={{ background: `linear-gradient(${top} 0 50%, ${bottom} 50% 100%)` }}>
      <svg viewBox="0 0 3200 100" preserveAspectRatio="none" className="lp-wave-x-slow absolute inset-y-0 left-0 h-full w-[200%]">
        <path d={`${wavePath(surface - 6, 7, 220)} V100 H0 Z`} fill="#C5E1D9" opacity="0.7" />
      </svg>
      <svg viewBox="0 0 3200 100" preserveAspectRatio="none" className="lp-wave-x absolute inset-y-0 left-0 h-full w-[200%]">
        <defs>
          <linearGradient id={`lp-stripe-${surface}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A9D3C9" />
            <stop offset="0.5" stopColor="#86BAAE" />
            <stop offset="1" stopColor="#6FA497" />
          </linearGradient>
        </defs>
        <path d={`${wavePath(surface, 8, 170)} V100 H0 Z`} fill={`url(#lp-stripe-${surface})`} />
        <path d={wavePath(surface, 8, 170)} stroke="#E4F3EE" strokeWidth="2.5" fill="none" />
        <g stroke="#E4F3EE" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" fill="none">
          {Array.from({ length: 22 }, (_, i) => (
            <path key={i} d={`M${50 + i * 145} ${surface + 18 + (i % 3) * 10} q12 -5 24 0`} />
          ))}
        </g>
      </svg>
      {/* far edge melts into the next section */}
      <svg viewBox="0 0 1600 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-[-1px] h-[24px] w-full">
        <path d="M0 18 C220 4 420 30 640 16 C860 4 1060 28 1260 16 C1420 8 1520 20 1600 12 V40 H0 Z" fill={bottom} />
      </svg>
    </div>
  );
}

/** Problem → jobs. Nami pokes her head out of the water here. */
export function PeekDivider() {
  return (
    <div className="relative h-[120px] sm:h-[132px]">
      <Water top="#F7F3EA" bottom="#EFE8D9" height="inset-y-0" surface={34} />
      <Container className="h-full">
        <NamiSlot
          id="peek-water"
          pose="peek"
          className="absolute right-6 bottom-[76px] h-[120px] w-[120px] sm:bottom-[84px] xl:right-[calc(100%+40px)] xl:h-[150px] xl:w-[150px]"
        />
      </Container>
    </div>
  );
}

/** Jobs → the call replay. She swims across from the left lane to the right one. */
export function SwimDivider() {
  return (
    <div className="relative h-[130px] sm:h-[150px]">
      <Water top="#EFE8D9" bottom="#173D38" height="inset-y-0" surface={34} />
      <NamiSlot id="mid-swim" pose="swim" path className="absolute inset-x-0 bottom-[57px] h-[110px] sm:bottom-[70px] xl:bottom-[60px] xl:h-[150px]" />
    </div>
  );
}

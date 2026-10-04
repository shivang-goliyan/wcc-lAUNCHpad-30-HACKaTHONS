'use client';

import { useReducedMotionSafe } from './useReducedMotionSafe';
import { clsx } from 'clsx';
import { NamiSvg } from '@/components/nami/NamiSvg';
import type { PoseName } from '@/lib/nami/poses';

/**
 * A reserved, empty spot in the layout where Nami lands (docs/DESIGN.md §5).
 *
 * RoamingNami reads every visible `[data-nami-slot]` and travels between them,
 * so she only ever rests in space the layout kept free. With reduced motion
 * there is no roaming: each slot shows a static pose instead.
 *
 * `path` slots are wide strips on a water divider: she swims across them.
 * The `hero` slot always server-renders a static Nami (hidden once roaming
 * starts) so the first paint already has her on the rock.
 */
export function NamiSlot({
  id,
  pose,
  path = false,
  hero = false,
  className,
}: {
  id: string;
  pose: PoseName;
  path?: boolean;
  hero?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotionSafe();
  const showStatic = hero || reduce;
  return (
    <div
      data-nami-slot={id}
      data-pose={pose}
      data-path={path ? '1' : undefined}
      data-hero={hero ? '1' : undefined}
      aria-hidden
      className={clsx('pointer-events-none', className)}
    >
      {showStatic ? (
        path ? (
          <div className="aspect-square h-full">
            <NamiSvg pose="swim" reducedMotion className="lp-swim-mask h-full w-full" />
          </div>
        ) : (
          <NamiSvg pose={pose} reducedMotion className={clsx('h-full w-full', hero && 'lp-static-hero')} />
        )
      ) : null}
    </div>
  );
}

'use client';

import { useReducedMotionSafe } from './useReducedMotionSafe';
import { clsx } from 'clsx';
import { NamiImage } from '@/components/nami/NamiImage';
import type { PoseName } from '@/lib/nami/poses';

/**
 * A reserved, empty spot in the layout where Nami lands (docs/DESIGN.md §5).
 *
 * RoamingNami reads every visible `[data-nami-slot]` and travels between them,
 * so she only ever rests in space the layout kept free. With reduced motion
 * there is no roaming: each slot shows a static pose instead.
 *
 * `path` slots are wide strips she travels across: she swims on a water divider,
 * or walks when `walk` is set (and stands still whenever the visitor stops scrolling).
 * There is only ever one Nami on screen: the roaming one. Slots stay empty
 * unless motion is reduced.
 */
export function NamiSlot({
  id,
  pose,
  path = false,
  walk = false,
  hero = false,
  say,
  className,
}: {
  id: string;
  pose: PoseName;
  path?: boolean;
  /** a path she walks along instead of swimming */
  walk?: boolean;
  hero?: boolean;
  /** what she tells the visitor while she sits here */
  say?: string;
  className?: string;
}) {
  const reduce = useReducedMotionSafe();
  const showStatic = reduce;
  return (
    <div
      data-nami-slot={id}
      data-pose={pose}
      data-path={path ? '1' : undefined}
      data-walk={path && walk ? '1' : undefined}
      data-hero={hero ? '1' : undefined}
      data-say={say}
      aria-hidden
      className={clsx('pointer-events-none', className)}
    >
      {showStatic ? (
        path ? (
          <div className="aspect-square h-full">
            <NamiImage pose={walk ? 'walk' : 'swim'} reducedMotion className={clsx('h-full w-full', !walk && 'lp-swim-mask')} />
          </div>
        ) : (
          <NamiImage pose={pose} reducedMotion className="h-full w-full" />
        )
      ) : null}
    </div>
  );
}

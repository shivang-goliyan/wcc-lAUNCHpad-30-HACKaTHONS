import type { PoseName } from '@/lib/nami/poses';

/**
 * Marks where a section starts, for the walking Nami: which corner she settles
 * in once you stop scrolling here, the pose she takes and what she says.
 * Takes no space.
 */
export function NamiCue({ pose, say, side }: { pose: PoseName; say?: string; side: 'left' | 'right' }) {
  return <span aria-hidden data-nami-cue="" data-pose={pose} data-say={say} data-side={side} className="pointer-events-none absolute top-0 left-0 h-px w-px" />;
}

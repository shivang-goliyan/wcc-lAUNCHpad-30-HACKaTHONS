import { NamiImage } from '@/components/nami/NamiImage';

/** The caregiver page shows only a small, static Nami (DESIGN.md §1). */
export function NamiAvatar({ className = 'size-12' }: { className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ivory-100 ring-2 ring-sea-500/60 ${className}`}>
      <NamiImage pose="idle" reducedMotion blink="off" className="mt-[18%] h-[118%] w-[118%]" />
    </span>
  );
}

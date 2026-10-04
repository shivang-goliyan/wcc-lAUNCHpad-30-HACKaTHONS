'use client';

import { motion, useScroll, useTransform } from 'motion/react';

/** Nami's hello on the rock. Fades out as she slips into the water. */
export function HeroBubble() {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 140], [1, 0]);
  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute top-[2%] right-[66%] z-20 w-max max-w-[200px] sm:max-w-[230px] lg:hidden xl:block xl:top-[6%] xl:right-[74%]"
    >
      <p className="lp-bubble-in rounded-2xl rounded-br-md bg-card px-3.5 py-2.5 text-[13.5px] leading-snug text-ink-900 shadow-[0_10px_30px_rgba(23,61,56,0.14)] [animation-delay:700ms] sm:text-[14.5px]">
      <span lang="hi" className="font-display text-[15px] text-cocoa-500 sm:text-base">
        नमस्ते!
      </span>{' '}
        I&rsquo;m Nami, an AI companion.
      </p>
    </motion.div>
  );
}

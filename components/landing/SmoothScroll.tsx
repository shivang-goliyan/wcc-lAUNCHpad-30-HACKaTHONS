'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

let lenis: Lenis | null = null;

/** Scrolls to an element through the smooth scroller when it's running. */
export function scrollToEl(el: HTMLElement) {
  if (lenis) lenis.scrollTo(el, { duration: 1.4 });
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Wheel and trackpad scrolling eased with Lenis, so the page and Nami glide
 * instead of stepping 100px per notch. Native scroll stays the source of
 * truth, so useScroll and sticky positioning work as before. Off with reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, autoRaf: true });
    return () => {
      lenis?.destroy();
      lenis = null;
    };
  }, []);
  return null;
}

import { motion, useReducedMotion } from 'motion/react';

/**
 * The tablet composition's one ornament: concentric rings spreading from the
 * green dot in the reIS mark, so the logo reads as the transmitter and the
 * empty half of a 1024pt screen becomes the thing the screen is about —
 * reaching the campus network.
 *
 * Rendered only at `md` and up. On a phone there is no width to fill and the
 * rings would be noise behind the copy; on an iPad their absence is the whole
 * complaint (#259 review: "doesn't expand across the entire width").
 *
 * Positioned by its parent (`relative`, wrapping `ReisLogo`) rather than by
 * coordinates: the rings stay centred on the dot at every logo size, and the
 * pane's `overflow-hidden` is what crops them.
 */

/**
 * Ring radii in the SVG's own units, and the opacity each one carries.
 *
 * Hairlines, not washes: `primary` at 8% over `base-200` is invisible on a real
 * panel, which would leave the void this element exists to fill. The stroke is
 * 1.5 units wide, so even 0.28 reads as a quiet line rather than a shout.
 */
const RINGS = [
  { r: 96, opacity: 0.28 },
  { r: 196, opacity: 0.2 },
  { r: 324, opacity: 0.15 },
  { r: 486, opacity: 0.11 },
  { r: 676, opacity: 0.08 },
  { r: 900, opacity: 0.06 },
];

export function WelcomeSignal() {
  const reduced = useReducedMotion();

  return (
    <svg
      aria-hidden
      viewBox="-1000 -1000 2000 2000"
      className="pointer-events-none absolute left-1/4 top-3/4 hidden h-[2000px] w-[2000px] -translate-x-1/2 -translate-y-1/2 text-primary md:block"
    >
      {RINGS.map(({ r, opacity }, i) => (
        // Radius and opacity are attributes, never animated: the rings are
        // fully drawn the moment they mount. Motion only nudges the scale, so
        // where the frame loop is paused (a tab that boots in the background)
        // the worst case is rings at 82% of their radius rather than a pane
        // that stayed empty. `fill-box` puts the origin on the ring's own
        // centre, which is the dot in the mark.
        <motion.circle
          key={r}
          r={r}
          opacity={opacity}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={reduced ? false : { scale: 0.82 }}
          animate={{ scale: 1 }}
          // One orchestrated moment on entry — the rings leave the mark in
          // order, like a signal going out — and then the element is still.
          // The card owns every state after this; a background that also
          // reacted would be a second indicator saying the same thing.
          transition={{ delay: i * 0.08, duration: 0.7, ease: 'easeOut' }}
        />
      ))}
    </svg>
  );
}

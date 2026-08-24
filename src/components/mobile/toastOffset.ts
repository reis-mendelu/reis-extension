/**
 * Where a top-centred toast sits on the phone tree.
 *
 * DemoBanner and the Toaster are both anchored to the top of the viewport and
 * both spent `--safe-top`, so with demo mode on a toast was drawn across the
 * banner — the "this is only a demo" message covering the word "Ukázka" it was
 * explaining, which is the first thing an App Store reviewer sees after
 * entering the demo.
 *
 * The extra term is DemoBanner's own box, not a nudge: `pt-1`(4px) +
 * `btn-xs`(24px) + `pb-1`(4px) = 2rem, on top of the inset it already pads
 * for. Keep the two in step — if the banner's padding or button size changes,
 * this changes with it.
 */
export const DEMO_BANNER_HEIGHT = '2rem';

const SAFE_TOP = 'calc(1rem + var(--safe-top, 0px))';

export function toastOffset(demoMode: boolean): {
  top: string;
  right: string;
  left: string;
  bottom: string;
} {
  return {
    top: demoMode ? `calc(1rem + var(--safe-top, 0px) + ${DEMO_BANNER_HEIGHT})` : SAFE_TOP,
    // sonner's own mobile defaults, restated because passing an object
    // replaces them wholesale.
    right: '16px',
    left: '16px',
    bottom: '16px',
  };
}

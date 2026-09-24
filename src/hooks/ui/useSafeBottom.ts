import { useSyncExternalStore } from 'react';
import { parseSafeInset } from '../../utils/mobile/safeArea';

/**
 * `--safe-bottom` as a number, for the one consumer that cannot be a `calc()`.
 *
 * Everything else that clears the floating nav does it in a class —
 * `pb-[calc(6rem_+_var(--safe-bottom,0px))]` and friends — which is the
 * pattern `--safe-top` already uses. `useMapSheetDrag` cannot: it clamps the
 * drag floor with `Math.max`, in JavaScript, and that number has to be the
 * same one the resting class resolves to.
 *
 * Cached and invalidated on resize rather than read per render: a drag sets
 * state on every pointermove, and `getComputedStyle` is a synchronous layout
 * read. The inset itself only changes when the window does — rotation, a
 * keyboard, entering split screen — and all three fire `resize`.
 */
let cached: number | null = null;

function read(): number {
  if (cached === null) {
    cached = parseSafeInset(
      getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')
    );
  }
  return cached;
}

function subscribe(onChange: () => void): () => void {
  const invalidate = () => {
    cached = null;
    onChange();
  };
  window.addEventListener('resize', invalidate);
  window.addEventListener('orientationchange', invalidate);
  return () => {
    window.removeEventListener('resize', invalidate);
    window.removeEventListener('orientationchange', invalidate);
  };
}

export function useSafeBottom(): number {
  // Server snapshot 0: there is no inset until a real viewport says otherwise,
  // and 0 is what every desktop browser resolves `env()` to anyway.
  return useSyncExternalStore(subscribe, read, () => 0);
}

/** Test seam: the module-level cache outlives a component, so tests reset it. */
export function __resetSafeBottomCache(): void {
  cached = null;
}

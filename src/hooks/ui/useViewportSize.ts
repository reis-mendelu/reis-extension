import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

/**
 * The tallest height seen at the current width.
 *
 * A soft keyboard shortens the screen without narrowing it: on Android the
 * layout viewport itself shrinks (the manifest sets no `windowSoftInputMode`),
 * and on iOS the visual one does. Rotating changes the width, which is what
 * resets this. So a layout keyed off it does not jump each time the student
 * types in the map's search — a landscape iPad with the keyboard up is ~440px
 * tall, the height of a phone.
 */
export function tallestAtWidth(
  seen: { width: number; height: number },
  width: number,
  height: number
): { width: number; height: number } {
  if (width !== seen.width) return { width, height };
  if (height > seen.height) return { width, height };
  return seen;
}

let seen = { width: -1, height: 0 };

function layoutHeight() {
  seen = tallestAtWidth(seen, window.innerWidth, window.innerHeight);
  return seen.height;
}

/** The layout viewport, in the units a `min-width` media query reads — with
 *  the height held against the keyboard (see `tallestAtWidth`). */
export function useViewportSize(): { width: number; height: number } {
  const width = useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => 0
  );
  const height = useSyncExternalStore(subscribe, layoutHeight, () => 0);
  return { width, height };
}

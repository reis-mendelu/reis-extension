import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

/**
 * The layout viewport, in the units a `min-width` media query reads.
 *
 * `innerHeight` rather than the store's `viewportHeight`: that one is the
 * VISUAL viewport, which shrinks when the keyboard opens, and a layout that
 * keys off it jumps each time the student types in the map's search.
 */
export function useViewportSize(): { width: number; height: number } {
  const width = useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => 0
  );
  const height = useSyncExternalStore(
    subscribe,
    () => window.innerHeight,
    () => 0
  );
  return { width, height };
}

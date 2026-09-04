import { useSyncExternalStore } from 'react';
import { RAIL_MIN_WIDTH } from '../../utils/mapRail';

const QUERY = `(min-width: ${RAIL_MIN_WIDTH}px)`;

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

/**
 * Width alone — deliberately NOT `useIsMobile`, which also demands
 * `pointer: coarse`.
 *
 * That extra condition is right for its own callers and wrong here: it is
 * false in a desktop browser at any width, so the dev harness and verify:ui
 * would render the phone layout while the iPad rendered the rail, and the one
 * screen this decides could never be checked before it shipped. Width is also
 * the honest test — the rail exists because there IS width for it.
 *
 * Matches Tailwind's `md` exactly, because the layout is CSS and only the
 * camera compensation is JS; if the two disagree by a pixel the pin lands
 * under the rail.
 */
export function useWideViewport(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}

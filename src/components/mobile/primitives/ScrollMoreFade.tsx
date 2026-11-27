import type { RefObject } from 'react';
import { useMoreBelow } from './useMoreBelow';

/**
 * A fade over the foot of a tab, shown only while its scroller hides more
 * below, and gone once the student reaches the end.
 *
 * Profil scrolls on some screens and some accounts (an SE, two studies, a
 * society admin) and nothing else said so: a row simply started under the nav
 * pill. The fade is the cue. It sits where the content runs out of sight —
 * behind the floating nav and a little above it — so it rises past the pill's
 * top rather than hiding under it, and it takes no taps: the row it fades is
 * the one the student may want to press.
 *
 * Goes in the tab's own positioned root, as a sibling after the scroller.
 * `base-200` because that is the app shell behind every tab.
 */
export function ScrollMoreFade({ scrollerRef }: { scrollerRef: RefObject<HTMLElement | null> }) {
  const more = useMoreBelow(scrollerRef);
  return (
    <div
      aria-hidden
      data-testid="scroll-more-fade"
      data-more={more}
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-[calc(124px_+_var(--safe-bottom,0px))] bg-linear-to-t from-base-200 from-35% to-base-200/0 transition-opacity duration-200 ${
        more ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}

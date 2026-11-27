/**
 * Whether a vertical scroller still hides content below its visible box — the
 * rule behind Profil's bottom fade, kept pure so it is testable without layout.
 */

/**
 * Hidden overflow up to this much is not content, so it lights no cue.
 *
 * Two things overflow on every Profil, whatever its rows: AlwaysScrollable
 * holds the content 1px taller than the box so iOS can rubber-band it, and
 * the bottom padding clears the floating nav (76px, measured) with 8px over.
 * With 8px or less hidden, the last row still ends above the nav.
 */
export const MORE_BELOW_SLACK_PX = 8;

export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function hasMoreBelow({ scrollTop, scrollHeight, clientHeight }: ScrollMetrics): boolean {
  // A negative scrollTop is iOS rubber-banding above the top: the content
  // below has not moved into view, so count from 0.
  const hidden = scrollHeight - clientHeight - Math.max(0, scrollTop);
  return hidden > MORE_BELOW_SLACK_PX;
}

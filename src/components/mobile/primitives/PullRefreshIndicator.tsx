import { useRef, type RefObject } from 'react';
import { RefreshCw } from 'lucide-react';
import { syncService } from '../../../services/sync';
import { usePullToRefresh } from './usePullToRefresh';

/**
 * Module-level, so the hook's listeners are bound once per mount. An inline
 * arrow would be a new function every render, and the parent re-renders on
 * every sync status change — re-binding mid-gesture drops the pull, and
 * re-binding mid-refresh drops the timer that lets go of the spinner.
 */
const refresh = () => syncService.triggerSync();

/**
 * The spinner a pull on the calendar winds up, and the gesture behind it.
 *
 * It replaced a visible circle on its own 24px row under the date (#370): that
 * row made the calendar header one line taller than every other tab's, for a
 * control a student reaches for a few times a term. The pull is the gesture
 * every list on the phone already has, and it costs no layout at all.
 *
 * A sibling of the scroller, never inside it. The scroller is the thing the
 * day swipe translates sideways and iOS rubber-bands downward; an indicator in
 * there would be dragged by both.
 *
 * `aria-hidden` because it is decoration: the screen-reader route to the same
 * sync is the `sr-only` RefreshButton in the header, since VoiceOver cannot
 * make a pull.
 */
export function PullRefreshIndicator({
  scrollerRef,
}: {
  scrollerRef: RefObject<HTMLElement | null>;
}) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  usePullToRefresh({ scrollerRef, indicatorRef, onRefresh: refresh });
  return (
    <div
      ref={indicatorRef}
      data-testid="pull-refresh-indicator"
      aria-hidden="true"
      className="group pointer-events-none absolute inset-x-0 top-2 z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-base-300 bg-base-100 text-base-content/70 opacity-0 shadow-drawer transition-[opacity,transform] duration-200 ease-out data-[state=refreshing]:opacity-100"
    >
      <RefreshCw size={16} className="group-data-[state=refreshing]:animate-spin" />
    </div>
  );
}

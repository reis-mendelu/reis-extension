import { useCallback, useRef, type RefObject } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { usePullToRefresh } from './usePullToRefresh';
import { usePullHint } from './usePullHint';
import { useRefreshHold } from './useRefreshHold';

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
 * Each screen hands it its OWN refresh and flag — the calendar the timetable,
 * exams the exam terms — so a pull fetches what that screen shows and nothing
 * else, and spins only for that refresh, never for the background sync.
 * Pass store actions: they are stable references, so the hook's listeners are
 * bound once per mount and a re-render mid-gesture cannot drop the pull.
 *
 * While a refresh runs, the list is held down with the spinner in the gap
 * (useRefreshHold). With `hint`, it also plays the pull hint once, ever
 * (usePullHint) — the calendar's lesson. Exams need none: they refresh on
 * every visit, so the student watches the gesture's result each time.
 *
 * `aria-hidden` because it is decoration: the screen-reader route to the same
 * refresh is the `sr-only` RefreshButton in the header, since VoiceOver cannot
 * make a pull.
 */
export function PullRefreshIndicator({
  scrollerRef,
  surfaceRef,
  refreshing,
  onRefresh,
  hint = false,
}: {
  scrollerRef: RefObject<HTMLElement | null>;
  /** Where a pull may start, when that is more than the scroller. */
  surfaceRef?: RefObject<HTMLElement | null>;
  refreshing: boolean;
  onRefresh: () => void;
  hint?: boolean;
}) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const seen = useAppStore((s) => s.pullHintSeen);
  const markSeen = useAppStore((s) => s.markPullHintSeen);
  // Only the screen that teaches the pull may retire its lesson: a pull on
  // exams first must not stop the calendar from ever showing it.
  const pulled = useCallback(() => {
    if (hint) markSeen();
    onRefresh();
  }, [hint, markSeen, onRefresh]);
  usePullToRefresh({ scrollerRef, surfaceRef, indicatorRef, onRefresh: pulled });
  usePullHint(scrollerRef, indicatorRef, hint && seen === false && !refreshing, markSeen);
  useRefreshHold(scrollerRef, refreshing);
  return (
    <div
      ref={indicatorRef}
      data-testid="pull-refresh-indicator"
      data-state={refreshing ? 'refreshing' : undefined}
      aria-hidden="true"
      className="group pointer-events-none absolute inset-x-0 top-2 z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-base-300 bg-base-100 text-base-content/70 opacity-0 shadow-drawer transition-[opacity,transform] duration-200 ease-out data-[state=refreshing]:opacity-100"
    >
      <RefreshCw size={16} className="group-data-[state=refreshing]:animate-spin" />
    </div>
  );
}

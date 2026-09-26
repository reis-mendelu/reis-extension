import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';

/**
 * A screen's refresh for whoever cannot pull. The calendar and exams each pass
 * their own label, action and flag.
 *
 * On a touch screen that is only a screen-reader user, so it is `sr-only`. On a
 * Mac it is everyone: the iPad app on Apple Silicon reports `pointer: fine`,
 * and neither a mouse drag nor a two-finger trackpad scroll delivers the touch
 * events the pull listens for. There it is a visible 40px circle beside the
 * pin, search and bell — the header row has room for a fifth at any width a
 * Mac window reaches, and on a phone it is never drawn.
 *
 * Sighted students refresh by pulling the day down (PullRefreshIndicator). That
 * gesture is unreachable from VoiceOver and TalkBack, whose swipes move focus
 * rather than the page, so without this button a screen-reader user would have
 * no way at all to ask for today's timetable before the next scheduled run.
 *
 * It was a visible 44px circle on its own row under the date (#370). `sr-only`
 * is position:absolute, so it takes no flex gap and no height: the calendar
 * header is back to the height of every other tab's.
 *
 * Rendered in the header rather than in the day body, so it exists in every
 * calendar state, skeleton and error included — the same rule that keeps the
 * header actions reachable during a crawl.
 *
 * The same `triggerScheduleRefresh` the pull calls: the timetable only, which
 * ignores the 24h schedule TTL and takes ~3s where the full sync took ~30s.
 *
 * Its own copy, not `course.freshness.refresh`: that one reads "Obnovit
 * soubory" / "Refresh files", which is a lie on the calendar.
 */
export function RefreshButton({
  label,
  refreshing,
  onRefresh,
}: {
  label: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const isTouch = useAppStore((s) => s.isTouch);
  if (!isTouch) {
    return (
      <button
        type="button"
        onClick={() => onRefresh()}
        disabled={refreshing}
        aria-label={label}
        title={label}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-base-300 bg-base-100 disabled:opacity-60"
      >
        <RefreshCw size={18} className={refreshing ? 'animate-spin' : undefined} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onRefresh()}
      disabled={refreshing}
      aria-label={label}
      // Revealed on keyboard focus: an iPad with a keyboard can tab onto it,
      // and an invisible focused control is a dead end for a sighted user.
      className="sr-only self-start rounded-full text-sm font-semibold text-base-content focus-visible:not-sr-only focus-visible:bg-base-200 focus-visible:px-3 focus-visible:py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {label}
    </button>
  );
}

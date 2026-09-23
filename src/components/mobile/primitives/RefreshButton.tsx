/**
 * A screen's refresh for whoever cannot pull: screen-reader only. The calendar
 * and exams each pass their own label, action and flag.
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
  return (
    <button
      type="button"
      onClick={() => onRefresh()}
      disabled={refreshing}
      aria-label={label}
      className="sr-only"
    >
      {label}
    </button>
  );
}

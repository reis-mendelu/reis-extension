const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "před 5 minutami" / "2 days ago" for how long ago something was fetched.
 *
 * Empty under a minute: every caller shows its own "just now" wording there,
 * and "před 0 minutami" reads as a bug. Lifted out of `ExamsFreshness` and
 * `FilesFreshness`, which each carried an identical private copy, when the
 * phone's exam refresh became the third caller.
 */
export function relativeTime(deltaMs: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (deltaMs < MINUTE) return '';
  if (deltaMs < HOUR) return rtf.format(-Math.round(deltaMs / MINUTE), 'minute');
  if (deltaMs < DAY) return rtf.format(-Math.round(deltaMs / HOUR), 'hour');
  return rtf.format(-Math.round(deltaMs / DAY), 'day');
}

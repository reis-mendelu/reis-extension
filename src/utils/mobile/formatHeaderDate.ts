/**
 * "Pátek 4. září" — the phone's screen and sheet headers.
 *
 * `locale` is a BCP-47 tag, not the app's language code: this hands the value
 * straight to `Intl`, so the caller converts (`language === 'cz' ? 'cs' : language`)
 * at the boundary.
 *
 * Czech renders the weekday lower-case; it leads a header here, so the first
 * letter is raised.
 *
 * The calendar asks for a `short` weekday ("Čt 26. listopadu"): beside three
 * header actions the long form was cut to an ellipsis on half the weekdays at
 * 375px, before the return-to-today glyph took its share of the line too.
 */
export function formatHeaderDate(
  date: Date,
  locale: string,
  weekday: 'long' | 'short' = 'long'
): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday,
    day: 'numeric',
    month: 'long',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

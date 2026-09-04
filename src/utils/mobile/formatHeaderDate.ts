/**
 * "Pátek 4. září" — the phone's screen and sheet headers.
 *
 * `locale` is a BCP-47 tag, not the app's language code: this hands the value
 * straight to `Intl`, so the caller converts (`language === 'cz' ? 'cs' : language`)
 * at the boundary.
 *
 * Czech renders the weekday lower-case; it leads a header here, so the first
 * letter is raised.
 */
export function formatHeaderDate(date: Date, locale: string): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

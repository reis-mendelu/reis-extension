/** Midnight of the day `d` falls on. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "08:00" → "8:00". IS pads the hour; the design does not. */
export function trimHour(time: string): string {
  return time.replace(/^0/, '');
}

/**
 * "út 21. 7." — short weekday, then day and month with the Czech trailing dots.
 *
 * The weekday comes from `Intl`, so Czech gets "út" and English "Tue" without a
 * hand-maintained name table. The numeric part is built by hand rather than
 * with `toLocaleDateString`, because every locale renders the separators its
 * own way and this layout is fixed by the design.
 */
export function formatDayMonth(date: Date, locale: string): string {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    .format(date)
    .replace(/\.$/, '');
  return `${weekday} ${formatDayMonthBare(date)}`;
}

/** "21. 9." — the same numerals without the weekday, for the places that sit
 *  beside a date which already names the day. */
export function formatDayMonthBare(date: Date): string {
  return `${date.getDate()}. ${date.getMonth() + 1}.`;
}

/** The list row's right column: "po 27. 7. 9:00" — no separator before the time. */
export function formatWhenRow(date: Date, time: string, locale: string): string {
  return `${formatDayMonth(date, locale)} ${trimHour(time)}`;
}

/**
 * Everything except the exams whose day is already over.
 *
 * IS keeps a registered exam on the list after it has been sat, until it is
 * graded. Left in, it took a tile in the registered strip as if it were still
 * ahead, and its card offered "Odhlásit" for something that had happened.
 * Hidden rather than grouped — the student's call.
 *
 * By day, not by start time: on the day itself the room and time are exactly
 * what a student needs, late or not.
 */
export function dropFinished<T>(items: T[], dateOf: (item: T) => Date, now: Date): T[] {
  const today = startOfDay(now).getTime();
  return items.filter((item) => startOfDay(dateOf(item)).getTime() >= today);
}

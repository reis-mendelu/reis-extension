/**
 * The date range a strip of days covers, as one short string.
 *
 * The phone's day strip had no label at all: five chips changed under a `>`
 * and the student was left to infer that a week had passed — "switching to the
 * next week has a small '>' button. It feels a bit unintuitive". A control that
 * does not say what it changed cannot teach the gesture that changes it.
 *
 * Kept separate from the teaching-week number, which comes from IS and may be
 * absent; this part is derivable from the days themselves and so is always
 * available.
 */

/**
 * "1.–5. 9." within one month, "29. 9. – 3. 10." across two.
 *
 * The month is said ONCE where it can be: at 320px the eyebrow shares its line
 * with nothing, but it is still a `truncate`, and "1. 9. – 5. 9." spends eight
 * characters repeating a month the reader can already see in the title.
 *
 * `cs` builds the string by hand rather than through `formatRange`, because
 * Intl's Czech range separator is a plain hyphen with no spaces ("1.9.–5.9.")
 * and the abbreviated Czech date convention wants a space after each dot.
 */
export function weekRangeLabel(days: readonly Date[], locale: string): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return '';

  if (locale.startsWith('cs')) {
    const d = (x: Date) => `${x.getDate()}.`;
    const dm = (x: Date) => `${x.getDate()}. ${x.getMonth() + 1}.`;
    return first.getMonth() === last.getMonth()
      ? `${d(first)}–${dm(last)}`
      : `${dm(first)} – ${dm(last)}`;
  }

  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  return first.getMonth() === last.getMonth()
    ? `${new Intl.DateTimeFormat(locale, { month: 'short' }).format(first)} ${first.getDate()}–${last.getDate()}`
    : `${fmt.format(first)} – ${fmt.format(last)}`;
}

/**
 * The eyebrow line: the teaching week, then the dates.
 *
 * The week NUMBER leads because it is the unit MENDELU students actually use —
 * assignments are set "in week 9", and IS's own overview is a table of them.
 * The desktop header has shown it beside the calendar all along
 * (`teachingWeek.label`); the phone is simply catching up, the same way it did
 * with the holidays, the fail rates and the teaching period.
 *
 * `week` is null outside the teaching period and whenever IS's table has not
 * arrived, and then this says only the dates — a missing fetch must not be
 * reported as "no teaching this week".
 */
export function weekEyebrow(weekLabel: string | null, range: string): string {
  if (!weekLabel) return range;
  if (!range) return weekLabel;
  return `${weekLabel} · ${range}`;
}

/**
 * A week as a date range: "12.–16. 10." (the Týden title) or "12.–16. října"
 * (the menu sheet's subtitle).
 *
 * Czech is built by hand. `Intl`'s `formatRange` for `cs` returns "12. 10. –
 * 16. 10." for numeric months and, oddly, the same numeric form for long ones,
 * so neither reads as a Czech range. English uses en-GB's range, which puts the
 * day first ("12 – 16 Oct"): en-US's "10/12" reads as 10 December in Europe,
 * and the EN UI's readers are mostly exchange students from there.
 *
 * Numeric is for the calendar title: it sits beside four header actions, and
 * "Po 30. listopadu" with the chef hat fit 105 of 2026's 261 weekdays at 390px.
 */
export function formatWeekRange(
  first: Date,
  last: Date,
  language: 'cz' | 'en',
  month: 'numeric' | 'long'
): string {
  if (language === 'en') {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: month === 'numeric' ? 'short' : 'long',
    }).formatRange(first, last);
  }
  const sameMonth = first.getMonth() === last.getMonth();
  if (month === 'numeric') {
    const m = (d: Date) => `${d.getMonth() + 1}.`;
    return sameMonth
      ? `${first.getDate()}.–${last.getDate()}. ${m(last)}`
      : `${first.getDate()}. ${m(first)} – ${last.getDate()}. ${m(last)}`;
  }
  // "16. října": the genitive month, as Czech writes a date.
  const long = new Intl.DateTimeFormat('cs', { day: 'numeric', month: 'long' });
  return sameMonth
    ? `${first.getDate()}.–${long.format(last)}`
    : `${long.format(first)} – ${long.format(last)}`;
}

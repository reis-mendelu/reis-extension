/**
 * Small date helpers for the demo dataset.
 *
 * Deliberately not imported from scripts/lib/fixtureRebase.ts: that module is
 * dev-tooling and importing it into src/ would ship script code in the
 * production bundle. Same two IS Mendelu formats and the same reasoning apply
 * though — exam terms and schedule lessons are computed relative to "now"
 * rather than committed as absolute dates, because a fixed date is only ever
 * close to today for a few weeks, and this dataset ships in the App Store
 * binary and stays there for however long a release lives.
 */

const p = (n: number) => String(n).padStart(2, '0');

/** IS Mendelu's exam-term date format: "DD.MM.YYYY". */
export function formatIsDate(d: Date): string {
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/**
 * IS Mendelu's schedule-lesson date format: "YYYYMMDD". Kept distinct from
 * formatIsDate on purpose — `buildDayAgenda` compares a lesson's `date`
 * field against this compact form directly, so a lesson stamped with the
 * term format would silently never match any day.
 */
export function formatCompactIsDate(d: Date): string {
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** Add (or subtract, for a negative count) whole days from a date. */
export function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

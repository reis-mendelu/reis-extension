/**
 * Has teaching actually started yet?
 *
 * The subjects card asserted "právě běží" unconditionally, which is a claim and
 * not a fact: a student looking at the app in the week before term saw their
 * enrolled subjects announced as already running. "Pridat jestli uz zacal
 * semestr" is the request to stop guessing and say which it is.
 *
 * Derived from the schedule rather than from a calendar rule, because the rule
 * would be a second guess. `syncSchedule` stores the WHOLE semester in one go,
 * so the earliest lesson in it is the day teaching begins — no hardcoded
 * mid-September date to drift, and it is automatically right for a faculty or
 * a year that starts on a different day.
 */

/** A lesson, reduced to the only field this needs. IS format: YYYYMMDD. */
export interface DatedLesson {
  date: string;
}

/** Compact IS date (YYYYMMDD) → Date at local midnight, or null if unparseable. */
export function fromCompact(date: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(date);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m) - 1;
  const day = Number(d);
  // setFullYear rather than the constructor: `new Date(99, 0, 1)` is 1999, not
  // year 99 — the two-digit-year legacy — and the round-trip below cannot catch
  // it, since the month and date survive that shift untouched while only the
  // year moves.
  const parsed = new Date(2000, month, day);
  parsed.setFullYear(year);
  // Rejects 20261332 and friends: the Date constructor rolls those over
  // silently, and a rolled-over date would move the term start.
  return parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day
    ? parsed
    : null;
}

/** The first teaching day in the stored semester, or null when nothing is stored. */
export function semesterStart(schedule: readonly DatedLesson[]): Date | null {
  let earliest: Date | null = null;
  for (const lesson of schedule) {
    const date = fromCompact(lesson.date);
    if (date && (earliest === null || date < earliest)) earliest = date;
  }
  return earliest;
}

export type SemesterProgress =
  | { state: 'running' }
  /** Teaching has not begun; `start` is the first lesson's day. */
  | { state: 'upcoming'; start: Date }
  /** No schedule to reason from — say nothing rather than guess. */
  | { state: 'unknown' };

export function semesterProgress(
  schedule: readonly DatedLesson[],
  now: Date = new Date()
): SemesterProgress {
  const start = semesterStart(schedule);
  if (!start) return { state: 'unknown' };
  // Compared at day granularity: a lesson at 09:00 still means term started
  // today when the student looks at 08:00.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today < start ? { state: 'upcoming', start } : { state: 'running' };
}

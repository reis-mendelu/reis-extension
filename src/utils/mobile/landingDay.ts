import type { TeachingWeekData } from '../../api/teachingWeek';
import { semesterStart, type DatedLesson } from './semesterStart';
import { isOutsideTeaching } from './teachingPeriod';
import { toIso } from './weekDays';

/**
 * Which day the phone's calendar opens on when the student has not chosen one.
 *
 * Today, except before term — then the first teaching day. Saying "Výuka
 * začíná 21. 9." under an empty agenda is true and still leaves the student on
 * a screen with nothing in it: "it looks to people like their calendar is
 * broken". Landing on the day the schedule actually starts answers the same
 * question with the schedule itself.
 *
 * TWO conditions, and the first is the one that matters. `semesterStart` is the
 * earliest lesson in THIS student's schedule, which is not the same fact as
 * "term has not begun": a student whose first class is Wednesday, looking on
 * the Monday term began, would be thrown forward two days off a real teaching
 * day. So IS's own teaching-week table decides WHETHER to move, exactly as it
 * does for the empty-day copy, and the schedule only supplies WHERE to.
 *
 * Falls back to today on every uncertainty — a null week table (fetch still in
 * flight), an empty schedule, or a first lesson already in the past. Moving a
 * student to another week is a visible surprise, so it happens only when both
 * sources agree.
 */
export function defaultCalendarDay(
  schedule: readonly DatedLesson[],
  teachingWeekData: TeachingWeekData | null | undefined,
  now: Date = new Date()
): string {
  const todayIso = toIso(now);
  const firstTeachingDay = semesterStart(schedule);
  const firstTeachingDayIso = firstTeachingDay ? toIso(firstTeachingDay) : null;
  // ISO dates compare lexicographically, which for YYYY-MM-DD is chronological.
  return firstTeachingDayIso &&
    firstTeachingDayIso > todayIso &&
    isOutsideTeaching(teachingWeekData, new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    ? firstTeachingDayIso
    : todayIso;
}

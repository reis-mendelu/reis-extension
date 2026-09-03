import { getWeekForDate, type TeachingWeekData } from '../../api/teachingWeek';

/**
 * Whether a day falls outside the semester's teaching period.
 *
 * The same question the desktop calendar asks, from the same store field and
 * the same function — `WeeklyCalendar/useCalendarData` has computed
 * `isOutsideTeachingPeriod` this way all along, and the phone simply never
 * asked. So before term the phone answered an empty week with "Nic nemáš,
 * pohodička", which reads as "you happen to be free" when the truth is "there
 * is no schedule to see yet".
 *
 * IS's own teaching-week table is the source, not a guess from the earliest
 * stored lesson: it knows the reading weeks, the exam period and the gaps,
 * where the earliest-lesson heuristic only knows where the data starts.
 *
 * Null data means the table has not arrived, and then this claims NOTHING —
 * saying "outside the teaching period" because a fetch is late would be a
 * confident wrong answer, which is worse than the vague one it replaces.
 */
export function isOutsideTeaching(data: TeachingWeekData | null | undefined, day: Date): boolean {
  if (!data) return false;
  return getWeekForDate(data, day) === null;
}

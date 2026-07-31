import type { BlockLesson, HiddenItems } from '../types/calendarTypes';

/**
 * True when a lesson should be hidden from the calendar, per the user's
 * `hiddenItems` preferences. A lesson is hidden if:
 * - its `id` is in `hiddenItems.events`, or
 * - its course (`courseCode`) matches a `hiddenItems.courses` entry whose
 *   `type` is either `'all'`/unset, or matches the lesson's own type
 *   (derived from `isSeminar`: `'seminar'` when `'true'`, else `'lecture'`).
 *
 * Pure — no store access, no hooks. Shared by desktop (`useCalendarData`)
 * and mobile (`CalendarScreen`) so the predicate can't drift between them.
 */
export function isLessonHidden(lesson: BlockLesson, hiddenItems: HiddenItems): boolean {
  if (hiddenItems.events.some((e) => e.id === lesson.id)) return true;

  return hiddenItems.courses.some(
    (c) =>
      c.courseCode === lesson.courseCode &&
      (!c.type ||
        c.type === 'all' ||
        (c.type === 'seminar' && lesson.isSeminar === 'true') ||
        (c.type === 'lecture' && lesson.isSeminar === 'false'))
  );
}

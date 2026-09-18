import type { BlockLesson } from '../../types/calendarTypes';

const TOTAL_HOURS = 14; // 7:00–21:00, the grid's vertical span

/** Where the first-run hint should point: a box over one lesson, in grid percent. */
export interface HintTarget {
  top: number;
  left: number;
  width: number;
}

const startsAt = (l: BlockLesson): number => {
  const [h, m] = l.startTime.split(':').map(Number);
  return (h as number) + (m as number) / 60;
};

const endsAt = (l: BlockLesson): number => {
  const [h, m] = l.endTime.split(':').map(Number);
  return (h as number) + (m as number) / 60;
};

const earliest = (lessons: BlockLesson[]): BlockLesson =>
  [...lessons].sort((a, b) => a.startTime.localeCompare(b.startTime))[0] as BlockLesson;

/**
 * Which lesson the CalendarHint points at, and where that lands on the grid.
 *
 * Lifted out of `WeeklyCalendar` so it can be tested: it was an inline `useMemo`
 * that hardcoded five columns in four separate places, and when the grid grew a
 * Saturday for combined-study weeks the hint kept pointing at fifths — at the
 * wrong day on every six-column week, and never at the Saturday lesson itself.
 * `dayCount` is the same `visibleDayCount` the grid and the "now" line use, so
 * the three cannot drift apart again.
 *
 * Preference order: a lesson running right now, then the next one later today,
 * then the earliest lesson of the next drawn day, wrapping inside the week.
 */
export function findHintTarget(
  lessonsByDay: BlockLesson[][],
  todayIndex: number,
  dayCount: number,
  now: Date
): HintTarget | null {
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const columnWidth = 100 / dayCount;
  const todayIsDrawn = todayIndex >= 0 && todayIndex < dayCount;

  let target: BlockLesson | null = null;
  let dayIndex = -1;

  if (todayIsDrawn) {
    const todayLessons = lessonsByDay[todayIndex] ?? [];
    target =
      todayLessons.find((l) => currentHour >= startsAt(l) && currentHour <= endsAt(l)) ?? null;

    if (!target) {
      const later = todayLessons.filter((l) => startsAt(l) > currentHour);
      target = later.length > 0 ? earliest(later) : null;
    }
    if (target) dayIndex = todayIndex;
  }

  if (!target) {
    for (let i = 0; i < dayCount; i++) {
      // Start from tomorrow when today is on the grid, otherwise sweep from Monday.
      const checkIndex = todayIsDrawn ? (todayIndex + 1 + i) % dayCount : i;
      const dayLessons = lessonsByDay[checkIndex] ?? [];
      if (dayLessons.length > 0) {
        target = earliest(dayLessons);
        dayIndex = checkIndex;
        break;
      }
    }
  }

  if (!target || dayIndex === -1) return null;

  const [h, m] = target.startTime.split(':').map(Number);
  return {
    top: ((((h as number) - 7) * 60 + (m as number)) / (TOTAL_HOURS * 60)) * 100,
    left: dayIndex * columnWidth,
    width: columnWidth,
  };
}

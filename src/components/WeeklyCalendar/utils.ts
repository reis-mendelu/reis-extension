import type { BlockLesson, LessonWithRow, OrganizedLessons } from '../../types/calendarTypes';

const TOTAL_HOURS = 14; // 7:00 to 21:00

export const DAYS = [
  { index: 0, short: 'Po', full: 'Pondělí' },
  { index: 1, short: 'Út', full: 'Úterý' },
  { index: 2, short: 'St', full: 'Středa' },
  { index: 3, short: 'Čt', full: 'Čtvrtek' },
  { index: 4, short: 'Pá', full: 'Pátek' },
];

export const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

export function timeToPercent(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const hoursFrom7 = hours - 7;
  const totalMinutesFrom7 = hoursFrom7 * 60 + minutes;
  const totalMinutesInDay = TOTAL_HOURS * 60;
  return (totalMinutesFrom7 / totalMinutesInDay) * 100;
}

/**
 * Shortest block the grid can draw, in minutes of grid space.
 *
 * 90 minutes — the length every exam block used to be assumed to have — because
 * that is the smallest box CalendarEventCard can fill without truncating: it
 * needs room for the type, the subject, the room row and the time row, and it
 * gates the subject/room on `>= 60` on top of that. A real 10-minute oral exam
 * is ~1.2% of a 14-hour day, about 7px, and renders as an unlabelled sliver.
 *
 * Clamping is deliberately layout-only. startTime and endTime stay truthful, so
 * a 12:00 oral exam still reads "12:00 - 12:10" on the card and in its tooltip
 * even though it occupies an hour and a half of grid.
 */
export const MIN_VISUAL_BLOCK_MINUTES = 90;

/** Grid space a block actually occupies — its real length, floored for legibility. */
export function renderedBlockMinutes(startTime: string, endTime: string): number {
  return Math.max(timeToMinutes(endTime) - timeToMinutes(startTime), MIN_VISUAL_BLOCK_MINUTES);
}

export function getEventStyle(startTime: string, endTime: string): { top: string; height: string } {
  return {
    top: `${timeToPercent(startTime)}%`,
    height: `${(renderedBlockMinutes(startTime, endTime) / (TOTAL_HOURS * 60)) * 100}%`,
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function organizeLessons(lessons: BlockLesson[]): OrganizedLessons {
  if (!lessons || lessons.length === 0) return { lessons: [], totalRows: 1 };

  // Filter out invalid lessons and sort
  const sortedLessons = [...lessons]
    .filter((l) => l.startTime && l.endTime)
    .sort((a, b) => {
      const startA = timeToMinutes(a.startTime);
      const startB = timeToMinutes(b.startTime);
      if (startA !== startB) return startA - startB;
      return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
    });

  if (sortedLessons.length === 0) return { lessons: [], totalRows: 1 };

  const clusters: LessonWithRow[][] = [];
  let currentCluster: LessonWithRow[] = [];
  let maxEndInCluster = 0;
  let rows: number[] = [];

  sortedLessons.forEach((lesson) => {
    const start = timeToMinutes(lesson.startTime);
    const end = timeToMinutes(lesson.endTime);

    // Skip invalid times
    if (isNaN(start) || isNaN(end)) return;

    // If this lesson starts after all previous lessons in the cluster have ended,
    // it starts a new cluster.
    if (start >= maxEndInCluster && currentCluster.length > 0) {
      clusters.push(currentCluster);
      currentCluster = [];
      maxEndInCluster = 0;
      rows = [];
    }

    let placed = false;
    // Try to place in an existing row
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] <= start) {
        rows[i] = end;
        const lessonWithRow = { ...lesson, row: i, maxColumns: 0 };
        currentCluster.push(lessonWithRow);
        placed = true;
        break;
      }
    }

    // Create a new row if not placed
    if (!placed) {
      rows.push(end);
      const lessonWithRow = { ...lesson, row: rows.length - 1, maxColumns: 0 };
      currentCluster.push(lessonWithRow);
    }

    maxEndInCluster = Math.max(maxEndInCluster, end);
  });

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  let globalMaxRows = 1;
  clusters.forEach((cluster) => {
    const maxLanes = Math.max(...cluster.map((l) => l.row + 1));
    cluster.forEach((l) => {
      l.maxColumns = maxLanes;
    });
    globalMaxRows = Math.max(globalMaxRows, maxLanes);
  });

  return {
    lessons: clusters.flat(),
    totalRows: globalMaxRows,
  };
}

import type { BlockLesson, LessonWithRow, OrganizedLessons } from '../../types/calendarTypes';

const GRID_START_HOUR = 7;
const TOTAL_HOURS = 14; // 7:00 to 21:00

export const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

export function timeToPercent(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const hoursFrom7 = hours - GRID_START_HOUR;
  const totalMinutesFrom7 = hoursFrom7 * 60 + minutes;
  const totalMinutesInDay = TOTAL_HOURS * 60;
  return (totalMinutesFrom7 / totalMinutesInDay) * 100;
}

/**
 * Shortest block the grid draws, in minutes of grid space.
 *
 * Under every lesson: IS teaches in 50-minute hours, so nothing a student is
 * taught is ever floored, and a lesson's block ends exactly on its end time.
 * It was 90 until "Hodinové přednášky jsou zobrazované jako že mají hodinu a
 * půl" — a 14:00-14:50 lesson drawn down to 15:30. What is still this short is
 * an oral-exam slot (a real 10 minutes is ~7px), and 45 is one line of text:
 * the card's one-line layout needs about 28px, and an hour is ~41px.
 *
 * Clamping is layout only. startTime and endTime stay truthful, so a 12:00 oral
 * exam still reads "12:00 - 12:10" on the card and in its tooltip.
 */
export const MIN_BLOCK_MINUTES = 45;

/**
 * Grid space a block occupies: its real length, raised to MIN_BLOCK_MINUTES.
 *
 * `Math.max` keeps the real length whenever it is longer, so a block that
 * genuinely runs past the next one still does, and still gets its own lane.
 */
export function renderedBlockMinutes(startTime: string, endTime: string): number {
  const real = timeToMinutes(endTime) - timeToMinutes(startTime);
  // The grid stops at 21:00 and the calendar is overflow-hidden, so a floor
  // applied blindly to a 20:40 block would push the card off the bottom and
  // clip it. Shorten the floor to what is left of the grid — but never below
  // the real length, so a genuinely long late event still runs over.
  const toGridEnd = TOTAL_HOURS * 60 - (timeToMinutes(startTime) - GRID_START_HOUR * 60);
  return Math.max(real, Math.min(MIN_BLOCK_MINUTES, toGridEnd));
}

export function getEventStyle(startTime: string, endTime: string): { top: string; height: string } {
  return styleFromMinutes(startTime, renderedBlockMinutes(startTime, endTime));
}

/**
 * The style for a block whose occupied space is already known.
 *
 * `organizeLessons` works it out to assign lanes; the day column draws from the
 * same number rather than recomputing it. Two copies of this rule are what let
 * the lanes and the heights disagree in the first place.
 */
export function styleFromMinutes(
  startTime: string,
  minutes: number
): { top: string; height: string } {
  return {
    top: `${timeToPercent(startTime)}%`,
    height: `${(minutes / (TOTAL_HOURS * 60)) * 100}%`,
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
      return (
        renderedBlockMinutes(a.startTime, a.endTime) - renderedBlockMinutes(b.startTime, b.endTime)
      );
    });

  if (sortedLessons.length === 0) return { lessons: [], totalRows: 1 };

  const clusters: LessonWithRow[][] = [];
  let currentCluster: LessonWithRow[] = [];
  let maxEndInCluster = 0;
  let rows: number[] = [];

  sortedLessons.forEach((lesson) => {
    const start = timeToMinutes(lesson.startTime);
    // The space the block OCCUPIES, not when it ends. A short exam slot is
    // floored to MIN_BLOCK_MINUTES, so laying lanes out by the true end would
    // let it sit in the same lane as a lesson ten minutes later and cover it.
    // `lesson.endTime` is untouched — the card and its tooltip read the real time.
    const renderedMinutes = renderedBlockMinutes(lesson.startTime, lesson.endTime);
    const end = start + renderedMinutes;

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
        const lessonWithRow = { ...lesson, row: i, maxColumns: 0, renderedMinutes };
        currentCluster.push(lessonWithRow);
        placed = true;
        break;
      }
    }

    // Create a new row if not placed
    if (!placed) {
      rows.push(end);
      const lessonWithRow = { ...lesson, row: rows.length - 1, maxColumns: 0, renderedMinutes };
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

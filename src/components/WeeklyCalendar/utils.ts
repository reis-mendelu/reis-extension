import type { BlockLesson, LessonWithRow, OrganizedLessons } from '../../types/calendarTypes';

const GRID_START_HOUR = 7;
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
  const hoursFrom7 = hours - GRID_START_HOUR;
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

/**
 * Grid space a block actually occupies — its real length, floored for
 * legibility, and stopped at whatever comes next.
 *
 * `nextStartTime` is the start of the following block on the same day. Without
 * it the floor invented clashes: a 14:00-14:50 lesson was drawn down to 15:30,
 * so a 15:00 lesson read as overlapping and the two were squeezed into
 * half-width columns — side by side, over a gap of ten minutes, with nothing in
 * the data to justify it. The floor is for legibility; it has no business
 * changing what the day looks like it contains.
 *
 * `Math.max(real, …)` keeps a REAL clash real: a block that genuinely runs past
 * the next one still does, and still gets its own lane.
 */
export function renderedBlockMinutes(
  startTime: string,
  endTime: string,
  nextStartTime?: string
): number {
  const real = timeToMinutes(endTime) - timeToMinutes(startTime);
  // The grid stops at 21:00 and the calendar is overflow-hidden, so a floor
  // applied blindly to a 20:30 block would push the card off the bottom and
  // clip the very thing it was widening for legibility. Shorten the floor to
  // what is left of the grid — but never below the real length, so a genuinely
  // long late event still runs over exactly as it did before any floor existed.
  const toGridEnd = TOTAL_HOURS * 60 - (timeToMinutes(startTime) - GRID_START_HOUR * 60);
  const toNext = nextStartTime
    ? timeToMinutes(nextStartTime) - timeToMinutes(startTime)
    : Number.POSITIVE_INFINITY;
  return Math.max(real, Math.min(MIN_VISUAL_BLOCK_MINUTES, toGridEnd, toNext));
}

export function getEventStyle(
  startTime: string,
  endTime: string,
  nextStartTime?: string
): { top: string; height: string } {
  return styleFromMinutes(startTime, renderedBlockMinutes(startTime, endTime, nextStartTime));
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

  sortedLessons.forEach((lesson, i) => {
    const start = timeToMinutes(lesson.startTime);
    // The space the block OCCUPIES, not when it ends. getEventStyle floors a
    // short block's height for legibility, so laying lanes out by the true end
    // let a 10-minute exam drawn down to 13:30 sit in the same lane as a 12:30
    // lesson and cover it. `lesson.endTime` is untouched — the card and its
    // tooltip still read the real time.
    const renderedMinutes = renderedBlockMinutes(
      lesson.startTime,
      lesson.endTime,
      sortedLessons[i + 1]?.startTime
    );
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

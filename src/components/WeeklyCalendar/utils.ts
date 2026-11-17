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
 * taught is ever raised, and a lesson's block ends exactly on its end time.
 * The floor was 90 for everything until "Hodinové přednášky jsou zobrazované
 * jako že mají hodinu a půl" — a 14:00-14:50 lesson drawn down to 15:30. What
 * this still raises is a custom event, which can be 15 minutes. One line of the
 * card's text needs about 30px with its padding and border; 45 minutes is 38px
 * on an 844px-tall window, 30px at 700 and 25px at 600, where the text still
 * shows whole (measured; 30 minutes was 20px at 700 and cut the line).
 */
export const MIN_BLOCK_MINUTES = 45;

/**
 * The shortest block that holds the card's two lines — the title, then the
 * room and the time: about 56px, which 90 minutes is from a 700px-tall window
 * up. CalendarEventCard switches layouts on it; anything shorter gets the
 * one-line card, which still prints the real start and end.
 */
export const TWO_LINE_BLOCK_MINUTES = 90;

/**
 * Grid space a block occupies: its real length, raised to MIN_BLOCK_MINUTES.
 *
 * One floor for everything, exams included. Exams had their own 90-minute
 * floor (room for the two-line card) until "zkouška vypadá, že trvá déle (i
 * když jen 25 min)": a 25-minute test at 11:00 was drawn down to 12:30, so the
 * block lied about the one thing a calendar shows. A short exam now gets the
 * one-line card with its real time, like a short custom event.
 *
 * `Math.max` keeps the real length whenever it is longer, so a block that
 * genuinely runs past the next one still does, and still gets its own lane.
 */
export function renderedBlockMinutes(startTime: string, endTime: string): number {
  const real = timeToMinutes(endTime) - timeToMinutes(startTime);
  // The grid stops at 21:00 and the calendar is overflow-hidden, so a floor
  // applied blindly to a 20:40 block would push the card off the bottom and
  // clip it. Shorten the floor to what is left of the grid — but never below
  // the real length, so a genuinely long late event still runs over. A block
  // after 20:15 therefore gets less than its floor (a 20:40 slot is one clipped
  // line); that is accepted, since moving its top would put it at the wrong time.
  const toGridEnd = TOTAL_HOURS * 60 - (timeToMinutes(startTime) - GRID_START_HOUR * 60);
  return Math.max(real, Math.min(MIN_BLOCK_MINUTES, toGridEnd));
}

/**
 * The style for a block, from the space `organizeLessons` gave it.
 *
 * The lanes and the day column read the same number rather than each working it
 * out. Two copies of this rule are what let the lanes and the heights disagree
 * in the first place.
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
    // The space the block OCCUPIES, not when it ends. A 15-minute slot is drawn
    // for MIN_BLOCK_MINUTES, so laying lanes out by the true end would let it
    // sit in the same lane as a lesson twenty minutes later and cover it.
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

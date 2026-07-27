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

// Shortest block the grid can draw and still show the card's text. A 10-minute
// oral exam is only ~1.2% of a 14-hour day — about 7px — which clips the subject,
// room and teacher entirely. Clamping is deliberately layout-only: startTime and
// endTime stay truthful everywhere else (card label, tooltip, overlap math), so
// a 09:45 exam still reads "09:45 - 09:55".
const MIN_VISUAL_BLOCK_MINUTES = 30;

export function getEventStyle(startTime: string, endTime: string): { top: string; height: string } {
    const topPercent = timeToPercent(startTime);
    const bottomPercent = timeToPercent(endTime);
    const minHeightPercent = (MIN_VISUAL_BLOCK_MINUTES / (TOTAL_HOURS * 60)) * 100;
    return {
        top: `${topPercent}%`,
        height: `${Math.max(bottomPercent - topPercent, minHeightPercent)}%`,
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
        .filter(l => l.startTime && l.endTime)
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

    sortedLessons.forEach(lesson => {
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
    clusters.forEach(cluster => {
        const maxLanes = Math.max(...cluster.map(l => l.row + 1));
        cluster.forEach(l => {
            l.maxColumns = maxLanes;
        });
        globalMaxRows = Math.max(globalMaxRows, maxLanes);
    });

    return {
        lessons: clusters.flat(), 
        totalRows: globalMaxRows 
    };
}

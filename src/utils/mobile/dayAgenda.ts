import type { BlockLesson } from '../../types/calendarTypes';

export type AgendaRow =
    | { type: 'event'; lesson: BlockLesson }
    | { type: 'gap'; minutes: number };

/** A break shorter than this reads as a normal changeover, not free time. */
const GAP_THRESHOLD_MINUTES = 60;

function minutesOfDay(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

/** "2026-04-20" → "20260420" */
function compactFromIso(iso: string): string {
    return iso.replace(/-/g, '');
}

/**
 * The day list: lessons in start order, with "2 h volno" markers between
 * blocks that are far enough apart to be worth walking home for.
 */
export function buildDayAgenda(lessons: BlockLesson[], dayIso: string): AgendaRow[] {
    const target = compactFromIso(dayIso);
    const days = lessons
        .filter((l) => l.date === target)
        .sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime));

    const rows: AgendaRow[] = [];
    days.forEach((lesson, i) => {
        if (i > 0) {
            const gap = minutesOfDay(lesson.startTime) - minutesOfDay(days[i - 1]!.endTime);
            if (gap >= GAP_THRESHOLD_MINUTES) rows.push({ type: 'gap', minutes: gap });
        }
        rows.push({ type: 'event', lesson });
    });
    return rows;
}

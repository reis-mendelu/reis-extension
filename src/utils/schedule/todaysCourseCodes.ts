import type { BlockLesson } from '../../types/schedule';

/**
 * Returns the distinct course codes that appear in `blockLessons` for the given
 * local calendar day. Format of `BlockLesson.date` is YYYYMMDD.
 */
export function todaysCourseCodes(blockLessons: BlockLesson[], now: Date = new Date()): Set<string> {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}${m}${d}`;
    const codes = new Set<string>();
    for (const lesson of blockLessons) {
        if (lesson.date !== today) continue;
        if (!lesson.courseCode) continue;
        codes.add(lesson.courseCode);
    }
    return codes;
}

import { IndexedDBService } from '../../../services/storage';
import { logError } from '../../../utils/reportError';
import type { Classmate } from '../../../types/classmates';
import type { ExamSubject } from '../../../types/exams';

interface FetchAllInput {
    exams: ExamSubject[] | null;
}

/**
 * Returns the set of registered-term IDs across an exam list. Skips synthetic
 * "open" rows (ids with '-') and entries without an id — those don't have a
 * spoluzaci page to fetch.
 */
function collectTerminIds(exams: ExamSubject[]): string[] {
    const ids = new Set<string>();
    for (const sub of exams) {
        for (const sec of sub.sections) {
            const tid = sec.registeredTerm?.id;
            if (!tid || tid.includes('-')) continue;
            ids.add(tid);
        }
    }
    return Array.from(ids);
}

/**
 * Returns null when exams are unknown (cold boot). Callers MUST skip set()
 * in that case — an empty map would clobber concurrent writes.
 */
export async function loadAllExamClassmatesFromCache(
    { exams }: FetchAllInput,
): Promise<Record<string, Classmate[]> | null> {
    try {
        const list = exams
            ?? ((await IndexedDBService.get('exams', 'current')) as ExamSubject[] | null);
        const terminIds = list ? collectTerminIds(list) : [];
        if (terminIds.length === 0) return null;

        const entries = await Promise.all(
            terminIds.map(async (tid) =>
                [tid, await IndexedDBService.get('classmates', `exam:${tid}`)] as const,
            ),
        );

        const map: Record<string, Classmate[]> = {};
        for (const [tid, value] of entries) {
            if (Array.isArray(value)) map[tid] = value as Classmate[];
        }
        return map;
    } catch (e) {
        logError('ExamClassmatesSlice.loadAllExamClassmatesFromCache', e);
        return null;
    }
}

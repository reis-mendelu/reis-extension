import { fetchTermDuration } from '../../api/termDuration';
import { logError } from '../../utils/reportError';
import type { ExamSubject } from '../../types/exams';

/**
 * Attach "Délka trvání akce" to every registered exam term.
 *
 * Runs in the content script (the only context with IS cookies) right after the
 * exam list syncs, so the weekly calendar can size an exam block from the real
 * length instead of assuming 90 minutes.
 *
 * Only registered terms are enriched — they are the only ones the calendar
 * renders, and a student holds a handful of them per semester, so this costs a
 * few requests rather than one per available term.
 */

// IS Mendelu sees a burst of parallel detail-page hits as unfriendly; the
// on-demand Poznámka path in createExamSlice caps itself the same way.
const MAX_CONCURRENT = 3;

/** Map termId → durationMinutes for every registered term already carrying one. */
function cachedDurations(exams: ExamSubject[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const subject of exams) {
        for (const section of subject.sections) {
            const term = section.registeredTerm;
            if (term?.id && typeof term.durationMinutes === 'number') {
                map.set(term.id, term.durationMinutes);
            }
        }
    }
    return map;
}

async function runCapped(tasks: (() => Promise<void>)[]): Promise<void> {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, tasks.length) }, async () => {
        while (cursor < tasks.length) {
            const task = tasks[cursor++];
            await task();
        }
    });
    await Promise.all(workers);
}

/**
 * Returns a copy of `exams` with `registeredTerm.durationMinutes` populated.
 *
 * A duration is static once IS publishes it, so any value already present in
 * `cachedExams` is reused and never refetched — no TTL bookkeeping needed, and
 * a term that failed last time is simply retried on the next sync.
 *
 * Never throws: a per-term failure (expired session, DOM drift) leaves that
 * term without a duration, and the calendar falls back to its 90-minute
 * default. Sync must not fail because an exam length could not be read.
 */
export async function enrichExamsWithDurations(
    exams: ExamSubject[],
    cachedExams: ExamSubject[],
    studiumId: string,
    obdobiId: string,
): Promise<ExamSubject[]> {
    if (!studiumId || !obdobiId) return exams;

    const known = cachedDurations(cachedExams);
    const resolved = new Map<string, number>(known);
    const pending: string[] = [];

    for (const subject of exams) {
        for (const section of subject.sections) {
            const term = section.registeredTerm;
            if (section.status !== 'registered' || !term?.id) continue;
            if (resolved.has(term.id) || pending.includes(term.id)) continue;
            pending.push(term.id);
        }
    }

    await runCapped(
        pending.map((terminId) => async () => {
            try {
                const minutes = await fetchTermDuration(terminId, studiumId, obdobiId);
                if (minutes !== null) resolved.set(terminId, minutes);
            } catch (e) {
                logError('Sync.enrichExamsWithDurations', e, { terminId });
            }
        }),
    );

    return exams.map((subject) => ({
        ...subject,
        sections: subject.sections.map((section) => {
            const term = section.registeredTerm;
            if (!term?.id) return section;
            const minutes = resolved.get(term.id);
            if (minutes === undefined) return section;
            return { ...section, registeredTerm: { ...term, durationMinutes: minutes } };
        }),
    }));
}

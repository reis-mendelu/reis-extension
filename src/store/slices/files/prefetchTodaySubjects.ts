import type { BlockLesson } from '../../../types/schedule';
import { todaysCourseCodes } from '../../../utils/schedule/todaysCourseCodes';

export const PREFETCH_STALE_MS = 60_000;
export const PREFETCH_MAX = 6;

interface PrefetchInput {
    schedule: BlockLesson[];
    lastFilesFetchedAt: Record<string, number>;
    refreshFilesForSubject: (code: string) => Promise<void>;
    now?: number;
}

/**
 * Fires off file refreshes for today's scheduled subjects.
 * Skips subjects whose last fetch is within PREFETCH_STALE_MS, caps total
 * fetches at PREFETCH_MAX, and never throws (callbacks swallow errors).
 * Returns the set of course codes for which a refresh was actually triggered.
 */
export function prefetchTodaySubjectsImpl({
    schedule,
    lastFilesFetchedAt,
    refreshFilesForSubject,
    now = Date.now(),
}: PrefetchInput): Set<string> {
    const codes = todaysCourseCodes(schedule, new Date(now));
    const fired = new Set<string>();
    for (const code of codes) {
        if (fired.size >= PREFETCH_MAX) break;
        const last = lastFilesFetchedAt[code];
        if (last && now - last < PREFETCH_STALE_MS) continue;
        fired.add(code);
        refreshFilesForSubject(code).catch(() => {});
    }
    return fired;
}

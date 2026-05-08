import pLimit from 'p-limit';
import { fetchSubjectZaznamnik } from '../../api/zaznamnik';
import type { SubjectZaznamnik } from '../../types/zaznamnik';

// Domain-specific cap: each call fans out to PH + VT (2 fetches), so 2 in flight = 4 sockets.
const zaznamnikLimit = pLimit(2);

export interface ZaznamnikSyncInput {
    courseCode: string;
    subjectId: string;
    hasPrubezne?: boolean;
    hasTest?: boolean;
}

export async function syncZaznamnik(
    studium: string,
    obdobi: string,
    inputs: ZaznamnikSyncInput[],
): Promise<Record<string, SubjectZaznamnik | null>> {
    const result: Record<string, SubjectZaznamnik | null> = {};
    await Promise.all(
        inputs
            .filter(i => i.subjectId && (i.hasPrubezne || i.hasTest))
            .map(i => zaznamnikLimit(async () => {
                try {
                    result[i.courseCode] = await fetchSubjectZaznamnik(studium, obdobi, i.subjectId);
                } catch {
                    // Swallow per-subject failures — partial map is fine, merge guard prevents overwrite
                }
            }))
    );
    return result;
}

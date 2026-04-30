import { fetchPastSemesterData } from '../../api/subjects';
import { IndexedDBService } from '../storage';
import { sendToIframe } from '../../injector/iframeManager';
import { Messages } from '../../types/messages';
import type { AvailablePeriod, SubjectAttendance, SubjectsData } from '../../types/documents';
import type { SyncedData } from '../../types/messages/base';

const META_KEY_PREFIX = 'past_semester_';

export async function syncPastSemesters(
    studium: string,
    currentObdobi: string,
    allPeriods: AvailablePeriod[],
): Promise<void> {
    const pastPeriods = allPeriods.filter(p => p.id !== currentObdobi);
    if (pastPeriods.length === 0) return;

    const mergedPastAttendance: Record<string, SubjectAttendance[]> = {};

    for (const period of pastPeriods) {
        const cacheKey = `${META_KEY_PREFIX}${period.id}`;

        // Permanent cache — past semesters are immutable facts
        const cached = await IndexedDBService.get('meta', cacheKey) as
            { subjects: SubjectsData; attendance: Record<string, SubjectAttendance[]> } | undefined;

        let subjects: SubjectsData | null = null;
        let attendance: Record<string, SubjectAttendance[]> = {};

        if (cached?.subjects && cached?.attendance) {
            subjects = cached.subjects;
            attendance = cached.attendance;
        } else {
            const result = await fetchPastSemesterData(studium, period.id);
            if (result) {
                subjects = result.subjects;
                attendance = result.attendance;
                await IndexedDBService.set('meta', cacheKey, { subjects, attendance });
            }
        }

        for (const [code, records] of Object.entries(attendance)) {
            if (mergedPastAttendance[code]) {
                mergedPastAttendance[code] = [...mergedPastAttendance[code], ...records];
            } else {
                mergedPastAttendance[code] = records;
            }
        }
    }

    const update: Partial<SyncedData> = {
        pastAttendance: mergedPastAttendance,
        lastSync: Date.now(),
    };

    sendToIframe(Messages.syncUpdate(update as SyncedData));
}

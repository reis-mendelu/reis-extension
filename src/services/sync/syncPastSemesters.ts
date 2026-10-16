import { fetchPastSemesterData } from '../../api/subjects';
import { IndexedDBService } from '../storage';
import { sendToIframe } from '../../injector/iframeManager';
import { Messages } from '../../types/messages';
import type { AvailablePeriod, SubjectAttendance, SubjectsData } from '../../types/documents';
import type { SyncedData } from '../../types/messages/base';

const META_KEY_PREFIX = 'past_semester_';

/**
 * Where a past semester is cached. Per study for a student with several —
 * two studies at one faculty share period ids, and one key per period made
 * every switch refetch and overwrite the lot — and per period alone for
 * everyone else, which is the key every existing install already holds.
 */
export function pastSemesterKey(periodId: string, studium: string, multiStudy: boolean): string {
  return multiStudy ? `${META_KEY_PREFIX}${studium}_${periodId}` : `${META_KEY_PREFIX}${periodId}`;
}

/**
 * Is a cached past semester this study's? The key is the period alone, and a
 * student with two studies at one faculty has the same period ids in both.
 * An entry without a study predates the stamp. It is kept for a student with
 * one study — refetching all of them would put every student's whole past at
 * IS on one boot — but not for one with several, where it may be the other
 * study's (a one-time refetch for those few).
 */
export function pastSemesterIsFor(
  cached: { studium?: string } | undefined,
  studium: string,
  multiStudy: boolean
) {
  if (!cached) return false;
  return cached.studium === undefined ? !multiStudy : cached.studium === studium;
}

export async function syncPastSemesters(
  studium: string,
  currentObdobi: string,
  allPeriods: AvailablePeriod[],
  multiStudy = false
): Promise<void> {
  const pastPeriods = allPeriods.filter((p) => p.id !== currentObdobi);
  if (pastPeriods.length === 0) return;

  const mergedPastAttendance: Record<string, SubjectAttendance[]> = {};

  for (const period of pastPeriods) {
    const cacheKey = pastSemesterKey(period.id, studium, multiStudy);

    // Permanent cache — past semesters are immutable facts
    const cached = (await IndexedDBService.get('meta', cacheKey)) as
      | {
          studium?: string;
          subjects: SubjectsData;
          attendance: Record<string, SubjectAttendance[]>;
        }
      | undefined;

    let subjects: SubjectsData | null = null;
    let attendance: Record<string, SubjectAttendance[]> = {};

    if (cached?.subjects && cached?.attendance && pastSemesterIsFor(cached, studium, multiStudy)) {
      subjects = cached.subjects;
      attendance = cached.attendance;
    } else {
      const result = await fetchPastSemesterData(studium, period.id);
      if (result) {
        subjects = result.subjects;
        attendance = result.attendance;
        await IndexedDBService.set('meta', cacheKey, { studium, subjects, attendance });
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

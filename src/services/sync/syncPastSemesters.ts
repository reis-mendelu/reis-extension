import { fetchPastSemesterData } from '../../api/subjects';
import { IndexedDBService } from '../storage';
import type { AvailablePeriod, SubjectsData } from '../../types/documents';

const META_KEY_PREFIX = 'past_semester_';

/**
 * Caches each past period's subjects, which syncService merges into the subject
 * list on the next sync. Past attendance used to ride along, but no screen has
 * shown it since the study plan redesign, so it is no longer read or sent.
 */
export async function syncPastSemesters(
  studium: string,
  currentObdobi: string,
  allPeriods: AvailablePeriod[]
): Promise<void> {
  for (const period of allPeriods) {
    if (period.id === currentObdobi) continue;
    // The study is part of the key: two studies at one faculty share their
    // obdobi ids, and keyed by the period alone one study's past semesters
    // were served as the other's (see utils/userParams/chooseStudy). Entries
    // from before that are never read again; a study switch clears them.
    const cacheKey = `${META_KEY_PREFIX}${studium}_${period.id}`;

    // Permanent cache — past semesters are immutable facts
    const cached = (await IndexedDBService.get('meta', cacheKey)) as
      { subjects?: SubjectsData } | undefined;
    if (cached?.subjects) continue;

    const subjects = await fetchPastSemesterData(studium, period.id);
    if (subjects) await IndexedDBService.set('meta', cacheKey, { subjects });
  }
}

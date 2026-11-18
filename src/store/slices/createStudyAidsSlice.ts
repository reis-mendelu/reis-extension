import type { AppSlice } from '../types';
import { fetchStudyAids } from '../../api/studyAids';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';

export const STUDY_AIDS_CACHE_KEY = 'study_aids_audiences';

/**
 * Who is shown each study-aids link (`api/studyAids.ts`), on both trees.
 *
 * `studyAids` maps a link's id to its audience tokens and holds only the links
 * the admin has switched on. It starts empty, which shows nothing: no row
 * flashes in on a cold start and goes away again. The last answer is kept on
 * the device, so a student offline still sees the link their programme is
 * shown; a failed read keeps what is there rather than clearing it.
 */
export interface StudyAidsSlice {
  studyAids: Record<string, string[]>;
  loadStudyAids: () => Promise<void>;
}

function isAudiences(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => Array.isArray(v) && v.every((t) => typeof t === 'string'))
  );
}

export const createStudyAidsSlice: AppSlice<StudyAidsSlice> = (set) => ({
  studyAids: {},

  loadStudyAids: async () => {
    try {
      const cached: unknown = await IndexedDBService.get('meta', STUDY_AIDS_CACHE_KEY);
      if (isAudiences(cached)) set({ studyAids: cached });
    } catch (err) {
      logError('StudyAidsSlice.readCache', err);
    }
    const fresh = await fetchStudyAids();
    // null is "ask again later": the cache survives a failed request. An empty
    // record is an answer (the admin switched the link off) and clears it.
    if (fresh === null) return;
    set({ studyAids: fresh });
    try {
      await IndexedDBService.set('meta', STUDY_AIDS_CACHE_KEY, fresh);
    } catch (err) {
      logError('StudyAidsSlice.writeCache', err);
    }
  },
});

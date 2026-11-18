import type { AppSlice } from '../types';
import { fetchStudyAids } from '../../api/studyAids';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';

export const STUDY_AIDS_CACHE_KEY = 'study_aids_audiences';

/**
 * How often a running session may ask again, when the Novinky feed refreshes
 * (every five minutes, both trees). A long gap, so most refreshes cost nothing;
 * short enough that switching the link off or changing its programmes reaches a
 * student the same day without an app restart.
 */
export const STUDY_AIDS_REFRESH_GAP_MS = 15 * 60_000;

/**
 * Who is shown each study-aids link (`api/studyAids.ts`), on both trees.
 *
 * `studyAids` maps a link's id to its audience tokens and holds only the links
 * the admin has switched on. It starts empty, which shows nothing: no row
 * flashes in on a cold start and goes away again. The last answer is kept on
 * the device and used only when the network cannot answer, so a student offline
 * still sees the link their programme is shown; a failed read keeps what is
 * there rather than clearing it.
 *
 * Read at boot and again by `loadStudyAidsIfStale`: a phone process can stay
 * alive for days, and a read that failed at boot should be tried again.
 */
export interface StudyAidsSlice {
  studyAids: Record<string, string[]>;
  /** When the network last answered, null until it has. */
  studyAidsFetchedAt: number | null;
  loadStudyAids: () => Promise<void>;
  /** Asks again unless the network answered less than `minGapMs` ago. */
  loadStudyAidsIfStale: (minGapMs: number) => Promise<void>;
}

function isAudiences(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => Array.isArray(v) && v.every((t) => typeof t === 'string'))
  );
}

export const createStudyAidsSlice: AppSlice<StudyAidsSlice> = (set, get) => ({
  studyAids: {},
  studyAidsFetchedAt: null,

  loadStudyAids: async () => {
    // Demo mode is the build a store reviewer runs: ask nobody and restore
    // nothing, on the boot read and on the feed's refresh alike.
    if (get().demoMode) return;
    const fresh = await fetchStudyAids();
    if (fresh === null) {
      // The network could not answer. The device's copy stands in only while
      // nothing newer is held, and only then: applied first, a link the admin
      // has since switched off would show and then go away again.
      if (get().studyAidsFetchedAt === null) {
        try {
          const cached: unknown = await IndexedDBService.get('meta', STUDY_AIDS_CACHE_KEY);
          if (isAudiences(cached)) set({ studyAids: cached });
        } catch (err) {
          logError('StudyAidsSlice.readCache', err);
        }
      }
      return;
    }
    // An empty record is an answer (the admin switched the link off) and clears it.
    set({ studyAids: fresh, studyAidsFetchedAt: Date.now() });
    try {
      await IndexedDBService.set('meta', STUDY_AIDS_CACHE_KEY, fresh);
    } catch (err) {
      logError('StudyAidsSlice.writeCache', err);
    }
  },

  loadStudyAidsIfStale: async (minGapMs) => {
    const at = get().studyAidsFetchedAt;
    if (at !== null && Date.now() - at < minGapMs) return;
    await get().loadStudyAids();
  },
});

import type { SyllabusSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { fetchAndCacheSingleSyllabus } from '../../services/sync/syncSyllabus';
import type { SyllabusRequirements } from '../../types/documents';
import { logError } from '../../utils/reportError';
// Imported, not redeclared: this number is compared against the one the parser
// stamps, and a local copy is how the two drifted into a permanent cache miss.
// See the note on SYLLABUS_VERSION in syllabusParser.ts.
import { SYLLABUS_VERSION } from '../../utils/parsers/syllabusParser';

export const createSyllabusSlice: AppSlice<SyllabusSlice> = (set, get) => ({
  syllabuses: {
    cache: {},
    loading: {},
  },
  fetchSyllabus: async (courseCode, courseId, subjectName) => {
    const { cache, loading } = get().syllabuses;
    const currentLang = get().language;

    // Return if already in cache (right language AND right version) or loading.
    //
    // The version half is load-bearing. When a legacy record needs refreshing
    // but `fetchAndCacheSingleSyllabus` cannot resolve an id it returns
    // undefined (syncSyllabus.ts:52), and the branch below deliberately keeps
    // the old record so the tab shows real text rather than blanking. That
    // record lands in this cache — so without the version check the stale copy
    // would be served for the rest of the session and the refresh this version
    // bump exists to force would never be retried.
    const cachedData = cache[courseCode];
    if (
      loading[courseCode] ||
      (cachedData && cachedData.language === currentLang && cachedData.version === SYLLABUS_VERSION)
    ) {
      return;
    }

    set((state) => ({
      syllabuses: {
        ...state.syllabuses,
        loading: { ...state.syllabuses.loading, [courseCode]: true },
      },
    }));

    try {
      // 1. Try IDB first (pure read)
      const data = await IndexedDBService.get('syllabuses', courseCode);
      let activeSyllabus: SyllabusRequirements | undefined = undefined;
      let needsFetch = false;

      if (data && 'cz' in data && 'en' in data) {
        activeSyllabus = currentLang === 'en' ? data.en : data.cz;
        if (!activeSyllabus || activeSyllabus.version !== SYLLABUS_VERSION) needsFetch = true;
      } else if (data) {
        activeSyllabus = data as SyllabusRequirements;
        if (
          activeSyllabus.language !== currentLang ||
          activeSyllabus.version !== SYLLABUS_VERSION
        ) {
          needsFetch = true;
        }
      } else {
        needsFetch = true;
      }

      // 2. If IDB miss or stale, delegate network fetch to sync service
      if (needsFetch) {
        const fetched = await fetchAndCacheSingleSyllabus(
          courseCode,
          currentLang,
          courseId,
          subjectName
        );
        if (fetched) {
          activeSyllabus = fetched;
        }
      }

      set((state) => ({
        syllabuses: {
          cache: {
            ...state.syllabuses.cache,
            ...(activeSyllabus ? { [courseCode]: activeSyllabus } : {}),
          },
          loading: { ...state.syllabuses.loading, [courseCode]: false },
        },
      }));
    } catch (e) {
      logError('SyllabusSlice.fetchSyllabus', e);
      set((state) => ({
        syllabuses: {
          ...state.syllabuses,
          loading: { ...state.syllabuses.loading, [courseCode]: false },
        },
      }));
    }
  },
});

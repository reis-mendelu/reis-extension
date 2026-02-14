import type { SyllabusSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { fetchAndCacheSingleSyllabus } from '../../services/sync/syncSyllabus';
import type { SyllabusRequirements } from '../../types/documents';

const SYLLABUS_VERSION = 2;

export const createSyllabusSlice: AppSlice<SyllabusSlice> = (set, get) => ({
  syllabuses: {
    cache: {},
    loading: {},
  },
  fetchSyllabus: async (courseCode, courseId, subjectName) => {
    const { cache, loading } = get().syllabuses;
    const currentLang = get().language;

    // Return if already in cache (and language matches) or currently loading
    const cachedData = cache[courseCode];
    if (loading[courseCode] || (cachedData && cachedData.language === currentLang)) return;

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
          if (activeSyllabus.language !== currentLang || activeSyllabus.version !== SYLLABUS_VERSION) {
              needsFetch = true;
          }
      } else {
          needsFetch = true;
      }

      // 2. If IDB miss or stale, delegate network fetch to sync service
      if (needsFetch) {
        const fetched = await fetchAndCacheSingleSyllabus(courseCode, currentLang, courseId, subjectName);
        if (fetched) {
            activeSyllabus = fetched;
        }
      }

      set((state) => ({
        syllabuses: {
          cache: {
            ...state.syllabuses.cache,
            ...(activeSyllabus ? { [courseCode]: activeSyllabus } : {})
          },
          loading: { ...state.syllabuses.loading, [courseCode]: false },
        },
      }));
    } catch (error) {
      console.error(`[SyllabusSlice] Failed for ${courseCode}:`, error);
      set((state) => ({
        syllabuses: {
          ...state.syllabuses,
          loading: { ...state.syllabuses.loading, [courseCode]: false },
        },
      }));
    }
  },
});

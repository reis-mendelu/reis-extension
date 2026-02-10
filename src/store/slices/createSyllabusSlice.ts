import type { SyllabusSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { fetchSyllabus, findSubjectId } from '../../api/syllabus';
import type { SyllabusRequirements } from '../../types/documents';

export const createSyllabusSlice: AppSlice<SyllabusSlice> = (set, get) => ({
  syllabuses: {
    cache: {},
    loading: {},
  },
  fetchSyllabus: async (courseCode, courseId, subjectName) => {
    const { cache, loading } = get().syllabuses;
    const currentLang = get().language;

    // 1. Return if already in cache (and language matches) or currently loading
    const cachedData = cache[courseCode];
    if (loading[courseCode] || (cachedData && cachedData.language === currentLang)) return;

    // 2. Set loading state
    set((state) => ({
      syllabuses: {
        ...state.syllabuses,
        loading: { ...state.syllabuses.loading, [courseCode]: true },
      },
    }));

    try {
      const SYLLABUS_VERSION = 2;
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

      if (needsFetch) {
        let activeId = courseId;
        if (!activeId) {
          activeId = await findSubjectId(courseCode, subjectName) || undefined;
        }

        if (activeId) {
          try {
            const [czSyllabus, enSyllabus] = await Promise.all([
              fetchSyllabus(activeId, 'cz'),
              fetchSyllabus(activeId, 'en')
            ]);
            
            const dualData = { cz: czSyllabus, en: enSyllabus };
            await IndexedDBService.set('syllabuses', courseCode, dualData);
            activeSyllabus = currentLang === 'en' ? enSyllabus : czSyllabus;
          } catch (err) {
            console.error(`[SyllabusSlice] API fetch failed:`, err);
          }
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

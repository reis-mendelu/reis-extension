import type { SyllabusSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { fetchSyllabus, findSubjectId } from '../../api/syllabus';

export const createSyllabusSlice: AppSlice<SyllabusSlice> = (set, get) => ({
  syllabuses: {
    cache: {},
    loading: {},
  },
  fetchSyllabus: async (courseCode, courseId, subjectName) => {
    const { cache, loading } = get().syllabuses;

    // 1. Return if already in cache or currently loading
    if (cache[courseCode] || loading[courseCode]) return;

    // 2. Set loading state
    set((state) => ({
      syllabuses: {
        ...state.syllabuses,
        loading: { ...state.syllabuses.loading, [courseCode]: true },
      },
    }));

    try {
      // 3. Try IndexedDB first
      let data = await IndexedDBService.get('syllabuses', courseCode);

      if (!data) {
        let activeId = courseId;
        if (!activeId) {
          activeId = await findSubjectId(courseCode, subjectName) || undefined;
        }

        if (activeId) {
          data = await fetchSyllabus(activeId);
          if (data) {
            await IndexedDBService.set('syllabuses', courseCode, data);
          }
        }
      }

      set((state) => ({
        syllabuses: {
          cache: { 
            ...state.syllabuses.cache, 
            ...(data ? { [courseCode]: data } : {}) 
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

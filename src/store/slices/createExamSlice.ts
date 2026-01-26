import type { ExamSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createExamSlice: AppSlice<ExamSlice> = (set) => ({
  exams: {
    data: [],
    status: 'idle',
    error: null,
  },
  fetchExams: async () => {
    set((state) => ({ exams: { ...state.exams, status: 'loading', error: null } }));
    try {
      const data = await IndexedDBService.get('exams', 'current');
      set({
        exams: {
          data: data || [],
          status: 'success',
          error: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({
        exams: {
          data: [],
          status: 'error',
          error: message,
        },
      });
    }
  },
  setExams: (data) => {
    set((state) => ({
        exams: { ...state.exams, data },
    }));
  },
});

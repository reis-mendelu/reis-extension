import type { ClassmatesSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createClassmatesSlice: AppSlice<ClassmatesSlice> = (set, get) => ({
    classmates: {},
    classmatesAllLoading: {},
    classmatesAllProgress: {},
    classmatesSeminarLoading: {},
    classmatesSeminarProgress: {},

    fetchClassmatesAll: async (courseCode) => {
        set((state) => ({
            classmates: { ...state.classmates, [courseCode]: { ...(state.classmates[courseCode] ?? {}), all: [] } },
            classmatesAllLoading: { ...state.classmatesAllLoading, [courseCode]: false },
            classmatesAllProgress: { ...state.classmatesAllProgress, [courseCode]: 'success' },
        }));
    },

    fetchClassmatesSeminar: async (courseCode) => {
        set((state) => ({
            classmates: { ...state.classmates, [courseCode]: { ...(state.classmates[courseCode] ?? {}), seminar: [] } },
            classmatesSeminarLoading: { ...state.classmatesSeminarLoading, [courseCode]: false },
            classmatesSeminarProgress: { ...state.classmatesSeminarProgress, [courseCode]: 'success' },
        }));
    },

    invalidateClassmates: () => {
        set({ classmates: {}, classmatesAllLoading: {}, classmatesAllProgress: {}, classmatesSeminarLoading: {}, classmatesSeminarProgress: {} });
    },
});

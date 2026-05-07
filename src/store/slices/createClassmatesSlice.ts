import type { ClassmatesSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';

/**
 * Classmates slice — IDB-read-only pattern (mirrors files slice).
 *
 * Data is written to the extension-origin IDB by useAppLogic's syncUpdate handler.
 * This slice only reads from IDB to hydrate the store.
 */
export const createClassmatesSlice: AppSlice<ClassmatesSlice> = (set, get) => ({
    classmates: {},
    classmatesLoading: {},
    fetchClassmates: async (courseCode) => {
        const { classmates, classmatesLoading } = get();
        if (classmatesLoading[courseCode] || classmates[courseCode] !== undefined) {
            return;
        }

        set((s) => ({ classmatesLoading: { ...s.classmatesLoading, [courseCode]: true } }));

        try {
            const cached = await IndexedDBService.get('classmates', courseCode);
            set((s) => ({
                classmates: { ...s.classmates, [courseCode]: cached ?? [] },
                classmatesLoading: { ...s.classmatesLoading, [courseCode]: false },
            }));
        } catch (error) {
            logError('ClassmatesSlice.fetchClassmates', error, { courseCode });
            set((s) => ({
                classmates: { ...s.classmates, [courseCode]: [] },
                classmatesLoading: { ...s.classmatesLoading, [courseCode]: false },
            }));
        }
    },

    invalidateClassmates: () => set({ classmates: {}, classmatesLoading: {} }),
});

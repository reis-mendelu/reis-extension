import type { ClassmatesSlice, AppSlice } from '../types';
import { loadAllClassmatesFromCache } from './classmates/fetchAllClassmates';

/**
 * Classmates slice — eager hydrate pattern (mirrors files slice).
 *
 * Data is written to the extension-origin IDB by useAppLogic's syncUpdate handler.
 * fetchAllClassmates batch-reads every enrolled course's IDB entry and replaces
 * the entire `classmates` map in one set() — no per-component lazy fetch, no race
 * against invalidation, no empty-array poison pill.
 */
export const createClassmatesSlice: AppSlice<ClassmatesSlice> = (set, get) => ({
    classmates: {},
    fetchAllClassmates: async () => {
        const classmates = await loadAllClassmatesFromCache({ subjects: get().subjects });
        set({ classmates });
    },
});

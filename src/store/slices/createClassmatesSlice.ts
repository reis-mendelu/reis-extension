import type { ClassmatesSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createClassmatesSlice: AppSlice<ClassmatesSlice> = (set) => ({
    classmates: {},
    classmatesLoading: {},
    fetchClassmates: async (courseCode) => {
        set((state) => ({
            classmatesLoading: { ...state.classmatesLoading, [courseCode]: true }
        }));

        try {
            const data = await IndexedDBService.get('classmates', courseCode);
            set((state) => ({
                classmates: { ...state.classmates, [courseCode]: data || [] },
                classmatesLoading: { ...state.classmatesLoading, [courseCode]: false }
            }));
        } catch (error) {
            console.error(`[ClassmatesSlice] Fetch failed for ${courseCode}:`, error);
            set((state) => ({
                classmatesLoading: { ...state.classmatesLoading, [courseCode]: false }
            }));
        }
    },
});

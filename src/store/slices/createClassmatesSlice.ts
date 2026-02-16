import type { ClassmatesSlice, AppSlice } from '../types';
import type { ClassmatesData } from '../../types/classmates';
import { IndexedDBService } from '../../services/storage';

export const createClassmatesSlice: AppSlice<ClassmatesSlice> = (set, get) => ({
    classmates: {},
    classmatesLoading: {},
    classmatesPriorityLoading: {},
    classmatesProgress: {},
    
    fetchClassmates: async (courseCode) => {
        set((state) => ({
            classmatesLoading: { ...state.classmatesLoading, [courseCode]: true }
        }));

        try {
            const data = await IndexedDBService.get('classmates', courseCode) as ClassmatesData | null;
            set((state) => ({
                classmates: {
                    ...state.classmates,
                    [courseCode]: data || { all: [], seminar: [] }
                },
                classmatesLoading: { ...state.classmatesLoading, [courseCode]: false }
            }));
        } catch (error) {
            console.error(`[ClassmatesSlice] Fetch failed for ${courseCode}:`, error);
            set((state) => ({
                classmatesLoading: { ...state.classmatesLoading, [courseCode]: false }
            }));
        }
    },
    
    fetchClassmatesPriority: async (courseCode) => {
        // Avoid duplicate priority fetches
        if (get().classmatesPriorityLoading[courseCode]) return;
        
        set((state) => ({
            classmatesPriorityLoading: { ...state.classmatesPriorityLoading, [courseCode]: true },
            classmatesProgress: { ...state.classmatesProgress, [courseCode]: 'fetching' }
        }));

        try {
            // First try IndexedDB for instant load
            const cachedData = await IndexedDBService.get('classmates', courseCode) as ClassmatesData | null;
            if (cachedData) {
                set((state) => ({
                    classmates: { ...state.classmates, [courseCode]: cachedData },
                    classmatesPriorityLoading: { ...state.classmatesPriorityLoading, [courseCode]: false },
                    classmatesProgress: { ...state.classmatesProgress, [courseCode]: 'success' }
                }));
            } else {
                // If no cache, wait for sync service to populate
                set((state) => ({
                    classmatesPriorityLoading: { ...state.classmatesPriorityLoading, [courseCode]: false },
                    classmatesProgress: { ...state.classmatesProgress, [courseCode]: 'waiting_sync' }
                }));
            }
        } catch (error) {
            console.error(`[ClassmatesSlice] Priority fetch failed for ${courseCode}:`, error);
            set((state) => ({
                classmatesPriorityLoading: { ...state.classmatesPriorityLoading, [courseCode]: false },
                classmatesProgress: { ...state.classmatesProgress, [courseCode]: 'error' }
            }));
        }
    },
    
    invalidateClassmates: () => {
        set({ classmates: {}, classmatesPriorityLoading: {}, classmatesProgress: {} });
    },
});

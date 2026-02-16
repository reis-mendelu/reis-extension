import type { ClassmatesSlice, AppSlice } from '../types';
import type { ClassmatesData, Classmate } from '../../types/classmates';
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
                classmatesLoading: { ...state.classmatesLoading, [courseCode]: false },
                // Also clear priority loading if it was active
                classmatesPriorityLoading: { ...state.classmatesPriorityLoading, [courseCode]: false }
            }));
        } catch (error) {
            console.error(`[ClassmatesSlice] Fetch failed for ${courseCode}:`, error);
            set((state) => ({
                classmates: { ...state.classmates, [courseCode]: state.classmates[courseCode] ?? { all: [], seminar: [] } },
                classmatesLoading: { ...state.classmatesLoading, [courseCode]: false },
                classmatesPriorityLoading: { ...state.classmatesPriorityLoading, [courseCode]: false }
            }));
        }
    },

    fetchClassmatesPriority: async (courseCode) => {
        // Avoid duplicate priority fetches
        if (get().classmatesPriorityLoading[courseCode]) return;

        set((state) => ({
            classmatesPriorityLoading: { ...state.classmatesPriorityLoading, [courseCode]: true },
            classmatesProgress: { ...state.classmatesProgress, [courseCode]: 'initializing' }
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
                return;
            }

            // No IDB cache — wait for subjects metadata and sync handshake
            let syncStatus = get().syncStatus;
            let subjects = get().subjects;

            set((state) => ({
                classmatesProgress: { ...state.classmatesProgress, [courseCode]: 'waiting_metadata' }
            }));

            // Wait for handshake and subjects if needed
            if (!syncStatus.handshakeDone || !subjects) {
                const { useAppStore } = await import('../useAppStore');
                await new Promise<void>((resolve) => {
                    const unsubscribe = useAppStore.subscribe((state) => {
                        if (state.syncStatus.handshakeDone && state.subjects) {
                            unsubscribe();
                            syncStatus = state.syncStatus;
                            subjects = state.subjects;
                            resolve();
                        }
                    });
                    // Safety timeout
                    setTimeout(() => { unsubscribe(); resolve(); }, 5000);
                });
            }

            if (!subjects?.data[courseCode]?.subjectId) {
                const isSyncActive = syncStatus.isSyncing || !syncStatus.handshakeDone;
                if (!isSyncActive) {
                    console.log(`[ClassmatesSlice] No cache/id and sync finished for ${courseCode}. Setting empty.`);
                    set((state) => ({
                        classmates: { ...state.classmates, [courseCode]: { all: [], seminar: [] } },
                        classmatesPriorityLoading: { ...state.classmatesPriorityLoading, [courseCode]: false },
                        classmatesProgress: { ...state.classmatesProgress, [courseCode]: 'success' }
                    }));
                    return;
                }
                // Still waiting for sync...
                set((state) => ({ classmatesProgress: { ...state.classmatesProgress, [courseCode]: 'waiting_sync' } }));
                return;
            }

            const subject = subjects.data[courseCode];
            const { getUserParams } = await import('../../utils/userParams');
            const userParams = await getUserParams();

            if (!userParams?.studium || !userParams?.obdobi) {
                throw new Error('User parameters missing');
            }

            const { fetchClassmates } = await import('../../api/classmates');
            set((state) => ({ classmatesProgress: { ...state.classmatesProgress, [courseCode]: 'fetching' } }));

            // Progressive fetch for 'all' classmates
            const allPromise = fetchClassmates(subject.subjectId!, userParams.studium, userParams.obdobi, undefined, (chunk) => {
                set((state) => {
                    const current = state.classmates[courseCode] || { all: [], seminar: [] };
                    return {
                        classmates: {
                            ...state.classmates,
                            [courseCode]: { ...current, all: chunk }
                        }
                    };
                });
            });

            // Progressive fetch for 'seminar' classmates if group ID exists
            let seminarPromise = Promise.resolve([] as Classmate[]);
            if (subject.skupinaId) {
                seminarPromise = fetchClassmates(subject.subjectId!, userParams.studium, userParams.obdobi, subject.skupinaId, (chunk) => {
                    set((state) => {
                        const current = state.classmates[courseCode] || { all: [], seminar: [] };
                        return {
                            classmates: {
                                ...state.classmates,
                                [courseCode]: { ...current, seminar: chunk }
                            }
                        };
                    });
                });
            }

            const [all, seminar] = await Promise.all([allPromise, seminarPromise]);
            const finalData = { all, seminar };

            // Final update and persistence
            await IndexedDBService.set('classmates', courseCode, finalData);
            set((state) => ({
                classmates: { ...state.classmates, [courseCode]: finalData },
                classmatesPriorityLoading: { ...state.classmatesPriorityLoading, [courseCode]: false },
                classmatesProgress: { ...state.classmatesProgress, [courseCode]: 'success' }
            }));

        } catch (error) {
            console.error(`[ClassmatesSlice] Priority fetch failed for ${courseCode}:`, error);
            set((state) => ({
                classmates: { ...state.classmates, [courseCode]: { all: [], seminar: [] } },
                classmatesPriorityLoading: { ...state.classmatesPriorityLoading, [courseCode]: false },
                classmatesProgress: { ...state.classmatesProgress, [courseCode]: 'error' }
            }));
        }
    },

    invalidateClassmates: () => {
        set({ classmates: {}, classmatesPriorityLoading: {}, classmatesProgress: {} });
    },
});

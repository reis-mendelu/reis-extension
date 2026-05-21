import type { ClassmatesSlice, AppSlice, AppState } from '../types';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import { loadAllClassmatesFromCache } from './classmates/fetchAllClassmates';
import {
    fetchAndPersistClassmates,
    persistLastClassmatesFetched,
    CLASSMATES_LAST_FETCHED_KEY,
    type FetchClassmatesResult,
} from './classmates/fetchClassmatesForSubject';

type SetState = Parameters<AppSlice<ClassmatesSlice>>[0];
type GetState = Parameters<AppSlice<ClassmatesSlice>>[1];

function applyFetchSuccess(
    set: SetState,
    get: GetState,
    courseCode: string,
    result: FetchClassmatesResult,
): void {
    const nextLast = { ...get().lastClassmatesFetchedAt, [courseCode]: result.fetchedAt };
    persistLastClassmatesFetched(nextLast);
    set((state: AppState) => {
        const nextErr = { ...state.classmatesError };
        delete nextErr[courseCode];
        return {
            classmates: { ...state.classmates, [courseCode]: result.data },
            classmatesLoading: { ...state.classmatesLoading, [courseCode]: false },
            lastClassmatesFetchedAt: nextLast,
            classmatesError: nextErr,
        };
    });
}

function applyFetchError(
    set: SetState,
    courseCode: string,
    e: unknown,
    { defaultEmpty }: { defaultEmpty: boolean } = { defaultEmpty: false },
): void {
    const msg = e instanceof Error ? e.message : String(e);
    set((state: AppState) => ({
        classmates: defaultEmpty
            ? { ...state.classmates, [courseCode]: state.classmates[courseCode] ?? [] }
            : state.classmates,
        classmatesLoading: { ...state.classmatesLoading, [courseCode]: false },
        classmatesError: { ...state.classmatesError, [courseCode]: msg },
    }));
}

function clearLoadingAndError(set: SetState, courseCode: string): void {
    set((state: AppState) => {
        const nextErr = { ...state.classmatesError };
        delete nextErr[courseCode];
        return {
            classmatesLoading: { ...state.classmatesLoading, [courseCode]: false },
            classmatesError: nextErr,
        };
    });
}

export const createClassmatesSlice: AppSlice<ClassmatesSlice> = (set, get) => ({
    classmates: {},
    classmatesLoading: {},
    lastClassmatesFetchedAt: {},
    classmatesError: {},

    fetchClassmatesPriority: async (courseCode) => {
        const { classmates, classmatesLoading, subjects } = get();
        if (classmatesLoading[courseCode] || classmates[courseCode] !== undefined) return;

        set((state) => ({
            classmatesLoading: { ...state.classmatesLoading, [courseCode]: true },
        }));

        try {
            const cached = await IndexedDBService.get('classmates', courseCode);
            if (Array.isArray(cached)) {
                set((state) => ({
                    classmates: { ...state.classmates, [courseCode]: cached },
                    classmatesLoading: { ...state.classmatesLoading, [courseCode]: false },
                }));
                return;
            }

            const result = await fetchAndPersistClassmates({ courseCode, subjects });
            if (!result) {
                set((state) => {
                    const nextErr = { ...state.classmatesError };
                    delete nextErr[courseCode];
                    return {
                        classmates: { ...state.classmates, [courseCode]: [] },
                        classmatesLoading: { ...state.classmatesLoading, [courseCode]: false },
                        classmatesError: nextErr,
                    };
                });
                return;
            }
            applyFetchSuccess(set, get, courseCode, result);
        } catch (e) {
            logError('ClassmatesSlice.fetchClassmatesPriority', e, { courseCode });
            applyFetchError(set, courseCode, e, { defaultEmpty: true });
        }
    },

    refreshClassmatesForSubject: async (courseCode) => {
        const { subjects, classmatesLoading } = get();
        if (classmatesLoading[courseCode]) return;

        set((state) => ({
            classmatesLoading: { ...state.classmatesLoading, [courseCode]: true },
        }));

        try {
            const result = await fetchAndPersistClassmates({ courseCode, subjects });
            if (!result) {
                clearLoadingAndError(set, courseCode);
                return;
            }
            applyFetchSuccess(set, get, courseCode, result);
        } catch (e) {
            logError('ClassmatesSlice.refreshClassmatesForSubject', e, { courseCode });
            applyFetchError(set, courseCode, e);
        }
    },

    fetchAllClassmates: async () => {
        const result = await loadAllClassmatesFromCache({ subjects: get().subjects });
        // Skip set() when subjects unknown — an empty map would clobber concurrent writes.
        if (result === null) return;
        set({ classmates: result });
    },

    hydrateLastClassmatesFetchedAt: async () => {
        try {
            const cached = await IndexedDBService.get('meta', CLASSMATES_LAST_FETCHED_KEY);
            if (cached && typeof cached === 'object') {
                set({ lastClassmatesFetchedAt: cached as Record<string, number> });
            }
        } catch (e) {
            logError('ClassmatesSlice.hydrateLastClassmatesFetchedAt', e);
        }
    },
});

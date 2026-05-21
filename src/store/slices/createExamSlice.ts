import type { ExamSlice, AppSlice, AppState } from '../types';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import { syncService } from '../../services/sync/SyncService';
import { loadAllExamClassmatesFromCache } from './exams/fetchAllExamClassmates';
import {
    fetchAndPersistExamClassmates,
    persistLastExamClassmatesFetched,
    EXAM_CLASSMATES_LAST_FETCHED_KEY,
    type FetchExamClassmatesResult,
} from './exams/fetchExamClassmatesForTermin';

type SetState = Parameters<AppSlice<ExamSlice>>[0];
type GetState = Parameters<AppSlice<ExamSlice>>[1];

function applyFetchSuccess(
    set: SetState,
    get: GetState,
    terminId: string,
    result: FetchExamClassmatesResult,
): void {
    const nextLast = { ...get().lastExamClassmatesFetchedAt, [terminId]: result.fetchedAt };
    persistLastExamClassmatesFetched(nextLast);
    set((state: AppState) => {
        const nextErr = { ...state.examClassmatesError };
        delete nextErr[terminId];
        return {
            examClassmates: { ...state.examClassmates, [terminId]: result.data },
            examClassmatesLoading: { ...state.examClassmatesLoading, [terminId]: false },
            lastExamClassmatesFetchedAt: nextLast,
            examClassmatesError: nextErr,
        };
    });
}

function applyFetchError(
    set: SetState,
    terminId: string,
    e: unknown,
    { defaultEmpty }: { defaultEmpty: boolean } = { defaultEmpty: false },
): void {
    const msg = e instanceof Error ? e.message : String(e);
    set((state: AppState) => ({
        examClassmates: defaultEmpty
            ? { ...state.examClassmates, [terminId]: state.examClassmates[terminId] ?? [] }
            : state.examClassmates,
        examClassmatesLoading: { ...state.examClassmatesLoading, [terminId]: false },
        examClassmatesError: { ...state.examClassmatesError, [terminId]: msg },
    }));
}

function clearLoadingAndError(set: SetState, terminId: string): void {
    set((state: AppState) => {
        const nextErr = { ...state.examClassmatesError };
        delete nextErr[terminId];
        return {
            examClassmatesLoading: { ...state.examClassmatesLoading, [terminId]: false },
            examClassmatesError: nextErr,
        };
    });
}

export const createExamSlice: AppSlice<ExamSlice> = (set, get) => ({
  exams: {
    data: [],
    status: 'idle',
    error: null,
  },
  lastExamsFetchedAt: null,
  examsRefreshing: false,
  examClassmates: {},
  examClassmatesLoading: {},
  lastExamClassmatesFetchedAt: {},
  examClassmatesError: {},

  fetchExamClassmatesPriority: async (terminId) => {
    const { examClassmates, examClassmatesLoading, studiumId, obdobiId } = get();
    if (examClassmatesLoading[terminId] || examClassmates[terminId] !== undefined) return;

    set((state) => ({
      examClassmatesLoading: { ...state.examClassmatesLoading, [terminId]: true },
    }));

    try {
      const cached = await IndexedDBService.get('classmates', `exam:${terminId}`);
      if (Array.isArray(cached)) {
        set((state) => ({
          examClassmates: { ...state.examClassmates, [terminId]: cached },
          examClassmatesLoading: { ...state.examClassmatesLoading, [terminId]: false },
        }));
        return;
      }

      const result = await fetchAndPersistExamClassmates({ terminId, studiumId, obdobiId });
      if (!result) {
        set((state) => {
          const nextErr = { ...state.examClassmatesError };
          delete nextErr[terminId];
          return {
            examClassmates: { ...state.examClassmates, [terminId]: [] },
            examClassmatesLoading: { ...state.examClassmatesLoading, [terminId]: false },
            examClassmatesError: nextErr,
          };
        });
        return;
      }
      applyFetchSuccess(set, get, terminId, result);
    } catch (e) {
      logError('ExamSlice.fetchExamClassmatesPriority', e, { terminId });
      applyFetchError(set, terminId, e, { defaultEmpty: true });
    }
  },

  refreshExamClassmatesForTermin: async (terminId) => {
    const { studiumId, obdobiId, examClassmatesLoading } = get();
    if (examClassmatesLoading[terminId]) return;

    set((state) => ({
      examClassmatesLoading: { ...state.examClassmatesLoading, [terminId]: true },
    }));

    try {
      const result = await fetchAndPersistExamClassmates({ terminId, studiumId, obdobiId });
      if (!result) {
        clearLoadingAndError(set, terminId);
        return;
      }
      applyFetchSuccess(set, get, terminId, result);
    } catch (e) {
      logError('ExamSlice.refreshExamClassmatesForTermin', e, { terminId });
      applyFetchError(set, terminId, e);
    }
  },

  fetchAllExamClassmates: async () => {
    const result = await loadAllExamClassmatesFromCache({ exams: get().exams.data });
    // Skip set() when exams unknown — an empty map would clobber concurrent writes.
    if (result === null) return;
    set({ examClassmates: result });
  },

  hydrateLastExamClassmatesFetchedAt: async () => {
    try {
      const cached = await IndexedDBService.get('meta', EXAM_CLASSMATES_LAST_FETCHED_KEY);
      if (cached && typeof cached === 'object') {
        set({ lastExamClassmatesFetchedAt: cached as Record<string, number> });
      }
    } catch (e) {
      logError('ExamSlice.hydrateLastExamClassmatesFetchedAt', e);
    }
  },

  fetchExams: async () => {
    if (get().exams.data.length === 0) {
      set((state) => ({ exams: { ...state.exams, status: 'loading', error: null } }));
    } else {
      set((state) => ({ exams: { ...state.exams, error: null } }));
    }
    try {
      const [data, modifiedAt] = await Promise.all([
        IndexedDBService.get('exams', 'current'),
        IndexedDBService.get('meta', 'exams_modified'),
      ]);
      const resolved = data || [];
      set({
        exams: {
          data: resolved,
          status: 'success',
          error: null,
        },
        ...(modifiedAt != null ? { lastExamsFetchedAt: modifiedAt as number } : {}),
      });
      void get().fetchAllExamClassmates();
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
  triggerExamsRefresh: () => {
    if (get().examsRefreshing) return;
    set({ examsRefreshing: true });
    syncService.triggerExamRefresh();
    setTimeout(() => {
      if (get().examsRefreshing) set({ examsRefreshing: false });
    }, 15_000);
  },
  setExams: (data) => {
    set((state) => ({
        exams: { ...state.exams, data },
        lastExamsFetchedAt: Date.now(),
        examsRefreshing: false,
    }));
    IndexedDBService.set('exams', 'current', data).catch(() => {});
    IndexedDBService.set('meta', 'exams_modified', Date.now()).catch(() => {});
    void get().fetchAllExamClassmates();
  },
});

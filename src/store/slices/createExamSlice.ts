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
import { stripGroupSignupSections } from '../../utils/exams/isGroupSignup';
import { fetchTermDetail } from '../../api/termDetail';

const NOTE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours on success
const NOTE_ERROR_TTL_MS = 5 * 60 * 1000; // 5 minutes after error — prevents remount-refetch storm

// Cap parallel terminy_info.pl fetches. A student with N expanded sections can
// mount 50+ TermTiles at once; without a cap, IS Mendelu sees that as a burst.
const MAX_CONCURRENT_NOTE_FETCHES = 3;
let activeNoteFetches = 0;
const noteFetchQueue: (() => void)[] = [];

function acquireNoteFetchSlot(): Promise<void> {
  if (activeNoteFetches < MAX_CONCURRENT_NOTE_FETCHES) {
    activeNoteFetches++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    noteFetchQueue.push(() => {
      activeNoteFetches++;
      resolve();
    });
  });
}

function releaseNoteFetchSlot(): void {
  activeNoteFetches--;
  const next = noteFetchQueue.shift();
  if (next) next();
}

type SetState = Parameters<AppSlice<ExamSlice>>[0];
type GetState = Parameters<AppSlice<ExamSlice>>[1];

function applyFetchSuccess(
  set: SetState,
  get: GetState,
  terminId: string,
  result: FetchExamClassmatesResult
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
  { defaultEmpty }: { defaultEmpty: boolean } = { defaultEmpty: false }
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

/**
 * Which exams refresh is the current one — see createScheduleSlice's
 * `refreshGeneration`: a request that outlived its backstop must not end a
 * newer refresh when it finally answers.
 */
let refreshGeneration = 0;

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
  examNotes: {},
  examNotesLoading: {},
  examNotesError: {},
  lastExamNotesFetchedAt: {},
  examTermDurations: {},

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

  fetchExamNotePriority: async (terminId) => {
    const { examNotesLoading, lastExamNotesFetchedAt, examNotesError, studiumId, obdobiId } = get();
    if (examNotesLoading[terminId]) return;
    const fetchedAt = lastExamNotesFetchedAt[terminId];
    const ttl = examNotesError[terminId] ? NOTE_ERROR_TTL_MS : NOTE_TTL_MS;
    if (fetchedAt && Date.now() - fetchedAt < ttl) return;
    if (!studiumId || !obdobiId) return;

    set((state) => ({
      examNotesLoading: { ...state.examNotesLoading, [terminId]: true },
    }));

    await acquireNoteFetchSlot();
    try {
      // Always fetch CZ — teacher-authored note text isn't translated by IS,
      // and querying the EN page hides the teacher's CZ note even though the
      // student needs to read it regardless of their UI language.
      // The same page carries the term's length, which the phone shows for
      // every term a student opens — so it is kept from this one request.
      const { note, durationMinutes } = await fetchTermDetail(terminId, studiumId, obdobiId, 'cz');
      set((state) => {
        const nextErr = { ...state.examNotesError };
        delete nextErr[terminId];
        return {
          examNotes: { ...state.examNotes, [terminId]: note },
          examTermDurations: { ...state.examTermDurations, [terminId]: durationMinutes },
          examNotesLoading: { ...state.examNotesLoading, [terminId]: false },
          lastExamNotesFetchedAt: { ...state.lastExamNotesFetchedAt, [terminId]: Date.now() },
          examNotesError: nextErr,
        };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Stamp fetchedAt on error too so the 5-min backoff applies — without
      // this, every TermTile remount during an auth-expired window refires.
      set((state) => ({
        examNotesLoading: { ...state.examNotesLoading, [terminId]: false },
        examNotesError: { ...state.examNotesError, [terminId]: msg },
        lastExamNotesFetchedAt: { ...state.lastExamNotesFetchedAt, [terminId]: Date.now() },
      }));
    } finally {
      releaseNoteFetchSlot();
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
      // Strip here as well as in setExams: a cache written by a build from
      // before this filter existed still holds the signup sections.
      const resolved = stripGroupSignupSections(data || []);
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
    // Ends on the refresh's ANSWER. Waiting for `setExams` instead meant a
    // student with no exams this month — an empty read pushes nothing — spun
    // for the full 15s after a lookup that took 0.6s. The timer stays as the
    // backstop for an answer that never comes.
    const generation = ++refreshGeneration;
    const stop = () => {
      if (generation === refreshGeneration && get().examsRefreshing)
        set({ examsRefreshing: false });
    };
    syncService
      .triggerExamRefresh()
      .catch((e) => logError('ExamSlice.triggerExamsRefresh', e))
      .finally(stop);
    setTimeout(stop, 15_000);
  },
  setExams: (data) => {
    // A transient/failed IS fetch resolves to [] (see fetchExamData), and a
    // sync push would otherwise wipe the currently-displayed exams. Keep old
    // data on screen until real new data is available to replace it.
    if (data.length === 0 && get().exams.data.length > 0) return;
    // "Zápis na cvičení" arrives through IS's exam-terms table but is not an
    // exam — drop it before anything in the app can treat it as one.
    data = stripGroupSignupSections(data);
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

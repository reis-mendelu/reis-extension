import type { AppSlice, AppState } from '../types';
import { logError } from '../../utils/reportError';
import {
  loadCachedSubjectClassmates,
  fetchAndPersistSubjectClassmates,
  type SubjectClassmatesResult,
} from './classmates/subjectClassmatesCache';
import type { ClassmatesData } from '../../types/classmates';

/** Enrolment still moves in the first weeks; a day old is old enough. */
export const SUBJECT_CLASSMATES_STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Everyone taking a subject, lectures included — the "Celý předmět" side of the
 * Spolužáci toggle. Hundreds of students at 40 a page, so unlike the seminar
 * list it is never part of the background sync: it is fetched the first time
 * the student opens it, then cached in IndexedDB like the seminar list.
 */
export interface SubjectClassmatesSlice {
  /** courseCode → everyone taking the subject this semester */
  subjectClassmates: Record<string, ClassmatesData>;
  subjectClassmatesLoading: Record<string, boolean>;
  subjectClassmatesError: Record<string, string>;
  lastSubjectClassmatesFetchedAt: Record<string, number>;
  /** Cache first; a stale cache shows at once and refreshes behind it. */
  fetchSubjectClassmatesPriority: (courseCode: string) => Promise<void>;
  /** Straight to IS — the error state's retry. */
  refreshSubjectClassmates: (courseCode: string) => Promise<void>;
}

type SetState = Parameters<AppSlice<SubjectClassmatesSlice>>[0];

const setLoading = (set: SetState, courseCode: string, loading: boolean) =>
  set((state: AppState) => ({
    subjectClassmatesLoading: { ...state.subjectClassmatesLoading, [courseCode]: loading },
  }));

function applyList(set: SetState, courseCode: string, result: SubjectClassmatesResult) {
  set((state: AppState) => {
    const nextErr = { ...state.subjectClassmatesError };
    delete nextErr[courseCode];
    return {
      subjectClassmates: { ...state.subjectClassmates, [courseCode]: result.data },
      subjectClassmatesLoading: { ...state.subjectClassmatesLoading, [courseCode]: false },
      lastSubjectClassmatesFetchedAt: {
        ...state.lastSubjectClassmatesFetchedAt,
        [courseCode]: result.fetchedAt,
      },
      subjectClassmatesError: nextErr,
    };
  });
}

function applyError(set: SetState, courseCode: string, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  set((state: AppState) => ({
    subjectClassmatesLoading: { ...state.subjectClassmatesLoading, [courseCode]: false },
    subjectClassmatesError: { ...state.subjectClassmatesError, [courseCode]: msg },
  }));
}

// Inert while impersonating: these hit IS and write IndexedDB per subject code,
// and the store then holds another programme's subjects (createImpersonationSlice).
export const createSubjectClassmatesSlice: AppSlice<SubjectClassmatesSlice> = (set, get) => ({
  subjectClassmates: {},
  subjectClassmatesLoading: {},
  subjectClassmatesError: {},
  lastSubjectClassmatesFetchedAt: {},

  fetchSubjectClassmatesPriority: async (courseCode) => {
    if (get().impersonation) return;
    const { subjectClassmates, subjectClassmatesLoading } = get();
    if (subjectClassmatesLoading[courseCode] || subjectClassmates[courseCode] !== undefined) return;

    setLoading(set, courseCode, true);
    try {
      const cached = await loadCachedSubjectClassmates(courseCode);
      if (cached) {
        applyList(set, courseCode, cached);
        if (Date.now() - cached.fetchedAt > SUBJECT_CLASSMATES_STALE_MS) {
          await get().refreshSubjectClassmates(courseCode);
        }
        return;
      }
    } catch (e) {
      // An unreadable cache is no reason not to ask IS.
      logError('SubjectClassmatesSlice.loadCache', e, { courseCode });
    }
    setLoading(set, courseCode, false);
    await get().refreshSubjectClassmates(courseCode);
  },

  refreshSubjectClassmates: async (courseCode) => {
    if (get().impersonation) return;
    if (get().subjectClassmatesLoading[courseCode]) return;

    setLoading(set, courseCode, true);
    try {
      const result = await fetchAndPersistSubjectClassmates({
        courseCode,
        subjects: get().subjects,
      });
      applyList(set, courseCode, result ?? { data: [], fetchedAt: Date.now() });
    } catch (e) {
      logError('SubjectClassmatesSlice.refresh', e, { courseCode });
      applyError(set, courseCode, e);
    }
  },
});

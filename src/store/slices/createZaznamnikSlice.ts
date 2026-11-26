import type { AppSlice, ZaznamnikSlice } from '../types';
import type { SubjectZaznamnik } from '../../types/zaznamnik';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import {
  clearNewPoints,
  NEW_POINTS_META_KEY,
  type NewPointsBySubject,
} from '../../services/sync/zaznamnikNewPoints';
import { pastZaznamnikVerdict, zaznamnikPeriod } from '../../utils/zaznamnik/pastSemester';

const isEmpty = (z: SubjectZaznamnik | null | undefined): boolean =>
  !z || (z.ph.sections.length === 0 && z.vt.tests.length === 0);

export const createZaznamnikSlice: AppSlice<ZaznamnikSlice> = (set, get) => ({
  zaznamnik: {},
  zaznamnikHydrated: false,
  zaznamnikLoading: {},
  pendingPastZaznamnik: {},
  zaznamnikNewPoints: {},
  setZaznamnikNewPoints: (unseen) => set({ zaznamnikNewPoints: unseen }),
  markZaznamnikSeen: async (courseCode) => {
    if (!get().zaznamnikNewPoints[courseCode]) return;
    set((s) => {
      const { [courseCode]: _seen, ...rest } = s.zaznamnikNewPoints;
      return { zaznamnikNewPoints: rest };
    });
    try {
      // Through the sync layer, the one writer to what is stored.
      await clearNewPoints(courseCode);
    } catch (err) {
      logError('ZaznamnikSlice.markZaznamnikSeen', err);
    }
  },
  setZaznamnikBatch: (data) => {
    set((state) => {
      const next = { ...state.zaznamnik };
      for (const [code, incoming] of Object.entries(data)) {
        // Preserve existing non-empty data when incoming is empty/null (transient parse failure)
        if (isEmpty(incoming) && !isEmpty(next[code])) continue;
        next[code] = incoming;
      }
      return { zaznamnik: next };
    });
  },
  fetchZaznamnik: async () => {
    try {
      const entries = await IndexedDBService.getAllWithKeys('zaznamnik');
      const map: Record<string, SubjectZaznamnik | null> = {};
      for (const { key, value } of entries) map[key] = value;
      const unseen = (await IndexedDBService.get('meta', NEW_POINTS_META_KEY)) as
        NewPointsBySubject | undefined;
      set({ zaznamnik: map, zaznamnikHydrated: true, zaznamnikNewPoints: unseen ?? {} });
    } catch (err) {
      logError('ZaznamnikSlice.fetchZaznamnik', err);
      set({ zaznamnikHydrated: true });
    }
  },
  // The drawer's retry for one subject. The sync is otherwise the only fetch,
  // so a failed subject stayed failed until the next full run (Návrhy #26).
  // Inert while impersonating, like the files slice: it would hit IS for
  // another programme's subject ids.
  refetchZaznamnik: async (courseCode) => {
    const { impersonation, studiumId, obdobiId, subjects, zaznamnikLoading } = get();
    const subject = subjects?.data?.[courseCode];
    const subjectId = subject?.subjectId;
    if (impersonation || !studiumId || !obdobiId || !subjectId) return;
    // One retry at a time: a second would race the first to the store.
    if (zaznamnikLoading[courseCode]) return;
    set((s) => ({ zaznamnikLoading: { ...s.zaznamnikLoading, [courseCode]: true } }));
    try {
      // Lazy: keeps the IS parsers out of the store's static graph. The sync
      // layer persists; the slice only puts the answer on screen.
      const { refetchSubjectZaznamnik } = await import('../../services/sync/syncZaznamnik');
      const fresh = await refetchSubjectZaznamnik(
        studiumId,
        // A past subject's points live under the period it was taken in.
        zaznamnikPeriod(subject, obdobiId),
        courseCode,
        subjectId
      );
      get().setZaznamnikBatch({ [courseCode]: fresh });
    } catch (err) {
      logError('ZaznamnikSlice.refetchZaznamnik', err);
      // A throw is a failure like a null answer: without it a past subject's
      // tab would stay "loading" (undefined), and the merge guard keeps real data.
      get().setZaznamnikBatch({ [courseCode]: null });
    } finally {
      set((s) => ({ zaznamnikLoading: { ...s.zaznamnikLoading, [courseCode]: false } }));
    }
  },
  // Opening a past-semester subject's drawer: the sync skips those, so its
  // points are fetched here. Opened before its inputs exist (a notification on
  // a cold start), the request is remembered, and watchPendingPastZaznamnik
  // asks again when they land.
  loadPastZaznamnik: async (courseCode) => {
    const verdict = pastZaznamnikVerdict(get(), courseCode);
    const pending = get().pendingPastZaznamnik[courseCode] === true;
    if (verdict === 'wait') {
      if (!pending)
        set((s) => ({ pendingPastZaznamnik: { ...s.pendingPastZaznamnik, [courseCode]: true } }));
      return;
    }
    if (pending) {
      set((s) => {
        const { [courseCode]: _done, ...rest } = s.pendingPastZaznamnik;
        return { pendingPastZaznamnik: rest };
      });
    }
    if (verdict === 'fetch') await get().refetchZaznamnik(courseCode);
  },
});

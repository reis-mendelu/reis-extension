import type { AppSlice, ZaznamnikSlice } from '../types';
import type { SubjectZaznamnik } from '../../types/zaznamnik';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';

const isEmpty = (z: SubjectZaznamnik | null | undefined): boolean =>
  !z || (z.ph.sections.length === 0 && z.vt.tests.length === 0);

export const createZaznamnikSlice: AppSlice<ZaznamnikSlice> = (set, get) => ({
  zaznamnik: {},
  zaznamnikHydrated: false,
  zaznamnikLoading: {},
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
      set({ zaznamnik: map, zaznamnikHydrated: true });
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
    const { impersonation, studiumId, obdobiId, subjects } = get();
    const subjectId = subjects?.data?.[courseCode]?.subjectId;
    if (impersonation || !studiumId || !obdobiId || !subjectId) return;
    set((s) => ({ zaznamnikLoading: { ...s.zaznamnikLoading, [courseCode]: true } }));
    try {
      // Lazy: keeps the IS parsers out of the store's static graph.
      const { fetchSubjectZaznamnik } = await import('../../api/zaznamnik');
      const fresh = await fetchSubjectZaznamnik(studiumId, obdobiId, subjectId);
      get().setZaznamnikBatch({ [courseCode]: fresh });
      if (!isEmpty(fresh)) await IndexedDBService.set('zaznamnik', courseCode, fresh!);
    } catch (err) {
      logError('ZaznamnikSlice.refetchZaznamnik', err);
    } finally {
      set((s) => ({ zaznamnikLoading: { ...s.zaznamnikLoading, [courseCode]: false } }));
    }
  },
});

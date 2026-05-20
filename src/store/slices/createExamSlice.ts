import type { ExamSlice, AppSlice } from '../types';
import type { ExamSubject } from '../../types/exams';
import { IndexedDBService } from '../../services/storage';
import { fetchExamClassmates } from '../../api/terminyInfo';
import { syncService } from '../../services/sync/SyncService';

const inFlightClassmates = new Set<string>();

function fanOutClassmates(
  data: ExamSubject[],
  studiumId: string | null,
  obdobiId: string | null,
  loadExamClassmates: (t: string, s: string, o: string) => Promise<void>,
) {
  if (!studiumId || !obdobiId) return;
  for (const sub of data) {
    for (const sec of sub.sections) {
      const tid = sec.registeredTerm?.id;
      if (!tid || tid.includes('-')) continue;
      void loadExamClassmates(tid, studiumId, obdobiId);
    }
  }
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
  loadExamClassmates: async (terminId, studiumId, obdobiId) => {
    if (get().examClassmates[terminId] !== undefined) return;
    if (inFlightClassmates.has(terminId)) return;
    inFlightClassmates.add(terminId);
    try {
      const idbKey = `exam:${terminId}`;

      const cached = await IndexedDBService.get('classmates', idbKey);
      if (cached !== undefined) {
        set(state => ({ examClassmates: { ...state.examClassmates, [terminId]: cached } }));
        return;
      }

      const result = await fetchExamClassmates(terminId, studiumId, obdobiId);
      if (result !== null) {
        set(state => ({ examClassmates: { ...state.examClassmates, [terminId]: result } }));
        IndexedDBService.set('classmates', idbKey, result).catch(() => {});
      }
    } finally {
      inFlightClassmates.delete(terminId);
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
      const { studiumId, obdobiId, loadExamClassmates } = get();
      fanOutClassmates(resolved, studiumId, obdobiId, loadExamClassmates);
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
    const { studiumId, obdobiId, loadExamClassmates } = get();
    fanOutClassmates(data, studiumId, obdobiId, loadExamClassmates);
  },
});

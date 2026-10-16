import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

/**
 * The study switcher, as the app receives it. The content script waits out
 * a crawl already running when the student switches, and that crawl keeps
 * pushing the study they left. The app's record already names the new study
 * ('st' here); a push stamped for the old one must not land under it.
 * Harness copied from useAppLogic.emptyOdevzdavarny.test.ts.
 */

const store = {
  loadContext: vi.fn(async () => {}),
  loadGradeHistory: vi.fn(),
  setPastAttendance: vi.fn(),
  setNavPages: vi.fn(),
  markSyncLoaded: vi.fn(),
  setSchedule: vi.fn(),
  setStudyStats: vi.fn(),
  setStudyComparison: vi.fn(),
  setCvicneTests: vi.fn(),
  setOdevzdavarny: vi.fn(),
  setExams: vi.fn(),
  setAttendance: vi.fn(),
  setZaznamnikBatch: vi.fn(),
  setSyncStatus: vi.fn(),
  fetchAllFiles: vi.fn(),
  fetchAllClassmates: vi.fn(),
  fetchAllExamClassmates: vi.fn(),
};

vi.mock('../../store/useAppStore', () => ({
  useAppStore: { getState: () => store, setState: setState, subscribe: vi.fn(() => vi.fn()) },
  initializeStore: vi.fn(async () => vi.fn()),
}));

const { idbSet, idbDelete, own, setState } = vi.hoisted(() => ({
  idbSet: vi.fn(async () => undefined),
  idbDelete: vi.fn(async () => undefined),
  setState: vi.fn(),
  own: { studium: 'st' },
}));
vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (store: string, key: string) =>
      store === 'meta' && key === 'reis_user_params'
        ? { studium: own.studium, obdobi: 'ob' }
        : undefined
    ),
    set: idbSet,
    delete: idbDelete,
  },
}));

// forgetPreviousStudy imports the implementation file directly.
vi.mock('../../services/storage/IndexedDBService', () => ({
  IndexedDBService: { delete: idbDelete, set: idbSet, get: vi.fn(async () => undefined) },
}));
vi.mock('../../services/sync', () => ({
  syncService: { triggerRefresh: vi.fn() },
  syncGradeHistory: vi.fn(async () => undefined),
}));
vi.mock('../../services/loadRealDataSnapshot', () => ({
  loadRealDataSnapshot: vi.fn(async () => false),
}));
vi.mock('../../api/proxyClient', () => ({
  isInIframe: vi.fn(() => false),
  signalReady: vi.fn(),
  requestData: vi.fn(),
}));
vi.mock('../../platform', () => ({ getPlatform: vi.fn(() => ({ kind: 'web' })) }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { useAppLogic } from '../useAppLogic';

async function push(data: Record<string, unknown>): Promise<void> {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'REIS_SYNC_UPDATE', data },
      origin: window.location.origin,
      source: window,
    })
  );
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('a sync push for the study the student switched away from', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    own.studium = 'st';
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_USE_MOCK_DATA', '');
    renderHook(() => useAppLogic());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("keeps the old study's exams, tests and boxes out, and the timetable in", async () => {
    await push({
      studium: 'old',
      schedule: [{ id: 'l1' }],
      exams: [{ code: 'OLD' }],
      cvicneTests: [{ id: 't1' }],
      odevzdavarny: [{ id: 'a1' }],
      loaded: ['schedule', 'exams'],
    });

    expect(store.setSchedule).toHaveBeenCalledWith([{ id: 'l1' }]);
    expect(store.markSyncLoaded).toHaveBeenCalledWith(['schedule']);
    expect(store.setExams).not.toHaveBeenCalled();
    expect(store.setCvicneTests).not.toHaveBeenCalled();
    expect(store.setOdevzdavarny).not.toHaveBeenCalled();
    expect(idbSet).not.toHaveBeenCalledWith('cvicne_tests', expect.anything(), expect.anything());
    // And the app re-asks IS for its own study, in case it is the one behind.
    expect(store.loadContext).toHaveBeenCalled();
  });

  // The new study has no exam terms: "none" must replace the old study's
  // list, which setExams otherwise keeps over an empty answer.
  it("replaces the previous study's exams with the new study's first answer", async () => {
    await push({ studium: 'st', exams: [{ code: 'OLD' }] });
    own.studium = 'st2';
    store.setExams.mockClear();
    await push({ studium: 'st2', schedule: [{ id: 'l1' }] });
    expect(store.setExams).toHaveBeenCalledWith([], { replace: true });
    // Not carried by that push, and not keyed by study: the previous
    // study's subjects and plan go rather than stand under the new name.
    expect(setState).toHaveBeenCalledWith({ subjects: null });
    expect(setState).toHaveBeenCalledWith({ studyPlanDual: null });
    expect(idbDelete).toHaveBeenCalledWith('subjects', 'current');
    expect(idbDelete).toHaveBeenCalledWith('study_plan', 'current');
    store.setExams.mockClear();
    await push({ studium: 'st2', exams: [] });
    expect(store.setExams).not.toHaveBeenCalledWith([], { replace: true });
  });

  // Done-when 4: an install left on an interrupted study is corrected at
  // start. The app mounted on the old record, so that is a switch too.
  it('treats the correcting start like a switch', async () => {
    cleanup();
    own.studium = 'old';
    renderHook(() => useAppLogic());
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
    own.studium = 'st';
    await push({ studium: 'st', schedule: [{ id: 'l1' }] });
    expect(store.setExams).toHaveBeenCalledWith([], { replace: true });
    expect(setState).toHaveBeenCalledWith({ subjects: null });
  });

  it("ends the switcher's loading state on the new study's first push", async () => {
    (store as Record<string, unknown>).studyPendingFor = 'st';
    await push({ studium: 'st', schedule: [{ id: 'l1' }] });
    expect(setState).toHaveBeenCalledWith({ studyPendingFor: null });
    delete (store as Record<string, unknown>).studyPendingFor;
  });

  it('takes a push for the study in use as before', async () => {
    await push({ studium: 'st', exams: [{ code: 'NEW' }], cvicneTests: [{ id: 't2' }] });
    expect(store.setExams).toHaveBeenCalledWith([{ code: 'NEW' }]);
    expect(idbSet).toHaveBeenCalledWith('cvicne_tests', 'st', [{ id: 't2' }]);
  });
});

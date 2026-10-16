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
  useAppStore: { getState: () => store, subscribe: vi.fn(() => vi.fn()) },
  initializeStore: vi.fn(async () => vi.fn()),
}));

const { idbSet } = vi.hoisted(() => ({ idbSet: vi.fn(async () => undefined) }));
vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (store: string, key: string) =>
      store === 'meta' && key === 'reis_user_params' ? { studium: 'st', obdobi: 'ob' } : undefined
    ),
    set: idbSet,
  },
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
  });

  it('takes a push for the study in use as before', async () => {
    await push({ studium: 'st', exams: [{ code: 'NEW' }], cvicneTests: [{ id: 't2' }] });
    expect(store.setExams).toHaveBeenCalledWith([{ code: 'NEW' }]);
    expect(idbSet).toHaveBeenCalledWith('cvicne_tests', 'st', [{ id: 't2' }]);
  });
});

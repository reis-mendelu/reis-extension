import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

/**
 * The layer that made the blank timetable survive a restart.
 *
 * `if (r.schedule)` is true for `[]`, so an empty sync push both replaced the
 * store's lessons and wrote `[]` over `schedule/current` in IndexedDB. The
 * student then reopened the app to the same nothing, because the cache that
 * would have saved them had been destroyed.
 *
 * Guarding on `r.schedule?.length` costs one thing, accepted deliberately: a
 * student whose term genuinely ends keeps last term's lessons until the next
 * successful fetch. That is the same trade the exams path already makes.
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
  IndexedDBService: { get: vi.fn(async () => undefined), set: idbSet },
}));

vi.mock('../../services/sync', () => ({
  syncService: { triggerRefresh: vi.fn() },
  syncGradeHistory: vi.fn(async () => undefined),
}));
vi.mock('../useSpolkySettings', () => ({ useSpolkySettings: vi.fn() }));
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

const LESSONS = [{ id: 'l1', date: '20260921' }];

/** Posts a sync update through the hook's real listener and lets it settle. */
async function push(schedule: unknown): Promise<void> {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'REIS_SYNC_UPDATE', data: { schedule, loaded: ['schedule'] } },
      origin: window.location.origin,
      source: window,
    })
  );
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('an empty schedule push does not destroy the cached timetable', () => {
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

  it('writes neither the store nor IndexedDB for an empty lesson list', async () => {
    await push([]);

    expect(store.setSchedule).not.toHaveBeenCalled();
    expect(idbSet).not.toHaveBeenCalledWith('schedule', 'current', expect.anything());
    // The arrival signal is still honoured — that is what stops the skeleton.
    expect(store.markSyncLoaded).toHaveBeenCalledWith(['schedule']);
  });

  it('still writes both for a real timetable', async () => {
    await push(LESSONS);

    expect(store.setSchedule).toHaveBeenCalledWith(LESSONS);
    expect(idbSet).toHaveBeenCalledWith('schedule', 'current', LESSONS);
  });
});

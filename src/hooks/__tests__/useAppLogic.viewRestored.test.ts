import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';

/**
 * The extension boots on 'calendar' and then restores the saved view from
 * IndexedDB. `viewRestored` is what the calendar's screen counter waits for
 * (screenSignalsHaveBothTrees.test.ts): without it, a student who left reIS on
 * Předměty counted as having opened the calendar on every launch — and a fixed
 * delay only moves the problem to a slow read.
 */

const store = {
  loadGradeHistory: vi.fn(),
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

const { idbGet } = vi.hoisted(() => ({ idbGet: vi.fn() }));
vi.mock('../../services/storage', () => ({
  IndexedDBService: { get: idbGet, set: vi.fn(async () => undefined) },
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

/** A read that resolves only when the test says so — a slow IndexedDB. */
function slowRead() {
  let resolve!: (v: unknown) => void;
  const pending = new Promise((r) => (resolve = r));
  idbGet.mockImplementation((_store: string, key: string) =>
    key === 'reis_current_view' ? pending : Promise.resolve(undefined)
  );
  return resolve;
}

const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('useAppLogic — viewRestored', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_USE_MOCK_DATA', '');
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('stays false on the boot calendar until the saved view is read, however long that takes', async () => {
    const resolve = slowRead();
    const { result } = renderHook(() => useAppLogic());
    await flush();
    expect(result.current.currentView).toBe('calendar');
    expect(result.current.viewRestored).toBe(false);

    await act(async () => {
      resolve('subjects');
      await flush();
    });
    expect(result.current.currentView).toBe('subjects');
    expect(result.current.viewRestored).toBe(true);
  });

  // A failed read leaves the student on the calendar for real, so it counts.
  it('turns true when the read fails', async () => {
    idbGet.mockImplementation(() => Promise.reject(new Error('idb')));
    const { result } = renderHook(() => useAppLogic());
    await act(flush);
    expect(result.current.currentView).toBe('calendar');
    expect(result.current.viewRestored).toBe(true);
  });
});

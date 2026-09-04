import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

// useAppLogic pulls in the whole store and its slices; none of that is
// relevant to the guard under test, so the store is replaced with a stub
// exposing just the methods the hook's effects touch.
vi.mock('../../store/useAppStore', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
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
    })),
    subscribe: vi.fn(() => vi.fn()),
  },
  initializeStore: vi.fn(async () => vi.fn()),
}));

vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
  },
}));

vi.mock('../../services/sync', () => ({
  syncService: { triggerRefresh: vi.fn() },
  syncGradeHistory: vi.fn(async () => undefined),
}));

vi.mock('../useSpolkySettings', () => ({
  useSpolkySettings: vi.fn(),
}));

vi.mock('../../services/loadRealDataSnapshot', () => ({
  loadRealDataSnapshot: vi.fn(async () => false),
}));

// isInIframe forced false and getPlatform forced 'web': isolates the test to
// the harness (DEV / VITE_PREVIEW_BUILD) half of the gate, the half this
// defect is about. isInIframe/capacitor have their own, separate attachment
// paths untouched by this change.
vi.mock('../../api/proxyClient', () => ({
  isInIframe: vi.fn(() => false),
  signalReady: vi.fn(),
  requestData: vi.fn(),
}));

vi.mock('../../platform', () => ({
  getPlatform: vi.fn(() => ({ kind: 'web' })),
}));

vi.mock('../../utils/reportError', () => ({
  logError: vi.fn(),
}));

import { useAppLogic } from '../useAppLogic';

describe('useAppLogic real-data-mode listener attachment', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener');
  });

  afterEach(() => {
    cleanup();
    addSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('attaches the REIS_SYNC_UPDATE listener in a preview build (DEV false, VITE_PREVIEW_BUILD true)', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_PREVIEW_BUILD', 'true');
    vi.stubEnv('VITE_USE_MOCK_DATA', '');

    renderHook(() => useAppLogic());

    const attachedMessage = addSpy.mock.calls.some((call) => call[0] === 'message');
    expect(attachedMessage).toBe(true);
  });

  it('does not attach the REIS_SYNC_UPDATE listener when neither DEV nor VITE_PREVIEW_BUILD is set (the shipped-extension env-var signature)', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_PREVIEW_BUILD', '');
    vi.stubEnv('VITE_USE_MOCK_DATA', '');

    renderHook(() => useAppLogic());

    const attachedMessage = addSpy.mock.calls.some((call) => call[0] === 'message');
    expect(attachedMessage).toBe(false);
  });
});

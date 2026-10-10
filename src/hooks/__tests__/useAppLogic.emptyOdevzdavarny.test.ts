import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

/**
 * The opposite trade from the schedule: an empty submission-box list is data.
 *
 * The parser answers null for a page it does not recognise, and the sync then
 * leaves the key out, so `odevzdavarny: []` only ever means "IS lists no boxes".
 * Guarding on `.length` kept a deleted box — or last period's list — forever.
 * A message WITHOUT the key (early pushes, partial updates) still changes nothing.
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

describe('a sync push carrying the submission-box list', () => {
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

  it('clears the store and IndexedDB when IS now lists no boxes', async () => {
    await push({ odevzdavarny: [] });

    expect(store.setOdevzdavarny).toHaveBeenCalledWith([]);
    expect(idbSet).toHaveBeenCalledWith('odevzdavarny', 'st_ob', []);
  });

  it('leaves both alone when the message does not carry the list', async () => {
    await push({ exams: [] });

    expect(store.setOdevzdavarny).not.toHaveBeenCalled();
    expect(idbSet).not.toHaveBeenCalledWith('odevzdavarny', expect.anything(), expect.anything());
  });
});

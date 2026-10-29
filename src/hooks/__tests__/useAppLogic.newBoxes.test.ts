import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

/**
 * A sync push carrying the submission-box list is checked for boxes this
 * device has not seen before; what is still unseen goes to the store.
 */

const store = {
  loadGradeHistory: vi.fn(),
  setNavPages: vi.fn(),
  markSyncLoaded: vi.fn(),
  setOdevzdavarny: vi.fn(),
  setOdevzdavarnyNew: vi.fn(),
  setExams: vi.fn(),
  setSyncStatus: vi.fn(),
  fetchAllFiles: vi.fn(),
  fetchAllClassmates: vi.fn(),
  fetchAllExamClassmates: vi.fn(),
};

vi.mock('../../store/useAppStore', () => ({
  useAppStore: { getState: () => store, subscribe: vi.fn(() => vi.fn()) },
  initializeStore: vi.fn(async () => vi.fn()),
}));
vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (store: string, key: string) =>
      store === 'meta' && key === 'reis_user_params' ? { studium: 'st', obdobi: 'ob' } : undefined
    ),
    set: vi.fn(async () => undefined),
  },
}));
const { persistNewBoxes } = vi.hoisted(() => ({ persistNewBoxes: vi.fn() }));
vi.mock('../../services/sync/newSubmissionBoxes', () => ({ persistNewBoxes }));
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

const BOX = { odevzdavarnaId: '9001', courseId: '1', name: 'Projekt' };

describe('a sync push carrying the submission boxes', () => {
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

  it('checks the list for new boxes and hands the unseen ones to the store', async () => {
    persistNewBoxes.mockResolvedValue({ found: ['9001'], unseen: ['9001'] });
    await push({ odevzdavarny: [BOX] });

    expect(persistNewBoxes).toHaveBeenCalledWith([BOX], 'ob');
    expect(store.setOdevzdavarnyNew).toHaveBeenCalledWith(['9001']);
  });

  // The check is extra: if it fails, the rest of the push is still stored.
  it('a failed check does not stop the rest of the push', async () => {
    persistNewBoxes.mockRejectedValue(new Error('aborted'));
    await push({ odevzdavarny: [BOX], exams: [] });

    expect(store.setOdevzdavarny).toHaveBeenCalledWith([BOX]);
    expect(store.setExams).toHaveBeenCalledWith([]);
  });

  it('a push without the list checks nothing', async () => {
    await push({ exams: [] });
    expect(persistNewBoxes).not.toHaveBeenCalled();
  });
});

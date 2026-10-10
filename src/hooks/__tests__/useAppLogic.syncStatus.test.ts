import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

/**
 * Návrhy #26: the sync's `lastSync` and `error` never reached the store.
 *
 * useAppLogic forwarded REIS_SYNC_UPDATE as `{ isSyncing }` alone, so every
 * attached diagnostic log said `lastSync: null`, an open subject drawer (which
 * re-reads on `lastSync`) never refreshed after a sync, and the Předměty error
 * screen keyed on `syncStatus.error` could not be reached.
 *
 * `lastSync` is taken only from the message that ENDS a run. The sync stamps
 * it before Phase 3, so the early `isSyncing: true` pushes already carry the new
 * value — taking it there would make the open drawer refetch its folder while
 * the sync is still crawling the same one.
 */

const store = {
  loadGradeHistory: vi.fn(),
  setPastAttendance: vi.fn(),
  markSyncLoaded: vi.fn(),
  setSchedule: vi.fn(),
  setExams: vi.fn(),
  setZaznamnikBatch: vi.fn(),
  setSyncStatus: vi.fn(),
  seedLastSync: vi.fn(),
  fetchAllFiles: vi.fn(),
  fetchAllClassmates: vi.fn(),
  fetchAllExamClassmates: vi.fn(),
};

vi.mock('../../store/useAppStore', () => ({
  useAppStore: { getState: () => store, subscribe: vi.fn(() => vi.fn()) },
  initializeStore: vi.fn(async () => vi.fn()),
}));

const { idbGet } = vi.hoisted(() => ({
  idbGet: vi.fn(async (_store: string, _key: string): Promise<unknown> => undefined),
}));
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

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

async function push(data: Record<string, unknown>): Promise<void> {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'REIS_SYNC_UPDATE', data },
      origin: window.location.origin,
      source: window,
    })
  );
  await settle();
}

describe('sync status reaches the store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_USE_MOCK_DATA', '');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('takes lastSync from the message that ends a run', async () => {
    renderHook(() => useAppLogic());
    await push({ isSyncing: false, lastSync: 1_700_000_000_000 });

    expect(store.setSyncStatus).toHaveBeenCalledWith({
      isSyncing: false,
      lastSync: 1_700_000_000_000,
    });
  });

  it("ignores the injector's 0 no-stamp sentinel", async () => {
    // cachedData.lastSync starts at 0; a boot run that throws before Phase 2
    // posts it. Taking it would block the IndexedDB seed and show 0.
    renderHook(() => useAppLogic());
    await push({ isSyncing: false, error: 'boom', lastSync: 0 });

    expect(store.setSyncStatus).toHaveBeenCalledWith({ isSyncing: false, error: 'boom' });
  });

  it('ignores lastSync on a push from a run still in flight', async () => {
    renderHook(() => useAppLogic());
    await push({ isSyncing: true, lastSync: 1_700_000_000_000 });

    expect(store.setSyncStatus).toHaveBeenCalledWith({ isSyncing: true });
  });

  it("forwards the run's error", async () => {
    renderHook(() => useAppLogic());
    await push({ isSyncing: false, error: 'TypeError: Failed to fetch', lastSync: 5 });

    expect(store.setSyncStatus).toHaveBeenCalledWith({
      isSyncing: false,
      error: 'TypeError: Failed to fetch',
      lastSync: 5,
    });
  });

  it('does not clear a stored value with a key the message never carried', async () => {
    renderHook(() => useAppLogic());
    await push({ isSyncing: false });

    expect(store.setSyncStatus).toHaveBeenCalledWith({ isSyncing: false });
  });

  it('seeds lastSync from IndexedDB at boot', async () => {
    idbGet.mockImplementation(async (s: string, k: string) =>
      s === 'meta' && k === 'last_sync' ? 1_600_000_000_000 : undefined
    );
    renderHook(() => useAppLogic());
    await settle();

    expect(store.seedLastSync).toHaveBeenCalledWith(1_600_000_000_000);
  });

  it('seeds nothing when IndexedDB has no stamp', async () => {
    idbGet.mockImplementation(async () => undefined);
    renderHook(() => useAppLogic());
    await settle();

    expect(store.seedLastSync).not.toHaveBeenCalled();
  });
});

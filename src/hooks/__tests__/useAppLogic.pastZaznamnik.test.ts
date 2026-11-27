import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';

/**
 * The desktop drawer opens through setSelectedSubject. That is where a past
 * semester's points are asked for (the sync skips those subjects), not in a
 * component effect.
 */

const store = { loadPastZaznamnik: vi.fn(async () => undefined) };

vi.mock('../../store/useAppStore', () => ({
  useAppStore: { getState: () => store, subscribe: vi.fn(() => vi.fn()) },
  initializeStore: vi.fn(async () => vi.fn()),
}));
vi.mock('../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) },
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

describe('useAppLogic setSelectedSubject', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("asks for the subject's past-semester points when its drawer opens, and not on close", async () => {
    const { result } = renderHook(() => useAppLogic());

    await act(async () => {
      result.current.setSelectedSubject({ courseCode: 'PS', courseName: 'PS', id: 'x' } as never);
    });
    expect(store.loadPastZaznamnik).toHaveBeenCalledWith('PS');
    expect(result.current.selectedSubject?.courseCode).toBe('PS');

    store.loadPastZaznamnik.mockClear();
    await act(async () => {
      result.current.setSelectedSubject(null);
    });
    expect(store.loadPastZaznamnik).not.toHaveBeenCalled();
  });
});

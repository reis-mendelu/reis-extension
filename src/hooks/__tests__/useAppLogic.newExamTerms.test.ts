import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

/**
 * "No exams" arrives as `loaded: ['exams']` with no list (the sync keeps the
 * cached list rather than let an empty read wipe it). That answer still has to
 * start the record of known terms: otherwise a student who has no dates yet —
 * most of them, before the exam period — gets their first published date
 * swallowed as the baseline.
 */

const { persistExamTerms } = vi.hoisted(() => ({ persistExamTerms: vi.fn(async () => []) }));
vi.mock('../../services/sync/newExamTerms', () => ({ persistExamTerms }));
vi.mock('../../services/sync/examTermsUnseen', () => ({ addUnseenTerms: vi.fn(async () => []) }));

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
  setExamTermsNew: vi.fn(),
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

describe('the known exam terms on a sync push', () => {
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

  it('records an answered empty exam list as known: no terms yet', async () => {
    await push({ loaded: ['exams'] });
    expect(persistExamTerms).toHaveBeenCalledWith([]);
  });

  it('records a list that has terms', async () => {
    const exams = [{ code: 'EBC-A', sections: [] }];
    await push({ exams, loaded: ['exams'] });
    expect(persistExamTerms).toHaveBeenCalledWith(exams);
  });

  it('leaves the record alone when exams did not answer', async () => {
    await push({ loaded: ['schedule'] });
    expect(persistExamTerms).not.toHaveBeenCalled();
  });
});

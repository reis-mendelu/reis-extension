import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

/**
 * A sync push carrying the záznamník goes through the comparison before it is
 * stored: the highlight gets everything still unseen, the notifier only what
 * this push found.
 */

const store: Record<string, unknown> & { studyPlanDual?: unknown } = {
  loadGradeHistory: vi.fn(),
  setNavPages: vi.fn(),
  markSyncLoaded: vi.fn(),
  setZaznamnikBatch: vi.fn(),
  setZaznamnikNewPoints: vi.fn(),
  setSyncStatus: vi.fn(),
  fetchAllFiles: vi.fn(),
  fetchAllClassmates: vi.fn(),
  fetchAllExamClassmates: vi.fn(),
};

vi.mock('../../store/useAppStore', () => ({
  useAppStore: { getState: () => store, subscribe: vi.fn(() => vi.fn()) },
  initializeStore: vi.fn(async () => vi.fn()),
}));
const idb = vi.hoisted(() => ({ studyPlan: undefined as unknown }));
vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (store: string, key: string) =>
      store === 'meta' && key === 'reis_user_params'
        ? { studium: 'st', obdobi: 'ob' }
        : store === 'study_plan'
          ? idb.studyPlan
          : undefined
    ),
    set: vi.fn(async () => undefined),
    setMany: vi.fn(async () => undefined),
  },
}));
const { persistZaznamnikBatch, notifyNewPoints } = vi.hoisted(() => ({
  persistZaznamnikBatch: vi.fn(),
  notifyNewPoints: vi.fn(),
}));
vi.mock('../../services/sync/zaznamnikNewPoints', () => ({ persistZaznamnikBatch }));
vi.mock('../../services/newPointsNotifier', () => ({ notifyNewPoints }));
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

const POINT = { label: 'IPv4-subnt-NAOPAK', value: '9' };

describe('a sync push carrying the záznamník', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.studyPlanDual = null;
    idb.studyPlan = undefined;
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_USE_MOCK_DATA', '');
    renderHook(() => useAppLogic());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('stores through the comparison, highlights the unseen, notifies the found', async () => {
    persistZaznamnikBatch.mockResolvedValue({
      found: { 'EBC-PS': [POINT] },
      unseen: { 'EBC-PS': [POINT], 'EBC-VWA': [{ label: '2', value: '1' }] },
    });
    const batch = { 'EBC-PS': { ph: { sections: [] }, vt: { tests: [] } } };
    await push({ zaznamnik: batch });

    expect(store.setZaznamnikBatch).toHaveBeenCalledWith(batch);
    expect(persistZaznamnikBatch).toHaveBeenCalledWith(batch);
    expect(store.setZaznamnikNewPoints).toHaveBeenCalledWith({
      'EBC-PS': [POINT],
      'EBC-VWA': [{ label: '2', value: '1' }],
    });
    expect(notifyNewPoints).toHaveBeenCalledWith({ 'EBC-PS': [POINT] });
  });

  // Task List, 2026-11-07: never a notification about last semester's subject.
  // The highlight still gets it; Novinky filters on read (useDeadlineAlerts).
  const failedBefore = {
    id: '1',
    code: 'XX-OLD',
    name: 'Stará',
    credits: 5,
    type: 'zk',
    isEnrolled: false,
    isFulfilled: false,
    enrollmentCount: 1,
    rawStatusText: 'NESPLNĚNO',
  };
  const plan = {
    title: 'p',
    isFulfilled: false,
    creditsAcquired: 0,
    creditsRequired: 180,
    blocks: [
      {
        title: '2. semestr',
        groups: [{ name: 'g', statusDescription: '', subjects: [failedBefore] }],
      },
    ],
  };
  const found = { 'XX-OLD': [POINT], 'EBC-PS': [POINT] };
  const batch = { 'XX-OLD': { ph: { sections: [] }, vt: { tests: [] } } };
  const notifiedOnlyCurrent = () => {
    expect(notifyNewPoints).toHaveBeenCalledTimes(1);
    expect(notifyNewPoints).toHaveBeenCalledWith({ 'EBC-PS': [POINT] });
  };

  it('notifies nothing about a subject the plan places in an earlier semester', async () => {
    store.studyPlanDual = { cz: plan, en: plan };
    persistZaznamnikBatch.mockResolvedValue({ found, unseen: found });
    await push({ zaznamnik: batch });

    expect(store.setZaznamnikNewPoints).toHaveBeenCalledWith(found);
    notifiedOnlyCurrent();
  });

  // The store reloads the plan only once the sync ends: this run's plan decides.
  it('decides by the plan in the same push, over the store’s', async () => {
    persistZaznamnikBatch.mockResolvedValue({ found, unseen: found });
    await push({ zaznamnik: batch, studyPlan: { cz: plan, en: plan } });
    notifiedOnlyCurrent();
  });

  it('decides by the plan an earlier push of the run stored', async () => {
    idb.studyPlan = { cz: plan, en: plan };
    persistZaznamnikBatch.mockResolvedValue({ found, unseen: found });
    await push({ zaznamnik: batch });
    notifiedOnlyCurrent();
  });

  it('a push without the key compares nothing', async () => {
    await push({ exams: [] });
    expect(persistZaznamnikBatch).not.toHaveBeenCalled();
    expect(notifyNewPoints).not.toHaveBeenCalled();
  });
});

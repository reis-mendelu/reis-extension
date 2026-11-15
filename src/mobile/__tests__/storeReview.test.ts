import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StoreReviewState } from '../../utils/storeReviewDecision';

let kind: 'capacitor' | 'extension' = 'capacitor';
let demo = false;
vi.mock('../../platform', () => ({ getPlatform: () => ({ kind }) }));
vi.mock('../../errors/demoMode', () => ({ isDemoMode: () => demo }));
const logError = vi.hoisted(() => vi.fn());
vi.mock('../../utils/reportError', () => ({ logError }));

const db = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../services/storage/IndexedDBService', () => ({
  IndexedDBService: {
    get: vi.fn(async (_store: string, key: string) => db.get(key)),
    set: vi.fn(async (_store: string, key: string, value: unknown) => {
      db.set(key, value);
    }),
  },
}));

const requestReview = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@capacitor-community/in-app-review', () => ({ InAppReview: { requestReview } }));

const KEY = 'store_review';
const seasoned: StoreReviewState = {
  firstDay: '2026-11-01',
  lastDay: '2026-11-08',
  daysUsed: 5,
  lastAskedDay: null,
};

async function load() {
  return import('../storeReview');
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Midday in Brno on 15 Nov 2026.
  vi.setSystemTime(new Date('2026-11-15T11:00:00Z'));
  db.clear();
  kind = 'capacitor';
  demo = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('noteAppUsedToday', () => {
  it('starts the record on the first open and counts a day once', async () => {
    const { noteAppUsedToday } = await load();
    await noteAppUsedToday();
    await noteAppUsedToday();
    expect(db.get(KEY)).toEqual({
      firstDay: '2026-11-15',
      lastDay: '2026-11-15',
      daysUsed: 1,
      lastAskedDay: null,
    });
  });

  it('counts nothing in the extension', async () => {
    kind = 'extension';
    const { noteAppUsedToday } = await load();
    await noteAppUsedToday();
    expect(db.has(KEY)).toBe(false);
  });
});

describe('maybeAskForStoreReview', () => {
  it('asks the OS after a short pause, and writes the ask down first', async () => {
    db.set(KEY, seasoned);
    const { maybeAskForStoreReview, ASK_DELAY_MS } = await load();
    expect(await maybeAskForStoreReview('exam_registered')).toBe(true);
    expect((db.get(KEY) as StoreReviewState).lastAskedDay).toBe('2026-11-15');
    expect(requestReview).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(ASK_DELAY_MS);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('does not ask before the usage gates pass', async () => {
    db.set(KEY, { ...seasoned, daysUsed: 2 });
    const { maybeAskForStoreReview } = await load();
    expect(await maybeAskForStoreReview('exam_registered')).toBe(false);
    await vi.runAllTimersAsync();
    expect(requestReview).not.toHaveBeenCalled();
  });

  it('never asks in the extension, whatever the record says', async () => {
    kind = 'extension';
    db.set(KEY, seasoned);
    const { maybeAskForStoreReview } = await load();
    expect(await maybeAskForStoreReview('exam_registered')).toBe(false);
  });

  it('never asks in the App Review demo', async () => {
    demo = true;
    db.set(KEY, seasoned);
    const { maybeAskForStoreReview } = await load();
    expect(await maybeAskForStoreReview('exam_registered')).toBe(false);
  });

  it('two successes close together ask once', async () => {
    db.set(KEY, seasoned);
    const { maybeAskForStoreReview } = await load();
    const both = await Promise.all([
      maybeAskForStoreReview('exam_registered'),
      maybeAskForStoreReview('exam_registered'),
    ]);
    expect(both.filter(Boolean)).toHaveLength(1);
    await vi.runAllTimersAsync();
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('a plugin that refuses (Android outside Play) is logged, not thrown', async () => {
    db.set(KEY, seasoned);
    requestReview.mockRejectedValueOnce(new Error('Request review task Failed'));
    const { maybeAskForStoreReview } = await load();
    await maybeAskForStoreReview('exam_registered');
    await vi.runAllTimersAsync();
    expect(logError).toHaveBeenCalledWith('Mobile.storeReview', expect.any(Error));
  });
});

describe('storeReviewAfterReaderClosed', () => {
  it('counts the files the reader showed, and asks on the close that reaches the 3rd', async () => {
    db.set(KEY, seasoned);
    const { storeReviewAfterReaderClosed, ASK_DELAY_MS } = await load();
    expect(await storeReviewAfterReaderClosed(1)).toBe(false);
    expect(await storeReviewAfterReaderClosed(1)).toBe(false);
    expect((db.get(KEY) as StoreReviewState).filesOpened).toBe(2);
    expect(await storeReviewAfterReaderClosed(1)).toBe(true);
    expect((db.get(KEY) as StoreReviewState).filesOpened).toBe(3);
    await vi.advanceTimersByTimeAsync(ASK_DELAY_MS);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('one reader session that showed three files is enough', async () => {
    db.set(KEY, seasoned);
    const { storeReviewAfterReaderClosed } = await load();
    expect(await storeReviewAfterReaderClosed(3)).toBe(true);
  });

  it('counts files even before the day gates pass, and does not ask', async () => {
    db.set(KEY, { ...seasoned, daysUsed: 2 });
    const { storeReviewAfterReaderClosed } = await load();
    expect(await storeReviewAfterReaderClosed(4)).toBe(false);
    expect((db.get(KEY) as StoreReviewState).filesOpened).toBe(4);
  });

  it('counts nothing in the extension', async () => {
    kind = 'extension';
    db.set(KEY, seasoned);
    const { storeReviewAfterReaderClosed } = await load();
    expect(await storeReviewAfterReaderClosed(3)).toBe(false);
    expect((db.get(KEY) as StoreReviewState).filesOpened).toBeUndefined();
  });

  it('the exam moment does not wait for files', async () => {
    db.set(KEY, { ...seasoned, filesOpened: 0 });
    const { maybeAskForStoreReview } = await load();
    expect(await maybeAskForStoreReview('exam_registered')).toBe(true);
  });

  it('eduroam is no longer a moment', async () => {
    const { STORE_REVIEW_MOMENTS } = await load();
    expect(Object.keys(STORE_REVIEW_MOMENTS).sort()).toEqual([
      'exam_registered',
      'file_reader_closed',
    ]);
  });
});

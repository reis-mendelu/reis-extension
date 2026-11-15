import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StoreReviewState } from '../../utils/storeReviewDecision';

let kind: 'capacitor' | 'extension' = 'capacitor';
let demo = false;
vi.mock('../../platform', () => ({ getPlatform: () => ({ kind }) }));
vi.mock('../../errors/demoMode', () => ({ isDemoMode: () => demo }));
const logError = vi.hoisted(() => vi.fn());
vi.mock('../../utils/reportError', () => ({ logError }));

const db = vi.hoisted(() => new Map<string, unknown>());
// A few awaits per call, like a real IndexedDB round trip, so two callers that
// are not serialised really do interleave their reads and writes.
const tick = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve();
};
vi.mock('../../services/storage/IndexedDBService', () => ({
  STORE_REVIEW_KEY: 'store_review',
  IndexedDBService: {
    get: vi.fn(async (_store: string, key: string) => {
      await tick();
      return db.get(key);
    }),
    set: vi.fn(async (_store: string, key: string, value: unknown) => {
      await tick();
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
  const READ = 45_000;

  it('counts files read for 30 s, and asks on the close that reaches the 3rd', async () => {
    db.set(KEY, seasoned);
    const { storeReviewAfterReaderClosed, ASK_DELAY_MS } = await load();
    expect(await storeReviewAfterReaderClosed(READ, 1)).toBe(false);
    expect(await storeReviewAfterReaderClosed(READ, 1)).toBe(false);
    expect((db.get(KEY) as StoreReviewState).filesOpened).toBe(2);
    expect(await storeReviewAfterReaderClosed(READ, 1)).toBe(true);
    expect((db.get(KEY) as StoreReviewState).filesOpened).toBe(3);
    await vi.advanceTimersByTimeAsync(ASK_DELAY_MS);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('a quick "wrong file, close" neither counts nor asks, even past the 3rd file', async () => {
    db.set(KEY, { ...seasoned, filesOpened: 3 });
    const { storeReviewAfterReaderClosed } = await load();
    expect(await storeReviewAfterReaderClosed(5_000, 1)).toBe(false);
    expect((db.get(KEY) as StoreReviewState).filesOpened).toBe(3);
    await vi.runAllTimersAsync();
    expect(requestReview).not.toHaveBeenCalled();
  });

  it('one long session that showed three files counts as one', async () => {
    db.set(KEY, seasoned);
    const { storeReviewAfterReaderClosed } = await load();
    expect(await storeReviewAfterReaderClosed(READ, 3)).toBe(false);
    expect((db.get(KEY) as StoreReviewState).filesOpened).toBe(1);
  });

  it('counts files even before the day gates pass, and does not ask', async () => {
    db.set(KEY, { ...seasoned, daysUsed: 2, filesOpened: 3 });
    const { storeReviewAfterReaderClosed } = await load();
    expect(await storeReviewAfterReaderClosed(READ, 1)).toBe(false);
    expect((db.get(KEY) as StoreReviewState).filesOpened).toBe(4);
  });

  it('counts nothing in the extension', async () => {
    kind = 'extension';
    db.set(KEY, seasoned);
    const { storeReviewAfterReaderClosed } = await load();
    expect(await storeReviewAfterReaderClosed(READ, 1)).toBe(false);
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

// Returning from the background runs the day count while a success moment may
// be asking. Both rewrite the same record; neither may undo the other.
describe('concurrent updates', () => {
  it('a day count racing an ask keeps both the new day and the ask', async () => {
    db.set(KEY, seasoned); // lastDay 2026-11-08, today is the 15th
    const { maybeAskForStoreReview, noteAppUsedToday } = await load();
    await Promise.all([maybeAskForStoreReview('exam_registered'), noteAppUsedToday()]);
    const after = db.get(KEY) as StoreReviewState;
    expect(after.lastAskedDay).toBe('2026-11-15');
    expect(after.lastDay).toBe('2026-11-15');
    expect(after.daysUsed).toBe(6);
  });

  it('a day count racing a reader close keeps the counted file', async () => {
    db.set(KEY, { ...seasoned, filesOpened: 1 });
    const { storeReviewAfterReaderClosed, noteAppUsedToday } = await load();
    await Promise.all([storeReviewAfterReaderClosed(45_000, 1), noteAppUsedToday()]);
    const after = db.get(KEY) as StoreReviewState;
    expect(after.filesOpened).toBe(2);
    expect(after.daysUsed).toBe(6);
  });
});

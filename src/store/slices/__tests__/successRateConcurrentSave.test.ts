import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SubjectSuccessRate } from '../../../types/documents';

/**
 * Two success-rate batches in flight at once must not undo each other in IDB.
 *
 * After every sync `triggerRefresh` runs `fetchSubjects` and `fetchStudyPlan`
 * together, and each starts `fetchSuccessRateBatch`. `fetchSubjectSuccessRates`
 * used to read `success_rates/current`, fetch, and write back its snapshot plus
 * what it fetched — so whichever batch saved last dropped the other's codes.
 * Memory stayed right, so nothing looked wrong, but the dropped codes were
 * fetched from the CDN again on every launch.
 *
 * The version gate is mocked, as in `successRateFreshness.test.ts`. Storage is
 * the real `IndexedDBService` over fake-indexeddb.
 */

const V1 = '2026-02-10T09:00:00.000Z';
const V2 = '2026-09-22T12:17:27.977Z';

const version = vi.hoisted(() => ({
  known: null as string | null,
  current: null as string | null,
}));
vi.mock('../../../api/successRateVersion', () => ({
  getKnownSuccessRateVersion: vi.fn(async () => version.known),
  ensureSuccessRateVersion: vi.fn(async () => version.current),
}));

const { useAppStore } = await import('../../useAppStore');
const { IndexedDBService } = await import('../../../services/storage/IndexedDBService');
const { STORAGE_KEYS } = await import('../../../services/storage/keys');

const rate = (courseCode: string, newest: string, cdnVersion?: string): SubjectSuccessRate => ({
  courseCode,
  lastUpdated: V2,
  stats: [
    {
      semesterName: `${newest} - PEF`,
      semesterId: '1',
      year: 2025,
      totalPass: 10,
      totalFail: 2,
      sourceUrl: 'https://is.mendelu.cz/x',
      type: 'exam',
      terms: [],
    },
  ],
  ...(cdnVersion ? { cdnVersion } : {}),
});

/**
 * A CDN whose responses wait until the test releases them, so the order in
 * which the two batches reach their save is the test's to choose.
 */
function heldCdn(files: Record<string, SubjectSuccessRate>) {
  const held = new Map<string, () => void>();
  const requested = new Set<string>();
  let onRequest = () => {};
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    const code = /subjects\/(.+)\.json$/.exec(url)?.[1] ?? '';
    requested.add(code);
    onRequest();
    const file = files[code];
    return new Promise<Response>((resolve) => {
      held.set(code, () =>
        resolve(file ? new Response(JSON.stringify(file)) : new Response('', { status: 404 }))
      );
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    /** Resolves once every one of `codes` has been asked for. */
    requested: (codes: string[]) =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (codes.every((c) => requested.has(c))) resolve();
        };
        onRequest = check;
        check();
      }),
    release: (codes: string[]) => {
      for (const c of codes) held.get(c)?.();
    },
  };
}

const stored = async () => (await IndexedDBService.get('success_rates', 'current'))?.data ?? {};

beforeEach(async () => {
  version.known = V2;
  version.current = V2;
  useAppStore.setState({ successRates: {}, successRatesLoading: {} } as never);
  await IndexedDBService.delete('success_rates', 'current');
  await IndexedDBService.delete('meta', STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('concurrent fetchSuccessRateBatch saves', () => {
  const S1 = ['EBC-ST', 'EBC-MAT'];
  const S2 = ['EBC-ALG', 'EBC-PR'];
  const ALL = [...S1, ...S2];
  const files = Object.fromEntries(ALL.map((c) => [c, rate(c, 'LS 2025/2026')]));

  it.each([
    ['the plan batch', S1, S2],
    ['the subjects batch', S2, S1],
  ])('keeps every code in IDB when %s saves last', async (_label, first, last) => {
    const cdn = heldCdn(files);
    const batch = useAppStore.getState().fetchSuccessRateBatch;

    // Both have read what is stored before either writes.
    const subjects = batch(S1);
    const plan = batch(ALL);
    await cdn.requested(ALL);
    cdn.release(first);
    await (first === S1 ? subjects : plan);
    cdn.release(last);
    await Promise.all([subjects, plan]);

    expect(Object.keys(useAppStore.getState().successRates).sort()).toEqual([...ALL].sort());
    expect(Object.keys(await stored()).sort()).toEqual([...ALL].sort());

    // The next launch: nothing in memory, only what IDB kept.
    useAppStore.setState({ successRates: {}, successRatesLoading: {} } as never);
    cdn.fetchMock.mockClear();
    await batch(ALL);
    expect(cdn.fetchMock).not.toHaveBeenCalled();
  });

  it("does not write back another batch's stale copy over its fresh re-fetch", async () => {
    await IndexedDBService.set('success_rates', 'current', {
      lastUpdated: V1,
      data: { 'EBC-ST': rate('EBC-ST', 'ZS 2025/2026', V1) },
    });
    const cdn = heldCdn({
      'EBC-ST': rate('EBC-ST', 'LS 2025/2026'),
      'EBC-MAT': rate('EBC-MAT', 'LS 2025/2026'),
    });
    const batch = useAppStore.getState().fetchSuccessRateBatch;

    // The first re-fetches the stale EBC-ST; the second, which started from
    // the same snapshot, only fetches EBC-MAT and saves after it.
    const refresh = batch(['EBC-ST']);
    const other = batch(['EBC-MAT']);
    await cdn.requested(['EBC-ST', 'EBC-MAT']);
    cdn.release(['EBC-ST']);
    await refresh;
    cdn.release(['EBC-MAT']);
    await other;

    const data = await stored();
    expect(data['EBC-ST']?.cdnVersion).toBe(V2);
    expect(data['EBC-ST']?.stats[0]?.semesterName).toBe('LS 2025/2026 - PEF');
    expect(data['EBC-MAT']?.cdnVersion).toBe(V2);
  });
});

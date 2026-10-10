import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * A subject with no success rates asks reis-data for similar subjects, once
 * per reis-data version. The version gate is mocked (successRateVersion.test.ts
 * covers it); storage is the real IndexedDBService over fake-indexeddb.
 */

const V1 = '2026-09-22T12:17:27.977Z';
const V2 = '2026-10-01T08:00:00.000Z';
const version = vi.hoisted(() => ({ current: null as string | null }));
vi.mock('../../../api/successRateVersion', () => ({
  getKnownSuccessRateVersion: vi.fn(async () => version.current),
  ensureSuccessRateVersion: vi.fn(async () => version.current),
}));

const { useAppStore } = await import('../../useAppStore');
const { IndexedDBService } = await import('../../../services/storage/IndexedDBService');
const { STORAGE_KEYS } = await import('../../../services/storage/keys');

const EKO1R = {
  code: 'EKO1R',
  nameCs: 'Ekologie I (RSZ)',
  nameEn: 'Ecology I',
  reasons: ['sameName', 'sameGuarantor'],
  completion: 'credit',
  completionChanged: true,
  lastYear: 2025,
};

function serve(files: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string) => {
    const m = /\/(similar|subjects)\/(.+)\.json$/.exec(url);
    const body = m ? files[`${m[1]}/${m[2]}`] : undefined;
    return body === undefined
      ? new Response('', { status: 404 })
      : new Response(JSON.stringify(body));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const similarCalls = (f: ReturnType<typeof serve>) =>
  f.mock.calls.filter(([u]) => String(u).includes('/similar/')).length;

beforeEach(async () => {
  version.current = V1;
  useAppStore.setState({ similarSubjects: {}, successRates: {}, successRatesLoading: {} } as never);
  await IndexedDBService.delete('meta', STORAGE_KEYS.SIMILAR_SUBJECTS);
  await IndexedDBService.delete('success_rates', 'current');
});
afterEach(() => vi.unstubAllGlobals());

describe('fetchSimilarSubjects', () => {
  it('stores and persists the suggestions, stamped with the version', async () => {
    serve({ 'similar/EKOE1': { courseCode: 'EKOE1', suggestions: [EKO1R] } });
    await useAppStore.getState().fetchSimilarSubjects('EKOE1');
    expect(useAppStore.getState().similarSubjects.EKOE1).toEqual([EKO1R]);
    expect(await IndexedDBService.get('meta', STORAGE_KEYS.SIMILAR_SUBJECTS)).toEqual({
      EKOE1: { suggestions: [EKO1R], cdnVersion: V1 },
    });
  });

  it("loads the suggested subjects' own stats, for their fail-rate chips", async () => {
    serve({ 'similar/EKOE1': { courseCode: 'EKOE1', suggestions: [EKO1R] } });
    const batch = vi.fn(async () => {});
    useAppStore.setState({ fetchSuccessRateBatch: batch } as never);
    await useAppStore.getState().fetchSimilarSubjects('EKOE1');
    expect(batch).toHaveBeenCalledWith(['EKO1R']);
  });

  it('treats a 404 as nothing to suggest', async () => {
    serve({});
    await useAppStore.getState().fetchSimilarSubjects('ZABAH');
    expect(useAppStore.getState().similarSubjects.ZABAH).toEqual([]);
  });

  it('drops a malformed file instead of showing it', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    serve({ 'similar/EKOE1': { courseCode: 'EKOE1', suggestions: [{ code: 'EKO1R' }] } });
    await useAppStore.getState().fetchSimilarSubjects('EKOE1');
    expect(useAppStore.getState().similarSubjects.EKOE1).toEqual([]);
    err.mockRestore();
  });

  it('does not ask again under the same version, and does after a refresh', async () => {
    const f = serve({ 'similar/EKOE1': { courseCode: 'EKOE1', suggestions: [EKO1R] } });
    await useAppStore.getState().fetchSimilarSubjects('EKOE1');
    useAppStore.setState({ similarSubjects: {} } as never);
    await useAppStore.getState().fetchSimilarSubjects('EKOE1');
    expect(similarCalls(f)).toBe(1);
    expect(useAppStore.getState().similarSubjects.EKOE1).toEqual([EKO1R]);

    version.current = V2;
    await useAppStore.getState().fetchSimilarSubjects('EKOE1');
    expect(similarCalls(f)).toBe(2);
  });
});

describe('fetchSuccessRate → similar subjects', () => {
  const stats = {
    courseCode: 'PRVES',
    lastUpdated: V1,
    stats: [
      {
        semesterName: 'ZS 2025/2026 - ZF',
        semesterId: '794',
        year: 2025,
        totalPass: 9,
        totalFail: 1,
        sourceUrl: 'https://is.mendelu.cz/x',
        type: 'exam',
        terms: [],
      },
    ],
  };

  it('asks for similar subjects when the subject has no stats', async () => {
    serve({});
    const spy = vi.fn(async () => {});
    useAppStore.setState({ fetchSimilarSubjects: spy } as never);
    await useAppStore.getState().fetchSuccessRate('EKOE1');
    expect(spy).toHaveBeenCalledWith('EKOE1');
  });

  it('settles on nothing to suggest when loading its own stats fails', async () => {
    // The tab waits on this entry; without it a failure would spin forever.
    serve({});
    const spy = vi.fn(async () => {});
    useAppStore.setState({ fetchSimilarSubjects: spy } as never);
    const get = vi.spyOn(IndexedDBService, 'get').mockRejectedValueOnce(new Error('idb closed'));
    await useAppStore.getState().fetchSuccessRate('EKOE1');
    get.mockRestore();
    expect(spy).not.toHaveBeenCalled();
    expect(useAppStore.getState().similarSubjects.EKOE1).toEqual([]);
  });

  it('does not when the subject has stats of its own', async () => {
    serve({ 'subjects/PRVES': stats });
    const spy = vi.fn(async () => {});
    useAppStore.setState({ fetchSimilarSubjects: spy } as never);
    await useAppStore.getState().fetchSuccessRate('PRVES');
    expect(spy).not.toHaveBeenCalled();
    expect(useAppStore.getState().similarSubjects.PRVES).toBeUndefined();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SubjectSuccessRate } from '../../../types/documents';

/**
 * A reis-data refresh reaches students who already have the subject cached.
 *
 * The slice used to serve any cached entry forever — `isCacheValid`'s 30 days
 * only applied to codes it did not have — so after the 2026-09 push EBC-ST
 * kept showing ZS 25/26 as newest while the CDN served LS 25/26. Entries are
 * now stamped with the reis-data version they were fetched under, and an
 * entry from an older version is fetched again, past the HTTP cache.
 *
 * The version gate itself is mocked here; `successRateVersion.test.ts`
 * covers it. Storage is the real `IndexedDBService` over fake-indexeddb.
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
  lastUpdated: '2026-09-22T12:17:27.977Z',
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

async function seed(entries: SubjectSuccessRate[]) {
  const data = Object.fromEntries(entries.map((e) => [e.courseCode, e]));
  await IndexedDBService.set('success_rates', 'current', { lastUpdated: V1, data });
  const synced = Object.fromEntries(entries.map((e) => [e.courseCode, Date.now()]));
  await IndexedDBService.set('meta', STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC, synced);
}

function serveCdn(files: Record<string, SubjectSuccessRate>) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const code = /subjects\/(.+)\.json$/.exec(url)?.[1];
    const file = code ? files[code] : undefined;
    return file ? new Response(JSON.stringify(file)) : new Response('', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const newestShown = (code: string) =>
  useAppStore.getState().successRates[code]?.stats[0]?.semesterName;

beforeEach(async () => {
  version.known = null;
  version.current = null;
  useAppStore.setState({ successRates: {}, successRatesLoading: {} } as never);
  await IndexedDBService.delete('success_rates', 'current');
  await IndexedDBService.delete('meta', STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchSuccessRateBatch after a reis-data refresh', () => {
  it('re-fetches an entry cached before the version it now knows, past the HTTP cache', async () => {
    await seed([rate('EBC-ST', 'ZS 2025/2026')]);
    version.known = V2;
    version.current = V2;
    const fetchMock = serveCdn({ 'EBC-ST': rate('EBC-ST', 'LS 2025/2026') });

    await useAppStore.getState().fetchSuccessRateBatch(['EBC-ST']);

    expect(newestShown('EBC-ST')).toBe('LS 2025/2026 - PEF');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ cache: 'no-cache' });
    const stored = await IndexedDBService.get('success_rates', 'current');
    expect(stored?.data['EBC-ST']?.cdnVersion).toBe(V2);
  });

  it('replaces what it just served from cache when the check finds a newer version', async () => {
    await seed([rate('EBC-ST', 'ZS 2025/2026', V1)]);
    version.known = V1;
    version.current = V2;
    serveCdn({ 'EBC-ST': rate('EBC-ST', 'LS 2025/2026') });

    await useAppStore.getState().fetchSuccessRateBatch(['EBC-ST']);

    expect(newestShown('EBC-ST')).toBe('LS 2025/2026 - PEF');
  });

  it('refreshes what it is already showing when the version moves mid-session', async () => {
    await seed([rate('EBC-ST', 'ZS 2025/2026', V1)]);
    version.known = V1;
    version.current = V1;
    serveCdn({});
    await useAppStore.getState().fetchSuccessRateBatch(['EBC-ST']);
    expect(newestShown('EBC-ST')).toBe('ZS 2025/2026 - PEF');

    version.current = V2;
    serveCdn({
      'EBC-ST': rate('EBC-ST', 'LS 2025/2026'),
      'EBC-MAT': rate('EBC-MAT', 'LS 2025/2026'),
    });
    await useAppStore.getState().fetchSuccessRateBatch(['EBC-MAT']);

    expect(newestShown('EBC-ST')).toBe('LS 2025/2026 - PEF');
    expect(newestShown('EBC-MAT')).toBe('LS 2025/2026 - PEF');
  });

  it('leaves an entry from the current version alone', async () => {
    await seed([rate('EBC-ST', 'LS 2025/2026', V2)]);
    version.known = V2;
    version.current = V2;
    const fetchMock = serveCdn({});

    await useAppStore.getState().fetchSuccessRateBatch(['EBC-ST']);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(newestShown('EBC-ST')).toBe('LS 2025/2026 - PEF');
  });

  it('behaves as before when meta.json has never been reachable', async () => {
    await seed([rate('EBC-ST', 'ZS 2025/2026')]);
    const fetchMock = serveCdn({ 'EBC-ST': rate('EBC-ST', 'LS 2025/2026') });

    await useAppStore.getState().fetchSuccessRateBatch(['EBC-ST']);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(newestShown('EBC-ST')).toBe('ZS 2025/2026 - PEF');
  });

  it('keeps showing the old entry when its re-fetch fails', async () => {
    await seed([rate('EBC-ST', 'ZS 2025/2026', V1)]);
    version.known = V2;
    version.current = V2;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await useAppStore.getState().fetchSuccessRateBatch(['EBC-ST']);

    expect(newestShown('EBC-ST')).toBe('ZS 2025/2026 - PEF');
  });

  it('does not re-request a subject the CDN has no file for on every call', async () => {
    version.known = V2;
    version.current = V2;
    const fetchMock = serveCdn({});

    await useAppStore.getState().fetchSuccessRateBatch(['NOPE']);
    await useAppStore.getState().fetchSuccessRateBatch(['EBC-ST']);

    const nopeCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/NOPE.json'));
    expect(nopeCalls).toHaveLength(1);
  });
});

describe('fetchSuccessRate after a reis-data refresh', () => {
  it('re-fetches a stale cached subject', async () => {
    await seed([rate('EBC-ST', 'ZS 2025/2026', V1)]);
    version.known = V1;
    version.current = V2;
    serveCdn({ 'EBC-ST': rate('EBC-ST', 'LS 2025/2026') });

    await useAppStore.getState().fetchSuccessRate('EBC-ST');

    expect(newestShown('EBC-ST')).toBe('LS 2025/2026 - PEF');
    expect(useAppStore.getState().successRatesLoading['EBC-ST']).toBe(false);
  });

  it('serves a current cached subject without the network', async () => {
    await seed([rate('EBC-ST', 'LS 2025/2026', V2)]);
    version.known = V2;
    version.current = V2;
    const fetchMock = serveCdn({});

    await useAppStore.getState().fetchSuccessRate('EBC-ST');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(newestShown('EBC-ST')).toBe('LS 2025/2026 - PEF');
  });
});

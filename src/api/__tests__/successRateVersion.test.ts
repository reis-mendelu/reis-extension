import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The reis-data version gate for cached success rates.
 *
 * reis-data's `meta.json` carries a `lastUpdated` that moves on every data
 * refresh. Cached subjects are stamped with the version they were fetched
 * under; this module decides which version is current. It runs against the
 * real `IndexedDBService` (fake-indexeddb) so a record the fail-closed `meta`
 * schema would silently drop shows up here as a missing read-back.
 */

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2026-09-23T08:00:00Z');
const V1 = '2026-02-10T09:00:00.000Z';
const V2 = '2026-09-22T12:17:27.977Z';

let now = T0;
let mod: typeof import('../successRateVersion');
let idb: typeof import('../../services/storage/IndexedDBService').IndexedDBService;
let KEY: string;

const okMeta = (lastUpdated: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify({ lastUpdated, subjectCount: 1 })));

async function record() {
  return idb.get('meta', KEY);
}

beforeEach(async () => {
  vi.resetModules();
  now = T0;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  mod = await import('../successRateVersion');
  idb = (await import('../../services/storage/IndexedDBService')).IndexedDBService;
  KEY = (await import('../../services/storage/keys')).STORAGE_KEYS.SUCCESS_RATES_CDN_VERSION;
  await idb.delete('meta', KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ensureSuccessRateVersion', () => {
  it('asks meta.json past the HTTP cache', async () => {
    const fetchMock = okMeta(V2);
    vi.stubGlobal('fetch', fetchMock);

    await mod.ensureSuccessRateVersion();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/meta.json');
    expect(init.cache).toBe('no-cache');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not honour a newly seen version until the CDN edge has had time to turn over', async () => {
    vi.stubGlobal('fetch', okMeta(V2));

    expect(await mod.ensureSuccessRateVersion()).toBeNull();
    expect(await record()).toEqual({
      current: null,
      checkedAt: T0,
      pending: { lastUpdated: V2, firstSeenAt: T0 },
    });

    now = T0 + 11 * HOUR;
    expect(await mod.ensureSuccessRateVersion()).toBeNull();

    now = T0 + 12 * HOUR;
    expect(await mod.ensureSuccessRateVersion()).toBe(V2);
    expect(await mod.getKnownSuccessRateVersion()).toBe(V2);
    expect(await record()).toMatchObject({ current: V2 });
    expect(await record()).not.toHaveProperty('pending');
  });

  it('promotes a settled version without touching the network', async () => {
    await idb.set('meta', KEY, {
      current: V1,
      checkedAt: T0,
      pending: { lastUpdated: V2, firstSeenAt: T0 - 12 * HOUR },
    });
    const fetchMock = okMeta(V2);
    vi.stubGlobal('fetch', fetchMock);

    expect(await mod.ensureSuccessRateVersion()).toBe(V2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks at most once per interval, across reloads', async () => {
    await idb.set('meta', KEY, { current: V1, checkedAt: T0 - HOUR });
    const fetchMock = okMeta(V2);
    vi.stubGlobal('fetch', fetchMock);

    expect(await mod.ensureSuccessRateVersion()).toBe(V1);
    expect(fetchMock).not.toHaveBeenCalled();

    now = T0 + 6 * HOUR;
    await mod.ensureSuccessRateVersion();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one request between concurrent callers', async () => {
    const fetchMock = okMeta(V2);
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([mod.ensureSuccessRateVersion(), mod.ensureSuccessRateVersion()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores a version older than the one already honoured', async () => {
    // Two jsDelivr POPs can disagree for a while after a push.
    await idb.set('meta', KEY, { current: V2, checkedAt: T0 - 7 * HOUR });
    vi.stubGlobal('fetch', okMeta(V1));

    expect(await mod.ensureSuccessRateVersion()).toBe(V2);
    expect(await record()).toEqual({ current: V2, checkedAt: T0 });
  });

  it.each([
    ['a non-ok response', vi.fn().mockResolvedValue(new Response('nope', { status: 503 }))],
    ['a network error', vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))],
    ['a body that is not JSON', vi.fn().mockResolvedValue(new Response('<html>'))],
    ['a missing lastUpdated', okMeta(undefined)],
    ['an unparseable lastUpdated', okMeta('yesterday-ish')],
  ])('keeps what it knew on %s, and backs off', async (_label, fetchMock) => {
    const before = { current: V1, checkedAt: T0 - 7 * HOUR };
    await idb.set('meta', KEY, before);
    vi.stubGlobal('fetch', fetchMock);

    expect(await mod.ensureSuccessRateVersion()).toBe(V1);
    expect(await record()).toEqual(before);

    await mod.ensureSuccessRateVersion();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now = T0 + 16 * 60 * 1000;
    await mod.ensureSuccessRateVersion();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up on a request that hangs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const hanging = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal!.addEventListener('abort', () =>
              reject(new DOMException('', 'AbortError'))
            );
          })
      );
      vi.stubGlobal('fetch', hanging);

      const pending = mod.ensureSuccessRateVersion();
      await vi.waitFor(() => expect(hanging).toHaveBeenCalled());
      await vi.advanceTimersByTimeAsync(3000);
      expect(await pending).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('isStaleForVersion', () => {
  it('treats nothing as stale while no version is known', async () => {
    const { isStaleForVersion } = await import('../successRate');
    expect(isStaleForVersion({ cdnVersion: undefined }, null)).toBe(false);
    expect(isStaleForVersion({ cdnVersion: V1 }, null)).toBe(false);
  });

  it('treats an unstamped or differently stamped entry as stale', async () => {
    const { isStaleForVersion } = await import('../successRate');
    expect(isStaleForVersion({ cdnVersion: undefined }, V2)).toBe(true);
    expect(isStaleForVersion({ cdnVersion: V1 }, V2)).toBe(true);
    expect(isStaleForVersion({ cdnVersion: V2 }, V2)).toBe(false);
  });
});

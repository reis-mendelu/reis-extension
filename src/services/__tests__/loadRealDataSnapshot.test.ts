import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRealDataSnapshot, resetRealDataStores } from '../loadRealDataSnapshot';

vi.mock('../storage', () => ({
  IndexedDBService: { clear: vi.fn(async () => {}) },
}));
vi.mock('../../api/proxyClient', () => ({ isInIframe: () => false }));

describe('loadRealDataSnapshot', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('posts a REIS_SYNC_UPDATE with the snapshot when the file exists', async () => {
    const snapshot = { schedule: [{ id: 'l1' }], lastSync: 123 };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(snapshot), { status: 200 }))
    );
    const posts: unknown[] = [];
    const spy = vi.spyOn(window, 'postMessage').mockImplementation(((m: unknown) => {
      posts.push(m);
    }) as typeof window.postMessage);

    const ok = await loadRealDataSnapshot();

    expect(ok).toBe(true);
    expect(posts[0]).toMatchObject({
      type: 'REIS_SYNC_UPDATE',
      data: { schedule: [{ id: 'l1' }], isSyncing: false },
    });
    spy.mockRestore();
  });

  it('returns false and does not post when the file is absent (404)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 }))
    );
    const spy = vi.spyOn(window, 'postMessage');
    const ok = await loadRealDataSnapshot();
    expect(ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('produces a message that passes isContentMessage', async () => {
    const { isContentMessage, Messages } = await import('../../types/messages');
    const msg = Messages.syncUpdate({ lastSync: 1, isSyncing: false });
    expect(isContentMessage(msg)).toBe(true);
  });
});

describe('resetRealDataStores', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('clears the crawl-data stores when a snapshot exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ subjects: {}, lastSync: 1 }), { status: 200 })
      )
    );
    const { IndexedDBService } = await import('../storage');
    const didClear = await resetRealDataStores();
    expect(didClear).toBe(true);
    const cleared = vi.mocked(IndexedDBService.clear).mock.calls.map((c) => c[0]);
    // Exams must be among them — that is the stale-mock store that leaked.
    expect(cleared).toContain('exams');
    expect(cleared).toEqual(expect.arrayContaining(['schedule', 'subjects', 'exams', 'zaznamnik']));
    // Must NOT wipe meta (holds user_params/theme the snapshot load depends on).
    expect(cleared).not.toContain('meta');
  });

  it('does NOT clear anything when the snapshot is absent (404 → HTML fallback)', async () => {
    // Missing file: dev server returns index.html, so res.json() throws.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<!DOCTYPE html><html></html>', { status: 200 }))
    );
    const { IndexedDBService } = await import('../storage');
    const didClear = await resetRealDataStores();
    expect(didClear).toBe(false);
    expect(IndexedDBService.clear).not.toHaveBeenCalled();
  });

  it('fetches the URL it is given, not the default', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ subjects: {}, lastSync: 1 }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await resetRealDataStores('/preview-data.json');
    expect(fetchMock).toHaveBeenCalledWith('/preview-data.json');
  });
});

// The widened DEV/preview-build guard, tested against a real production build
// (DEV: false) rather than vitest's default DEV: true — the two suites above
// never actually exercise the guard, since vitest runs with DEV true.
describe('loadRealDataSnapshot in a deployed (non-DEV) build', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_PREVIEW_BUILD', 'true');
    vi.stubEnv('VITE_USE_MOCK_DATA', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = realFetch;
  });

  // The bug this test exists for: the loader was gated on import.meta.env.DEV,
  // which is FALSE in a production build, so on the deployed preview it
  // returned false without ever fetching anything.
  it('runs in a preview build even though DEV is false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ schedule: [], lastSync: '2026-09-04T00:00:00.000Z' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { loadRealDataSnapshot: freshLoad } = await import('../loadRealDataSnapshot');
    await expect(freshLoad()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches the URL it is given, not the default', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { loadRealDataSnapshot: freshLoad } = await import('../loadRealDataSnapshot');
    await freshLoad('/preview-data.json');
    expect(fetchMock).toHaveBeenCalledWith('/preview-data.json');
  });

  it('stays inert in an extension or Capacitor build', async () => {
    vi.stubEnv('VITE_PREVIEW_BUILD', '');
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { loadRealDataSnapshot: freshLoad } = await import('../loadRealDataSnapshot');
    await expect(freshLoad()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

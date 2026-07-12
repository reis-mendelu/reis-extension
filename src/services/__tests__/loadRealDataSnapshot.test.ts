import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRealDataSnapshot, resetRealDataStores } from '../loadRealDataSnapshot';

vi.mock('../storage', () => ({
  IndexedDBService: { clear: vi.fn(async () => {}) },
}));

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
});

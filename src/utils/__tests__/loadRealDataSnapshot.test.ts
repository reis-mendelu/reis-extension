import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRealDataSnapshot } from '../loadRealDataSnapshot';

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
    const spy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(((m: unknown) => {
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
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
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

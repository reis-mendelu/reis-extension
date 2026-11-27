import { describe, it, expect, vi } from 'vitest';
import { checkForUpdate, isNewer, LATEST_RELEASE_URL, updateNotice } from '../updateCheck';

const release = (tag: string) =>
  vi.fn(async () => new Response(JSON.stringify({ tag_name: tag }), { status: 200 }));

describe('isNewer', () => {
  it('compares numerically, not as text', () => {
    expect(isNewer('0.1.10', '0.1.9')).toBe(true);
    expect(isNewer('0.2.0', '0.1.5')).toBe(true);
    expect(isNewer('0.1.5', '0.1.5')).toBe(false);
    expect(isNewer('0.1.4', '0.1.5')).toBe(false);
  });
});

describe('checkForUpdate', () => {
  it('returns the notice when the latest release is newer (mcp-v tag)', async () => {
    const f = release('mcp-v0.1.6');
    await expect(checkForUpdate('0.1.5', f)).resolves.toBe(updateNotice('0.1.6'));
    expect(f).toHaveBeenCalledWith(LATEST_RELEASE_URL, expect.objectContaining({ method: 'GET' }));
    expect(updateNotice('0.1.6')).toBe(
      'Je venku nová verze reIS for Claude (0.1.6): https://reisapp.cz/navody/reis-v-claude · A new version is out.'
    );
  });

  it('accepts a plain v tag', async () => {
    await expect(checkForUpdate('0.1.5', release('v0.2.0'))).resolves.toBe(updateNotice('0.2.0'));
  });

  it('says nothing when the release is the running version', async () => {
    await expect(checkForUpdate('0.1.5', release('mcp-v0.1.5'))).resolves.toBeNull();
  });

  it('says nothing when the release is older', async () => {
    await expect(checkForUpdate('0.1.5', release('mcp-v0.1.4'))).resolves.toBeNull();
  });

  it('says nothing on an unrecognised tag or a non-200 answer', async () => {
    await expect(checkForUpdate('0.1.5', release('latest'))).resolves.toBeNull();
    const notFound = vi.fn(async () => new Response('{}', { status: 404 }));
    await expect(checkForUpdate('0.1.5', notFound)).resolves.toBeNull();
  });

  it('says nothing when the network fails', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(checkForUpdate('0.1.5', f)).resolves.toBeNull();
  });

  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    try {
      const f = vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          )
      );
      const p = checkForUpdate('0.1.5', f as unknown as typeof fetch, 3000);
      await vi.advanceTimersByTimeAsync(3000);
      await expect(p).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

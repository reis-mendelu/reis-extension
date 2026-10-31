import { describe, it, expect, afterEach, vi } from 'vitest';
import { withKnownStateLock } from '../knownStateLock';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('withKnownStateLock', () => {
  it('just runs the job where the WebView has no Web Locks', async () => {
    vi.stubGlobal('navigator', {});
    await expect(withKnownStateLock(async () => 7)).resolves.toBe(7);
  });

  it('runs the job inside the shared lock, so the app and the background run take turns', async () => {
    const request = vi.fn((_name: string, job: () => Promise<unknown>) => job());
    vi.stubGlobal('navigator', { locks: { request } });
    await expect(withKnownStateLock(async () => 'x')).resolves.toBe('x');
    expect(request).toHaveBeenCalledWith('reis-known-state', expect.any(Function));
  });
});

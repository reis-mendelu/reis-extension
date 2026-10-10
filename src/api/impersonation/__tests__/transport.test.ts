import { describe, it, expect, vi } from 'vitest';

vi.mock('../../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../client')>()),
  fetchWithAuth: vi.fn(),
}));
import { mapLimit } from '../transport';

/** A promise the test settles by hand, so the pool's order is deterministic. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('mapLimit', () => {
  it('keeps order and runs at most `limit` at once', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await flush();
      running--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });

  // Each item is a timetable POST to IS. Once one has failed the whole result
  // is thrown away, so the other workers must not go on sending the rest.
  it('starts no new item after the first rejection, and rejects with it', async () => {
    const pending = Array.from({ length: 6 }, () => deferred<number>());
    const fn = vi.fn((i: number) => pending[i]!.promise);
    const result = mapLimit([0, 1, 2, 3, 4, 5], 2, fn);
    result.catch(() => {}); // asserted below; avoid an unhandled-rejection warning meanwhile
    expect(fn).toHaveBeenCalledTimes(2);

    const boom = new Error('IS said no');
    pending[0]!.reject(boom);
    await flush();
    // Worker 2 is still in flight; finishing it must not pull item 2.
    pending[1]!.resolve(1);
    await flush();

    await expect(result).rejects.toBe(boom);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

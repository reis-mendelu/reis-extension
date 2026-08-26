/**
 * The queue exists to stop the extension firing every subject's fetch at once and
 * getting ERR_INSUFFICIENT_RESOURCES back from Chrome. Two properties matter: the
 * cap is never exceeded, and a slot is always returned -- a rejection that leaked
 * past the finally would leak a permit, and after three of them the queue would
 * wedge with every later request waiting on a slot that never frees.
 */

import { describe, it, expect, vi } from 'vitest';
import { requestQueue, processWithDelay } from '../requestQueue';

/** A task that blocks until released, while recording peak concurrency. */
function tracker() {
  const state = { active: 0, peak: 0 };
  const release: Array<() => void> = [];
  const task = () => {
    state.active++;
    state.peak = Math.max(state.peak, state.active);
    return new Promise<string>((resolve) => {
      release.push(() => {
        state.active--;
        resolve('done');
      });
    });
  };
  return { state, release, task };
}

describe('requestQueue', () => {
  it('resolves with the task result', async () => {
    await expect(requestQueue.add(async () => 42)).resolves.toBe(42);
  });

  it('rejects with the task error', async () => {
    await expect(requestQueue.add(async () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom'
    );
  });

  it('never runs more than 3 tasks at once', async () => {
    const { state, release, task } = tracker();
    const all = Promise.all(Array.from({ length: 9 }, () => requestQueue.add(task)));

    // Let the queue start whatever it is willing to start.
    await Promise.resolve();
    await Promise.resolve();
    expect(state.peak).toBeLessThanOrEqual(3);

    // Drain: each release frees a slot the queue refills.
    while (release.length) {
      release.shift()!();
      await Promise.resolve();
      await Promise.resolve();
    }
    await all;
    expect(state.peak).toBeLessThanOrEqual(3);
  });

  it('frees the slot a rejected task held', async () => {
    // Four failures in a row would exhaust a leaking pool of 3; the fifth call
    // succeeding proves the permit came back each time.
    for (let i = 0; i < 4; i++) {
      await expect(requestQueue.add(async () => Promise.reject(new Error('nope')))).rejects.toThrow(
        'nope'
      );
    }
    await expect(requestQueue.add(async () => 'still working')).resolves.toBe('still working');
  });

  it('runs every queued task even when some reject', async () => {
    const results = await Promise.allSettled([
      requestQueue.add(async () => 'a'),
      requestQueue.add(async () => Promise.reject(new Error('b'))),
      requestQueue.add(async () => 'c'),
      requestQueue.add(async () => 'd'),
    ]);
    expect(results.map((r) => r.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
    ]);
  });

  it('processSequentially preserves input order', async () => {
    // Results are indexed against the input list by the caller, so order is not
    // cosmetic -- a swap misfiles one subject's documents under another.
    const out = await requestQueue.processSequentially([3, 1, 2], async (n) => {
      await new Promise((r) => setTimeout(r, n));
      return n * 10;
    });
    expect(out).toEqual([30, 10, 20]);
  });
});

describe('processWithDelay', () => {
  it('returns results in order', async () => {
    const out = await processWithDelay([1, 2, 3], async (n) => n * 2, 0);
    expect(out).toEqual([2, 4, 6]);
  });

  it('waits between items when a delay is set', async () => {
    vi.useFakeTimers();
    const seen: number[] = [];
    const p = processWithDelay(
      [1, 2, 3],
      async (n) => {
        seen.push(n);
        return n;
      },
      100
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([1]); // parked on the delay, not racing ahead

    await vi.runAllTimersAsync();
    await p;
    expect(seen).toEqual([1, 2, 3]);
    vi.useRealTimers();
  });

  it('skips the wait entirely when the delay is zero', async () => {
    const started = Date.now();
    await processWithDelay([1, 2, 3, 4, 5], async (n) => n, 0);
    expect(Date.now() - started).toBeLessThan(100);
  });

  it('propagates a processor rejection', async () => {
    await expect(
      processWithDelay([1], async () => Promise.reject(new Error('item failed')), 0)
    ).rejects.toThrow('item failed');
  });
});

import { describe, expect, it } from 'vitest';
import { runPool } from '../runPool';

const tick = () => new Promise((r) => setTimeout(r, 1));

describe('runPool', () => {
  it('runs every task, at most `concurrency` at a time, and really in parallel', async () => {
    let inFlight = 0;
    let peak = 0;
    const done: number[] = [];
    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight--;
      done.push(i);
    });
    const progress: number[] = [];
    await runPool(tasks, 4, (n) => progress.push(n));
    expect(done.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(peak).toBe(4);
    expect(progress).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('stops taking new tasks after a failure, lets in-flight ones finish, then throws', async () => {
    const started: number[] = [];
    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      started.push(i);
      await tick();
      if (i === 1) throw new Error('boom');
    });
    await expect(runPool(tasks, 2, () => {})).rejects.toThrow('boom');
    expect(started.length).toBeLessThan(10);
  });

  it('handles no work', async () => {
    await expect(runPool([], 4, () => {})).resolves.toBeUndefined();
  });
});

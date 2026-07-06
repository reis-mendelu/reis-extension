import { describe, it, expect, vi } from 'vitest';
import { singleFlight } from './singleFlight';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('singleFlight', () => {
  it('coalesces concurrent calls and runs exactly once more for the latest', async () => {
    let runs = 0;
    let active = 0;
    let maxActive = 0;
    const releases: Array<() => void> = [];
    const task = vi.fn(async () => {
      runs++;
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((r) => releases.push(r));
      active--;
    });
    const run = singleFlight(task);

    const first = run(); // iteration 1 starts, awaits releases[0]
    await Promise.resolve();
    await run(); // coalesced -> marks dirty, resolves immediately
    expect(runs).toBe(1); // no parallel run started

    releases[0]!(); // finish iteration 1 -> triggers trailing iteration 2 (safe: pushed above)
    await tick();
    expect(runs).toBe(2); // exactly one trailing run started
    expect(active).toBe(1); // it is the only one in flight

    releases[1]!(); // finish iteration 2 (safe: pushed by the trailing run)
    await first; // whole wrapper resolves now
    expect(runs).toBe(2); // no further runs
    expect(maxActive).toBe(1); // never overlapped
  });

  it('runs again on a fresh call after settling (not stuck dirty)', async () => {
    let runs = 0;
    const task = vi.fn(async () => {
      runs++;
    });
    const run = singleFlight(task);
    await run();
    await run();
    expect(runs).toBe(2);
  });
});

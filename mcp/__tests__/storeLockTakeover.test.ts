// Review finding on PR #766 (CodeRabbit): two waiters that both saw the same stale lock must not
// both get in. The takeover is serialised by a guard and the stale file is moved aside with an
// atomic rename, so a fresh lock one waiter just made is never removed by the other.
import { describe, it, expect } from 'vitest';
import { writeFile, mkdir, utimes, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import * as realFs from 'node:fs/promises';
import { withFileLock, type StoreFs } from '../storeFs';
import { storeHarness } from './storeTestKit';

const { h, leftovers } = storeHarness();
const fs = realFs as StoreFs;
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function staleLock(name = 'x') {
  await mkdir(h.dir, { recursive: true });
  const file = join(h.dir, `.tmp-lock-${name}`);
  await writeFile(file, 'dead-holder');
  const old = new Date(Date.now() - 3_600_000);
  await utimes(file, old, old);
}

/**
 * Holds every waiter that decided the lock is stale until `n` of them have. Then the first
 * acts at once and the others only once someone is inside: the order in which a naive
 * check-then-remove deletes the winner's fresh lock.
 */
function barrier(n: number) {
  let arrived = 0;
  let open!: () => void;
  let enter!: () => void;
  const opened = new Promise<void>((r) => (open = r));
  const entered = new Promise<void>((r) => (enter = r));
  const onStale = async () => {
    const me = arrived++;
    if (arrived === n) open();
    await opened;
    if (me > 0) await entered;
  };
  return { onStale, entered: () => enter() };
}

describe('taking over a stale lock', () => {
  it('lets in one waiter at a time when several saw the same stale lock at once', async () => {
    for (const waiters of [2, 3]) {
      await staleLock();
      const { onStale, entered } = barrier(waiters);
      let inside = 0;
      let overlapped = false;
      const ran: number[] = [];
      const job = (i: number) =>
        withFileLock(
          fs,
          h.dir,
          'x',
          async () => {
            if (++inside > 1) overlapped = true;
            entered();
            await pause(40);
            inside--;
            ran.push(i);
          },
          { staleMs: 1_000, pause: 2, onStale }
        );
      await Promise.all(Array.from({ length: waiters }, (_, i) => job(i)));
      expect(overlapped).toBe(false);
      expect(ran.sort()).toEqual(Array.from({ length: waiters }, (_, i) => i));
      expect(await leftovers()).toEqual([]);
    }
  });

  it('a waiter whose takeover lost the race does not remove the winner’s fresh lock', async () => {
    await staleLock();
    const { onStale, entered } = barrier(2);
    const seen: string[][] = [];
    const job = () =>
      withFileLock(
        fs,
        h.dir,
        'x',
        async () => {
          seen.push((await readdir(h.dir)).filter((f) => f.startsWith('.tmp-lock-x')));
          entered();
          await pause(30);
          seen.push((await readdir(h.dir)).filter((f) => f.startsWith('.tmp-lock-x')));
        },
        { staleMs: 1_000, pause: 2, onStale }
      );
    await Promise.all([job(), job()]);
    // While each ran, its own lock was the one in place.
    for (const files of seen) expect(files).toContain('.tmp-lock-x');
    expect(await leftovers()).toEqual([]);
  });

  it('clears a takeover guard a crashed waiter left, once it is stale', async () => {
    await staleLock();
    const guard = join(h.dir, '.tmp-lock-x.takeover');
    await writeFile(guard, 'crashed-waiter');
    const old = new Date(Date.now() - 3_600_000);
    await utimes(guard, old, old);
    expect(await withFileLock(fs, h.dir, 'x', async () => 'in', { staleMs: 1_000, pause: 2 })).toBe(
      'in'
    );
    expect(await leftovers()).toEqual([]);
  });
});

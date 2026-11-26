// The advisory lock the ledger takes around a change that reads several files and writes back
// (storeFs.ts withFileLock): one holder at a time across processes, a crashed holder's file is
// taken over, and a folder that cannot be used does not block anything.
import { describe, it, expect } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import * as realFs from 'node:fs/promises';
import { withFileLock, type StoreFs } from '../storeFs';
import { storeHarness } from './storeTestKit';

const { h, leftovers } = storeHarness();
const fs = realFs as StoreFs;
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('withFileLock', () => {
  it('runs one holder at a time and leaves nothing behind', async () => {
    let inside = 0;
    let overlapped = false;
    const job = () =>
      withFileLock(fs, h.dir, 'x', async () => {
        inside++;
        if (inside > 1) overlapped = true;
        await pause(5);
        inside--;
      });
    await Promise.all([job(), job(), job(), job()]);
    expect(overlapped).toBe(false);
    expect(await leftovers()).toEqual([]);
  });

  it('releases the lock when the work throws', async () => {
    await expect(
      withFileLock(fs, h.dir, 'x', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(await withFileLock(fs, h.dir, 'x', async () => 'again')).toBe('again');
  });

  it('takes over a lock a crashed process left, after waiting for it', async () => {
    await mkdir(h.dir, { recursive: true });
    await writeFile(join(h.dir, '.tmp-lock-x'), '');
    const ran = await withFileLock(fs, h.dir, 'x', async () => 'ran', { tries: 3, pause: 1 });
    expect(ran).toBe('ran');
    expect(await leftovers()).toEqual([]);
  });

  it('does not block when the folder cannot be used', async () => {
    await writeFile(h.root + '/file', 'not a folder');
    expect(await withFileLock(fs, join(h.root, 'file', 'sub'), 'x', async () => 7)).toBe(7);
  });
});

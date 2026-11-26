// Review round 2 on PR #753: writes queued behind a paused one, an unreadable
// generation token, a rename retried after forget(), a stale writer's commit,
// and the memory fallback after another process forgot. Made-up content only.
import { describe, expect, it, vi } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as realFs from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite, type StoreFs } from '../storeFs';
import { gate, storeHarness } from './storeTestKit';

const { h, open, leftovers } = storeHarness();
const isGen = (p: unknown) => String(p).endsWith('.generation');

describe('a write is bound to the folder generation it was submitted under', () => {
  it('two writes queued on one store while another store forgets: neither lands', async () => {
    const paused = gate();
    const reached = gate();
    const secondRead = gate();
    let genReads = 0;
    let opens = 0;
    const slow = {
      ...realFs,
      readFile: async (...a: Parameters<typeof realFs.readFile>) => {
        try {
          return await realFs.readFile(...a);
        } finally {
          // the 2nd write has noted its generation (the file may not exist yet)
          if (isGen(a[0]) && ++genReads === 2) secondRead.release();
        }
      },
      open: async (...a: Parameters<typeof realFs.open>) => {
        if (++opens === 1) {
          reached.release();
          await paused.wait;
        }
        return realFs.open(...a);
      },
    } as StoreFs;
    const a = open({ fs: slow });
    const first = a.write('one.txt', 'before forget');
    await reached.wait;
    const second = a.write('two.txt', 'also before forget'); // waits behind the first
    await secondRead.wait;
    await open().forget();
    paused.release();
    expect([await first, await second]).toEqual([false, false]);
    expect(await leftovers()).toEqual([]);
  });

  it('a write called right after forget() on the same store, with no await, still lands', async () => {
    const s = open();
    await s.write('old.txt', 'old');
    const forgotten = s.forget();
    const written = s.write('new.txt', 'new');
    await forgotten;
    expect(await written).toBe(true);
    expect(await s.readText('new.txt')).toBe('new');
    expect(await s.readText('old.txt')).toBeUndefined();
  });
});

describe('an unreadable generation token is not "no change"', () => {
  it('a write whose token cannot be read again is taken back', async () => {
    let reads = 0;
    const fs = {
      ...realFs,
      readFile: async (...a: Parameters<typeof realFs.readFile>) => {
        if (isGen(a[0]) && ++reads > 1)
          throw Object.assign(new Error('denied'), { code: 'EACCES' });
        return realFs.readFile(...a);
      },
    } as StoreFs;
    const s = open({ fs });
    expect(await s.write('a.txt', 'x')).toBe(false);
    expect(await leftovers()).toEqual([]);
  });
});

describe('atomicWrite asks stillValid before every rename attempt', () => {
  it('stops retrying once the generation moved during the wait', async () => {
    await mkdir(h.dir, { recursive: true });
    const rename = vi.fn(async () => {
      throw Object.assign(new Error('busy'), { code: 'EBUSY' });
    });
    let asked = 0;
    const stillValid = vi.fn(async () => ++asked < 2); // fine once, then forget() ran
    const done = await atomicWrite(
      { ...realFs, rename } as unknown as StoreFs,
      join(h.dir, 'x'),
      Buffer.from('v'),
      1,
      { sleep: async () => {}, stillValid }
    );
    expect(done).toBe(false);
    expect(rename).toHaveBeenCalledTimes(1);
    expect(await leftovers()).toEqual([]);
  });
});

describe('a stale writer does not run its commit', () => {
  it('does not evict a file written after forget() under its own, smaller budget', async () => {
    const paused = gate();
    const renamed = gate();
    const slow = {
      ...realFs,
      rename: async (...a: Parameters<typeof realFs.rename>) => {
        await realFs.rename(...a);
        renamed.release();
        await paused.wait; // the rename landed; the commit has not begun
      },
    } as StoreFs;
    const stale = open({ fs: slow, maxBytes: 1 }).write('old.txt', 'o');
    await renamed.wait;
    const fresh = open({ maxBytes: 2 });
    await fresh.forget();
    expect(await fresh.write('fresh.txt', 'ff')).toBe(true);
    paused.release();
    expect(await stale).toBe(false);
    expect(await open().readText('fresh.txt')).toBe('ff');
  });
});

describe('rebuild() against a forget() by another process', () => {
  it('does not put forgotten file names back into the index', async () => {
    const paused = gate();
    const atIndex = gate();
    await open().write('gone.txt', 'forgotten soon');
    const slow = {
      ...realFs,
      rename: async (...a: Parameters<typeof realFs.rename>) => {
        atIndex.release(); // the scan is done; the new index is about to be published
        await paused.wait;
        return realFs.rename(...a);
      },
    } as StoreFs;
    const rebuilding = open({ fs: slow }).rebuild();
    await atIndex.wait;
    // Misses the in-flight temp file, so the rebuild's rename can still land.
    const blind = {
      ...realFs,
      rm: (async (p: string, o: object) =>
        String(p).includes('.tmp-') ? undefined : realFs.rm(p, o)) as StoreFs['rm'],
    } as StoreFs;
    await open({ fs: blind }).forget();
    paused.release();
    await rebuilding;
    expect(await open().list()).toEqual([]);
    expect(await leftovers()).toEqual([]);
  });
});

describe('the memory fallback', () => {
  const brokenWrites = () =>
    ({
      ...realFs,
      open: async () => {
        throw Object.assign(new Error('denied'), { code: 'EACCES' });
      },
    }) as unknown as StoreFs;

  it('hands out a copy, so a caller cannot change what is kept', async () => {
    const s = open({ fs: brokenWrites() });
    await s.write('a.txt', 'abc');
    (await s.read('a.txt'))!.fill(0x7a);
    expect(await s.readText('a.txt')).toBe('abc');
  });

  it('drops what it holds once another process has run forget()', async () => {
    await mkdir(h.dir, { recursive: true });
    await writeFile(join(h.dir, 'x.txt'), 'seed');
    const degraded = open({ fs: brokenWrites() });
    await degraded.write('a.txt', 'kept in memory');
    expect(degraded.persistent).toBe(false);
    expect(await degraded.readText('a.txt')).toBe('kept in memory');
    await open().forget();
    expect(await degraded.readText('a.txt')).toBeUndefined();
    expect(await degraded.list()).toEqual([]);
    expect(await degraded.usage()).toEqual({ files: 0, bytes: 0 });
    expect(await readFile(join(h.dir, '.generation'), 'utf8')).toBeTruthy();
  });
});

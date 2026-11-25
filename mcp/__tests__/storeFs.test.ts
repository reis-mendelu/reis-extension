import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import * as realFs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWrite, type StoreFs } from '../storeFs';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'reis-storefs-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const errno = (code: string) => Object.assign(new Error(code), { code });

describe('atomicWrite', () => {
  it('creates missing folders and leaves only the target behind', async () => {
    await atomicWrite(realFs, join(dir, 'a', 'b', 'x.txt'), Buffer.from('hello'), 5);
    expect(await readFile(join(dir, 'a', 'b', 'x.txt'), 'utf8')).toBe('hello');
    expect(await readdir(join(dir, 'a', 'b'))).toEqual(['x.txt']);
  });

  it('replaces an existing file whole', async () => {
    await atomicWrite(realFs, join(dir, 'x'), Buffer.from('old old old'), 1);
    await atomicWrite(realFs, join(dir, 'x'), Buffer.from('new'), 2);
    expect(await readFile(join(dir, 'x'), 'utf8')).toBe('new');
  });

  it('writes the temp file next to the target, named by pid and a random part', async () => {
    const seen: string[] = [];
    const fs: StoreFs = {
      ...realFs,
      rename: async (from, to) => {
        seen.push(String(from));
        return realFs.rename(from, to);
      },
    };
    await atomicWrite(fs, join(dir, 'x'), Buffer.from('1'), 1);
    await atomicWrite(fs, join(dir, 'x'), Buffer.from('2'), 2);
    expect(seen[0]!.startsWith(join(dir, `.tmp-${process.pid}-`))).toBe(true);
    expect(seen[0]).not.toBe(seen[1]);
  });

  it('syncs the data to disk before the rename', async () => {
    const order: string[] = [];
    const fs: StoreFs = {
      ...realFs,
      open: async (...a: Parameters<typeof realFs.open>) => {
        const h = await realFs.open(...a);
        const sync = h.sync.bind(h);
        h.sync = async () => {
          order.push('sync');
          return sync();
        };
        return h;
      },
      rename: async (from, to) => {
        order.push('rename');
        return realFs.rename(from, to);
      },
    };
    await atomicWrite(fs, join(dir, 'x'), Buffer.from('1'), 1);
    expect(order).toEqual(['sync', 'rename']);
  });

  describe('Windows: a file another process briefly holds', () => {
    const flaky = (code: string, failures: number) => {
      let left = failures;
      const rename = vi.fn(async (from: string, to: string) => {
        if (left-- > 0) throw errno(code);
        return realFs.rename(from, to);
      });
      return { fs: { ...realFs, rename } as StoreFs, rename };
    };

    it.each(['EPERM', 'EBUSY', 'EACCES'])('retries %s with a growing pause', async (code) => {
      const { fs, rename } = flaky(code, 2);
      const sleep = vi.fn(async () => {});
      await atomicWrite(fs, join(dir, 'x'), Buffer.from('ok'), 1, { sleep });
      expect(rename).toHaveBeenCalledTimes(3);
      expect(await readFile(join(dir, 'x'), 'utf8')).toBe('ok');
      const [first, second] = sleep.mock.calls.map((c) => (c as unknown as [number])[0]);
      expect(second!).toBeGreaterThan(first!);
      expect(await readdir(dir)).toEqual(['x']);
    });

    it('gives up after a few tries, cleans its temp file and throws the original error', async () => {
      const { fs, rename } = flaky('EPERM', 99);
      await expect(
        atomicWrite(fs, join(dir, 'x'), Buffer.from('no'), 1, { sleep: async () => {} })
      ).rejects.toMatchObject({ code: 'EPERM' });
      expect(rename.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(rename.mock.calls.length).toBeLessThanOrEqual(8);
      expect(await readdir(dir)).toEqual([]);
    });

    it('does not retry an error that is not a sharing violation', async () => {
      const { fs, rename } = flaky('ENOSPC', 99);
      const sleep = vi.fn(async () => {});
      await expect(
        atomicWrite(fs, join(dir, 'x'), Buffer.from('no'), 1, { sleep })
      ).rejects.toMatchObject({
        code: 'ENOSPC',
      });
      expect(rename).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });
  });
});

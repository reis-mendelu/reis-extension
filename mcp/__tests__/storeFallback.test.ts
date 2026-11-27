import { describe, expect, it, vi } from 'vitest';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import * as realFs from 'node:fs/promises';
import { join } from 'node:path';
import { createStore } from '../store';
import type { StoreFs } from '../storeFs';
import { clock, storeHarness } from './storeTestKit';

const { h, open } = storeHarness();

describe('memory-only fallback', () => {
  async function blockedDir() {
    const file = join(h.root, 'a-file');
    await writeFile(file, 'in the way');
    return join(file, 'reIS for Claude'); // cannot be created under a regular file
  }

  it('keeps working in memory, says so once, and never throws', async () => {
    const s = createStore({ dir: await blockedDir(), now: clock() });
    expect(s.persistent).toBe(true);
    await expect(s.write('x/y.txt', 'hello')).resolves.toBe(true);
    expect(s.persistent).toBe(false);
    expect(s.notice()).toMatchObject({ persistent: false });
    expect(s.notice()).toBeUndefined();
    await s.write('z.txt', 'zz');
    expect(s.notice()).toBeUndefined();
    expect(await s.readText('x/y.txt')).toBe('hello');
    expect((await s.list()).map((e) => e.path)).toEqual(['x/y.txt', 'z.txt']);
    expect(await s.usage()).toEqual({ files: 2, bytes: 7 });
    await s.remove('z.txt');
    expect(await s.read('z.txt')).toBeUndefined();
  });

  it('drops oldest-first inside its smaller memory budget', async () => {
    const s = createStore({ dir: await blockedDir(), now: clock(), maxBytes: 20 });
    await s.write('a', '1234567890');
    await s.write('b', '1234567890');
    await s.write('c', '1234567890');
    expect((await s.list()).map((e) => e.path)).toEqual(['b', 'c']);
  });

  it('falls back when the write itself fails, and keeps the data it was given', async () => {
    const fs: StoreFs = {
      ...realFs,
      open: async () => {
        throw Object.assign(new Error('read-only'), { code: 'EROFS' });
      },
    };
    const s = open({ fs });
    await expect(s.write('x.txt', 'kept')).resolves.toBe(true);
    expect(s.persistent).toBe(false);
    expect(await s.readText('x.txt')).toBe('kept');
  });

  it('falls back when a Windows file stays locked past every retry', async () => {
    const rename = vi.fn(async () => {
      throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
    });
    const s = open({ fs: { ...realFs, rename } as StoreFs, sleep: async () => {} });
    await s.write('x.txt', 'kept');
    expect(s.persistent).toBe(false);
    expect(await s.readText('x.txt')).toBe('kept');
    expect(await readdir(h.dir)).toEqual([]);
  });

  it('retries a brief Windows lock without falling back', async () => {
    let fail = 2;
    const rename = vi.fn(async (a: string, b: string) => {
      if (fail-- > 0) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
      return realFs.rename(a, b);
    });
    const s = open({ fs: { ...realFs, rename } as StoreFs, sleep: async () => {} });
    await s.write('x.txt', 'ok');
    expect(s.persistent).toBe(true);
    expect(await readFile(join(h.dir, 'x.txt'), 'utf8')).toBe('ok');
  });
});

describe('eviction and the memory fallback under trouble', () => {
  it('skips a file it cannot delete and still indexes the new write', async () => {
    const stuck = join(h.dir, 'a');
    const fs: StoreFs = {
      ...realFs,
      rm: (async (p: string, o: object) => {
        if (p === stuck) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
        return realFs.rm(p, o);
      }) as StoreFs['rm'],
    };
    const s = open({ fs, maxBytes: 20 });
    await s.write('a', '1234567890');
    await s.write('b', '1234567890');
    await s.write('c', '1234567890'); // wants a gone, cannot; takes b instead
    const listed = (await s.list()).map((e) => e.path);
    expect(listed).toContain('c');
    expect(listed).toContain('a'); // still on disk, so still listed
    expect(listed).not.toContain('b');
  });

  it('an older copy on disk is never served for a file rewritten in memory', async () => {
    const s = open();
    await s.write('grades.md', 'old grades');
    // From here the folder cannot be written; the rewrite lives in memory only.
    const failing: StoreFs = {
      ...realFs,
      open: async () => {
        throw Object.assign(new Error('ro'), { code: 'EROFS' });
      },
    };
    const m = open({ fs: failing, maxBytes: 20 });
    await m.write('grades.md', 'new grades');
    expect(await m.readText('grades.md')).toBe('new grades');
    await m.write('other.md', 'a different one'); // evicts grades.md from memory
    expect(await m.read('grades.md')).toBeUndefined();
    expect((await m.list()).map((e) => e.path)).not.toContain('grades.md');
  });

  it('refuses a file bigger than the memory cap once it has fallen back', async () => {
    const failing: StoreFs = {
      ...realFs,
      open: async () => {
        throw Object.assign(new Error('ro'), { code: 'EROFS' });
      },
    };
    const s = open({ fs: failing, maxBytes: 10 });
    await expect(s.write('big', '12345678901')).resolves.toBe(false);
    await expect(s.write('ok', '1234567890')).resolves.toBe(true);
  });
});

describe('what lands on disk', () => {
  it('is readable by its owner only', async () => {
    if (process.platform === 'win32') return;
    const s = open();
    await s.write('sub/a.txt', 'private');
    const { stat } = realFs;
    expect((await stat(join(h.dir, 'sub', 'a.txt'))).mode & 0o777).toBe(0o600);
    expect((await stat(join(h.dir, 'sub'))).mode & 0o777).toBe(0o700);
  });
});

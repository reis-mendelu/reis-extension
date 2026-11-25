import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import * as realFs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../store';
import type { StoreFs } from '../storeFs';

// Made-up content only: nothing here is a real student's data.
let root: string;
let dir: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'reis-store-'));
  dir = join(root, 'reIS for Claude');
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function clock(start = 1_700_000_000_000) {
  let t = start;
  return () => (t += 1000);
}
const open = (extra: Parameters<typeof createStore>[0] = {}) =>
  createStore({ dir, now: clock(), ...extra });
const names = async (p: string) => (await readdir(p)).sort();

describe('read and write', () => {
  it('round-trips text and bytes, creating folders as needed', async () => {
    const s = open();
    await s.write('subjects/EBC-X/text.md', 'Přednáška: příklad ěščřžýáíé');
    await s.write('subjects/EBC-X/orig.bin', Buffer.from([0, 1, 2, 255]));
    expect(await s.readText('subjects/EBC-X/text.md')).toBe('Přednáška: příklad ěščřžýáíé');
    expect([...(await s.read('subjects/EBC-X/orig.bin'))!]).toEqual([0, 1, 2, 255]);
    expect(await s.read('subjects/nothing.md')).toBeUndefined();
    expect(s.persistent).toBe(true);
    expect(await names(dir)).toEqual(['index.json', 'subjects']);
  });

  it('lists what it holds, with sizes and write times', async () => {
    const s = open();
    await s.write('b.txt', '12345');
    await s.write('a/c.txt', '123');
    expect(await s.list()).toEqual([
      { path: 'a/c.txt', bytes: 3, at: expect.any(Number) },
      { path: 'b.txt', bytes: 5, at: expect.any(Number) },
    ]);
    const index = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'));
    expect(index.version).toBe(1);
  });

  it('removes one file and its index entry', async () => {
    const s = open();
    await s.write('a.txt', '1');
    await s.write('b.txt', '2');
    await s.remove('a.txt');
    expect(await s.read('a.txt')).toBeUndefined();
    expect((await s.list()).map((e) => e.path)).toEqual(['b.txt']);
    await expect(s.remove('never-there.txt')).resolves.toBeUndefined();
  });
});

describe('the path guard', () => {
  it('refuses anything that could leave the store folder, and touches nothing', async () => {
    const s = open();
    await s.write('ok.txt', 'fine');
    const attempts = [
      '../escaped.txt',
      'a/../../escaped.txt',
      '/tmp/escaped.txt',
      '..\\escaped.txt',
      'C:\\escaped.txt',
      'a\0/../../escaped.txt',
    ];
    for (const p of attempts) {
      await expect(s.write(p, 'x'), p).rejects.toThrow(/path/i);
      await expect(s.read(p), p).rejects.toThrow(/path/i);
      await expect(s.remove(p), p).rejects.toThrow(/path/i);
    }
    expect(await names(root)).toEqual(['reIS for Claude']);
    expect(await names(dir)).toEqual(['index.json', 'ok.txt']);
  });

  it('does not let a caller overwrite the index', async () => {
    const s = open();
    await expect(s.write('index.json', '{}')).rejects.toThrow(/path/i);
  });
});

describe('two stores on one folder (two server processes)', () => {
  it('both write at once and every file is whole, with no temp files left', async () => {
    const a = open();
    const b = open();
    const jobs: Promise<unknown>[] = [];
    for (let i = 0; i < 20; i++) {
      jobs.push((i % 2 ? a : b).write(`f/${i}.txt`, `content ${i}`.repeat(50)));
    }
    await Promise.all(jobs);
    for (let i = 0; i < 20; i++) {
      expect(await a.readText(`f/${i}.txt`)).toBe(`content ${i}`.repeat(50));
    }
    expect((await readdir(join(dir, 'f'))).filter((n) => n.startsWith('.tmp-'))).toEqual([]);
    // A racing index update may have lost an entry; the content files are the truth.
    await a.rebuild();
    expect((await b.list()).map((e) => e.path).sort()).toEqual(
      Array.from({ length: 20 }, (_, i) => `f/${i}.txt`).sort()
    );
  });

  it('one store never loses its own concurrent index updates', async () => {
    const s = open();
    await Promise.all(Array.from({ length: 20 }, (_, i) => s.write(`${i}.txt`, 'x')));
    expect(await s.list()).toHaveLength(20);
  });

  it('a file written by both at once is one of the two, never a mix', async () => {
    const a = open();
    const b = open();
    const big = (c: string) => c.repeat(1_000_000);
    for (let round = 0; round < 5; round++) {
      await Promise.all([a.write('same.txt', big('a')), b.write('same.txt', big('b'))]);
      const got = (await a.readText('same.txt'))!;
      expect([big('a'), big('b')]).toContain(got);
    }
  });

  it('a second store sees what the first wrote', async () => {
    await open().write('x.txt', 'shared');
    expect(await open().readText('x.txt')).toBe('shared');
  });
});

describe('the index is a rebuildable cache', () => {
  const seed = async () => {
    const s = open();
    await s.write('a.txt', 'aaa');
    await s.write('d/b.txt', 'bb');
    return s;
  };

  it('a missing index reads as empty, never throws, and the files stay readable', async () => {
    const s = await seed();
    await rm(join(dir, 'index.json'));
    expect(await s.list()).toEqual([]);
    expect(await s.readText('a.txt')).toBe('aaa');
    await s.rebuild();
    expect((await s.list()).map((e) => [e.path, e.bytes])).toEqual([
      ['a.txt', 3],
      ['d/b.txt', 2],
    ]);
  });

  it.each([
    ['garbage', '{{{ not json'],
    ['empty file', ''],
    ['a newer version', JSON.stringify({ version: 2, entries: { 'a.txt': { bytes: 3, at: 1 } } })],
    ['wrong shape', JSON.stringify({ version: 1, entries: ['a.txt'] })],
    ['null', 'null'],
  ])('a corrupt index (%s) reads as empty and never throws', async (_n, text) => {
    const s = await seed();
    await writeFile(join(dir, 'index.json'), text);
    expect(await s.list()).toEqual([]);
    expect(await s.usage()).toEqual({ files: 2, bytes: 5 });
  });

  it('keeps good entries and drops malformed ones', async () => {
    const s = await seed();
    await writeFile(
      join(dir, 'index.json'),
      JSON.stringify({
        version: 1,
        entries: { 'a.txt': { bytes: 3, at: 1 }, '../x': { bytes: 1, at: 1 }, 'z.txt': 'bad' },
      })
    );
    expect(await s.list()).toEqual([{ path: 'a.txt', bytes: 3, at: 1 }]);
  });

  it('the next write heals a lost or corrupt index from the files on disk', async () => {
    const s = await seed();
    await writeFile(join(dir, 'index.json'), 'garbage');
    await s.write('c.txt', 'c');
    expect((await s.list()).map((e) => e.path)).toEqual(['a.txt', 'c.txt', 'd/b.txt']);
  });

  it('an index entry for a file that is gone does not break reads', async () => {
    const s = await seed();
    await rm(join(dir, 'a.txt'));
    expect(await s.read('a.txt')).toBeUndefined();
  });
});

describe('memory-only fallback', () => {
  async function blockedDir() {
    const file = join(root, 'a-file');
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
    expect(await readdir(dir)).toEqual([]);
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
    expect(await readFile(join(dir, 'x.txt'), 'utf8')).toBe('ok');
  });
});

describe('byte budget', () => {
  it('evicts the oldest files first until the rest fits', async () => {
    const s = open({ maxBytes: 30 });
    await s.write('a', '1234567890'); // oldest
    await s.write('b', '1234567890');
    await s.write('c', '1234567890');
    expect((await s.list()).map((e) => e.path)).toEqual(['a', 'b', 'c']);
    await s.write('d', '1234567890');
    expect((await s.list()).map((e) => e.path)).toEqual(['b', 'c', 'd']);
    expect(await s.read('a')).toBeUndefined();
    await s.write('e', '12345678901234567890'); // 20 bytes: b and c both go
    expect((await s.list()).map((e) => e.path)).toEqual(['d', 'e']);
    expect(await s.usage()).toEqual({ files: 2, bytes: 30 });
  });

  it('a rewritten file counts as new, not as old', async () => {
    const s = open({ maxBytes: 30 });
    await s.write('a', '1234567890');
    await s.write('b', '1234567890');
    await s.write('c', '1234567890');
    await s.write('a', 'ABCDEFGHIJ');
    await s.write('d', '1234567890');
    expect((await s.list()).map((e) => e.path)).toEqual(['a', 'c', 'd']); // b was the oldest
  });

  it('never evicts the file it has just written, and refuses one that can never fit', async () => {
    const s = open({ maxBytes: 10 });
    await s.write('a', '12345');
    await expect(s.write('huge', '123456789012345')).resolves.toBe(false);
    expect((await s.list()).map((e) => e.path)).toEqual(['a']);
    await s.write('b', '1234567890');
    expect((await s.list()).map((e) => e.path)).toEqual(['b']);
  });

  it('measures the files on disk, so a store that lost its index still evicts', async () => {
    const s = open({ maxBytes: 20 });
    await s.write('a', '1234567890');
    await s.write('b', '1234567890');
    await rm(join(dir, 'index.json'));
    await s.write('c', '1234567890');
    expect((await s.list()).map((e) => e.path)).toEqual(['b', 'c']);
  });

  it('usage() counts files and bytes, not the index or temp files', async () => {
    const s = open();
    expect(await s.usage()).toEqual({ files: 0, bytes: 0 });
    await s.write('a/b.txt', '12345');
    await s.write('c.txt', '12');
    await writeFile(join(dir, `.tmp-${process.pid}-live`), 'in flight');
    expect(await s.usage()).toEqual({ files: 2, bytes: 7 });
  });

  it('sweeps a temp file a crashed process left behind, but not a fresh one', async () => {
    const s = open({ now: () => Date.now() });
    await s.write('a.txt', '1');
    const stale = join(dir, '.tmp-1-stale');
    const fresh = join(dir, '.tmp-2-fresh');
    await writeFile(stale, 'x');
    await writeFile(fresh, 'x');
    const old = new Date(Date.now() - 2 * 3600_000);
    await utimes(stale, old, old);
    await s.usage();
    expect(await names(dir)).toEqual(['.tmp-2-fresh', 'a.txt', 'index.json']);
  });
});

describe('forget', () => {
  it('removes everything in the folder, then the store still works', async () => {
    const s = open();
    await s.write('a.txt', '1');
    await s.write('deep/er/b.txt', '2');
    await writeFile(join(dir, `.tmp-${process.pid}-x`), 'leftover');
    await s.forget();
    expect(await readdir(dir)).toEqual(['.generation']); // only forget's own token stays
    expect(await s.list()).toEqual([]);
    expect(await s.usage()).toEqual({ files: 0, bytes: 0 });
    await s.write('again.txt', 'new');
    expect(await s.readText('again.txt')).toBe('new');
  });

  it('is fine when there is nothing to forget', async () => {
    await expect(open().forget()).resolves.toBeUndefined();
    await mkdir(dir, { recursive: true });
    await expect(open().forget()).resolves.toBeUndefined();
  });

  it('clears the memory fallback too', async () => {
    const file = join(root, 'f');
    await writeFile(file, 'x');
    const s = createStore({ dir: join(file, 'sub'), now: clock() });
    await s.write('a.txt', 'mem');
    await s.forget();
    expect(await s.read('a.txt')).toBeUndefined();
    expect(await s.usage()).toEqual({ files: 0, bytes: 0 });
  });

  it('says so when it could not delete something, rather than pretending', async () => {
    const s = open();
    await s.write('a.txt', '1');
    const fs: StoreFs = {
      ...realFs,
      rm: async () => {
        throw Object.assign(new Error('denied'), { code: 'EACCES' });
      },
    };
    await expect(open({ fs }).forget()).rejects.toMatchObject({ code: 'EACCES' });
    expect(await stat(join(dir, 'a.txt'))).toBeTruthy();
  });
});

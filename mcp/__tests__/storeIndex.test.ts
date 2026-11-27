import { describe, expect, it } from 'vitest';
import { rm, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { storeHarness } from './storeTestKit';

const { h, open, names } = storeHarness();

describe('the index is a rebuildable cache', () => {
  const seed = async () => {
    const s = open();
    await s.write('a.txt', 'aaa');
    await s.write('d/b.txt', 'bb');
    return s;
  };

  it('a missing index reads as empty, never throws, and the files stay readable', async () => {
    const s = await seed();
    await rm(join(h.dir, 'index.json'));
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
    await writeFile(join(h.dir, 'index.json'), text);
    expect(await s.list()).toEqual([]);
    expect(await s.usage()).toEqual({ files: 2, bytes: 5 });
  });

  it('keeps good entries and drops malformed ones', async () => {
    const s = await seed();
    await writeFile(
      join(h.dir, 'index.json'),
      JSON.stringify({
        version: 1,
        entries: { 'a.txt': { bytes: 3, at: 1 }, '../x': { bytes: 1, at: 1 }, 'z.txt': 'bad' },
      })
    );
    expect(await s.list()).toEqual([{ path: 'a.txt', bytes: 3, at: 1 }]);
  });

  it('the next write heals a lost or corrupt index from the files on disk', async () => {
    const s = await seed();
    await writeFile(join(h.dir, 'index.json'), 'garbage');
    await s.write('c.txt', 'c');
    expect((await s.list()).map((e) => e.path)).toEqual(['a.txt', 'c.txt', 'd/b.txt']);
  });

  it('an index entry for a file that is gone does not break reads', async () => {
    const s = await seed();
    await rm(join(h.dir, 'a.txt'));
    expect(await s.read('a.txt')).toBeUndefined();
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
    await rm(join(h.dir, 'index.json'));
    await s.write('c', '1234567890');
    expect((await s.list()).map((e) => e.path)).toEqual(['b', 'c']);
  });

  it('usage() counts files and bytes, not the index or temp files', async () => {
    const s = open();
    expect(await s.usage()).toEqual({ files: 0, bytes: 0 });
    await s.write('a/b.txt', '12345');
    await s.write('c.txt', '12');
    await writeFile(join(h.dir, `.tmp-${process.pid}-live`), 'in flight');
    expect(await s.usage()).toEqual({ files: 2, bytes: 7 });
  });

  it('sweeps a temp file a crashed process left behind, but not a fresh one', async () => {
    const s = open({ now: () => Date.now() });
    await s.write('a.txt', '1');
    const stale = join(h.dir, '.tmp-1-stale');
    const fresh = join(h.dir, '.tmp-2-fresh');
    await writeFile(stale, 'x');
    await writeFile(fresh, 'x');
    const old = new Date(Date.now() - 2 * 3600_000);
    await utimes(stale, old, old);
    await s.usage();
    expect(await names(h.dir)).toEqual(['.tmp-2-fresh', 'a.txt', 'index.json']);
  });
});

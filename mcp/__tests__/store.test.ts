import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { storeHarness } from './storeTestKit';

const { h, open, names } = storeHarness();

describe('read and write', () => {
  it('round-trips text and bytes, creating folders as needed', async () => {
    const s = open();
    await s.write('subjects/EBC-X/text.md', 'Přednáška: příklad ěščřžýáíé');
    await s.write('subjects/EBC-X/orig.bin', Buffer.from([0, 1, 2, 255]));
    expect(await s.readText('subjects/EBC-X/text.md')).toBe('Přednáška: příklad ěščřžýáíé');
    expect([...(await s.read('subjects/EBC-X/orig.bin'))!]).toEqual([0, 1, 2, 255]);
    expect(await s.read('subjects/nothing.md')).toBeUndefined();
    expect(s.persistent).toBe(true);
    expect(await names(h.dir)).toEqual(['index.json', 'subjects']);
  });

  it('lists what it holds, with sizes and write times', async () => {
    const s = open();
    await s.write('b.txt', '12345');
    await s.write('a/c.txt', '123');
    expect(await s.list()).toEqual([
      { path: 'a/c.txt', bytes: 3, at: expect.any(Number) },
      { path: 'b.txt', bytes: 5, at: expect.any(Number) },
    ]);
    const index = JSON.parse(await readFile(join(h.dir, 'index.json'), 'utf8'));
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
    expect(await names(h.root)).toEqual(['reIS for Claude']);
    expect(await names(h.dir)).toEqual(['index.json', 'ok.txt']);
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
    expect((await readdir(join(h.dir, 'f'))).filter((n) => n.startsWith('.tmp-'))).toEqual([]);
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

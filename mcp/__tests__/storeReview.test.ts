import { describe, expect, it } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as realFs from 'node:fs/promises';
import { join } from 'node:path';
import type { StoreFs } from '../storeFs';
import { clock, gate, storeHarness } from './storeTestKit';

const { h, open, leftovers } = storeHarness();
const readOnlyDisk: StoreFs = {
  ...realFs,
  open: async () => {
    throw Object.assign(new Error('ro'), { code: 'EROFS' });
  },
  rm: (async () => {
    throw Object.assign(new Error('denied'), { code: 'EACCES' });
  }) as StoreFs['rm'],
};

describe('a stale writer cleaning up after a forget', () => {
  it('does not delete the file a newer writer put at the same path', async () => {
    const reached = gate();
    const hold = gate();
    const slow: StoreFs = {
      ...realFs,
      readFile: (async (p: string, ...rest: unknown[]) => {
        // The old writer's commit() reads the index; pause it there, file already landed.
        if (String(p).endsWith('index.json')) {
          reached.release();
          await hold.wait;
        }
        return (realFs.readFile as (...a: unknown[]) => unknown)(p, ...rest);
      }) as StoreFs['readFile'],
    };
    const old = open({ fs: slow });
    const fresh = open({ now: clock(1_800_000_000_000) });
    const pending = old.write('subjects/x.txt', 'old content, longer');
    await reached.wait;
    await fresh.forget();
    await fresh.write('subjects/x.txt', 'new');
    hold.release();
    expect(await pending).toBe(false);
    expect(await fresh.readText('subjects/x.txt')).toBe('new');
    expect((await fresh.list()).map((e) => e.path)).toContain('subjects/x.txt');
  });

  it('still takes back its own file when nobody wrote there since', async () => {
    const reached = gate();
    const hold = gate();
    const slow: StoreFs = {
      ...realFs,
      readFile: (async (p: string, ...rest: unknown[]) => {
        if (String(p).endsWith('index.json')) {
          reached.release();
          await hold.wait;
        }
        return (realFs.readFile as (...a: unknown[]) => unknown)(p, ...rest);
      }) as StoreFs['readFile'],
    };
    const pending = open({ fs: slow }).write('a/b.txt', 'late');
    await reached.wait;
    await open().forget();
    hold.release();
    expect(await pending).toBe(false);
    expect(await leftovers()).toEqual([]);
  });
});

describe('remove() when the disk will not let go', () => {
  it('stays removed after a rewrite that only reached memory', async () => {
    await open().write('grades.md', 'old grades');
    const m = open({ fs: readOnlyDisk });
    await m.write('grades.md', 'new grades');
    await m.remove('grades.md');
    expect(await m.read('grades.md')).toBeUndefined();
    expect((await m.list()).map((e) => e.path)).not.toContain('grades.md');
  });

  it('stays removed in this process even when the disk delete fails on a working folder', async () => {
    const s0 = open();
    await s0.write('x.md', 'data');
    const s = open({ fs: { ...realFs, rm: readOnlyDisk.rm } as StoreFs });
    await s.remove('x.md');
    expect(await s.read('x.md')).toBeUndefined();
    expect(await readFile(join(h.dir, 'x.md'), 'utf8')).toBe('data'); // still there for others
  });
});

describe('a path that fits the guard but not the operating system', () => {
  it('skips that file and keeps the store on disk', async () => {
    const s = open({ maxPathLength: h.dir.length + 45 });
    await expect(
      s.write('this/is/a/rather/long/relative/path/that/goes/on/and/on.txt', 'x')
    ).resolves.toBe(false);
    expect(s.persistent).toBe(true);
    expect(s.notice()).toBeUndefined();
    await expect(s.write('short.txt', 'ok')).resolves.toBe(true);
    expect(await s.readText('short.txt')).toBe('ok');
  });
});

describe('reserved names as a folder', () => {
  it.each(['.generation/x.txt', 'index.json/x.txt', 'INDEX.JSON/a/b', '.Generation/y'])(
    'refuses %s, so the store can always replace its own files',
    async (p) => {
      const s = open();
      await expect(s.write(p, 'x')).rejects.toThrow(/path/i);
      await mkdir(h.dir, { recursive: true });
      await writeFile(join(h.dir, 'unrelated.txt'), '1');
      await expect(s.forget()).resolves.toMatchObject({ files: expect.any(Number) });
      await s.write('after.txt', 'ok');
      await s.forget();
      expect(await leftovers()).toEqual([]);
    }
  );
});

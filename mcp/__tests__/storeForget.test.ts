import { describe, expect, it } from 'vitest';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import * as realFs from 'node:fs/promises';
import { join } from 'node:path';
import { createStore } from '../store';
import type { StoreFs } from '../storeFs';
import { clock, gate, storeHarness } from './storeTestKit';

const { h, open, leftovers } = storeHarness();

describe('forget', () => {
  it('removes everything in the folder, then the store still works', async () => {
    const s = open();
    await s.write('a.txt', '1');
    await s.write('deep/er/b.txt', '2');
    await writeFile(join(h.dir, `.tmp-${process.pid}-x`), 'leftover');
    await s.forget();
    expect(await readdir(h.dir)).toEqual(['.generation']); // only forget's own token stays
    expect(await s.list()).toEqual([]);
    expect(await s.usage()).toEqual({ files: 0, bytes: 0 });
    await s.write('again.txt', 'new');
    expect(await s.readText('again.txt')).toBe('new');
  });

  it('is fine when there is nothing to forget', async () => {
    await expect(open().forget()).resolves.toMatchObject({ files: 0 });
    await mkdir(h.dir, { recursive: true });
    await expect(open().forget()).resolves.toMatchObject({ files: 0 });
  });

  it('clears the memory fallback too', async () => {
    const file = join(h.root, 'f');
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
    expect(await stat(join(h.dir, 'a.txt'))).toBeTruthy();
  });
});

describe('forget() against a write in flight (another process)', () => {
  const settle = async (
    hold: 'open' | 'rename',
    forgetterFs?: StoreFs,
    target = 'subjects/X/new.txt'
  ) => {
    let renamed = false;
    const g = gate();
    const reached = gate();
    const slow: StoreFs = {
      ...realFs,
      [hold]: async (...args: unknown[]) => {
        reached.release();
        await g.wait;
        const r = await (realFs[hold] as (...a: unknown[]) => unknown)(...args);
        if (hold === 'rename') renamed = true;
        return r;
      },
    } as StoreFs;
    const writer = open({ fs: slow });
    const forgetter = open(forgetterFs ? { fs: forgetterFs } : {});
    await forgetter.write('keep/old.txt', 'written before');
    const pending = writer.write(target, 'in flight');
    await reached.wait;
    await forgetter.forget();
    g.release();
    const result = await pending;
    return { writer, forgetter, result, renamed };
  };

  it('a write stopped before its rename leaves nothing, and does not flip to memory', async () => {
    const { writer, result } = await settle('open');
    expect(result).toBe(false);
    expect(writer.persistent).toBe(true);
    expect(writer.notice()).toBeUndefined();
    expect(await leftovers()).toEqual([]);
  });

  it('a write whose temp file forget removed leaves nothing either', async () => {
    const { writer, result } = await settle('rename');
    expect(result).toBe(false);
    expect(writer.persistent).toBe(true);
    expect(await leftovers()).toEqual([]);
  });

  it('a write that renamed just after forget looked is taken back', async () => {
    // This forgetter misses the in-flight temp file, so the rename succeeds.
    const blind: StoreFs = {
      ...realFs,
      rm: (async (p: string, o: object) =>
        String(p).includes('.tmp-') ? undefined : realFs.rm(p, o)) as StoreFs['rm'],
    };
    // A top-level target: the blind forgetter then really leaves the temp file
    // (it would otherwise delete the whole subjects/ folder), so the rename lands.
    const { result, renamed } = await settle('rename', blind, 'late.txt');
    expect(renamed).toBe(true);
    expect(result).toBe(false);
    expect(await leftovers()).toEqual([]);
  });

  it('a write begun after forget lands normally', async () => {
    const s = open();
    await s.write('a.txt', '1');
    await s.forget();
    await expect(open().write('b.txt', '2')).resolves.toBe(true);
    expect(await leftovers()).toEqual(['b.txt', 'index.json']);
  });

  it('forget on a store that never existed still cancels a write already under way', async () => {
    const g = gate();
    const reached = gate();
    const slow = {
      ...realFs,
      open: async (...a: Parameters<typeof realFs.open>) => {
        reached.release();
        await g.wait;
        return realFs.open(...a);
      },
    } as StoreFs;
    const pending = open({ fs: slow }).write('x/y.txt', 'late');
    await reached.wait;
    await open().forget();
    g.release();
    expect(await pending).toBe(false);
    expect(await leftovers()).toEqual([]);
  });
});

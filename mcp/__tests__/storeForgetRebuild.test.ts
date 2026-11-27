// Review round 3 on PR #755 (Greptile, P1): a rebuild() that captures the new generation token while forget() is still deleting used to publish an index naming files forget() then removed. forget() now leaves an in-progress marker, and while a live one exists nothing starts or publishes. This file: rebuild, write and remove against a forget, and two forgets at once.
// Made-up content only.
import { describe, expect, it } from 'vitest';
import * as realFs from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import type { StoreFs } from '../storeFs';
import { blind, gate, pausedForgetter, storeHarness } from './storeTestKit';

const { h, open, leftovers } = storeHarness();

describe('rebuild() that starts while forget() is still deleting', () => {
  it('does not publish an index naming files forget() goes on to delete (the Greptile ordering)', async () => {
    await open().write('zzz.txt', 'forgotten soon');
    const f = pausedForgetter((p) => p.endsWith('zzz.txt'));
    const forgetting = open({ fs: f.fs }).forget();
    await f.reached; // the token is bumped; zzz.txt is not deleted yet
    // The rebuild's rename is held too, so it would land only after forget() finished.
    const g = gate();
    const looked = gate();
    const slow = {
      ...realFs,
      readdir: (async (...a: Parameters<typeof realFs.readdir>) => {
        try {
          return await (realFs.readdir as (...x: unknown[]) => Promise<unknown>)(...a);
        } finally {
          looked.release(); // the rebuild has read the token and looked for a marker
        }
      }) as StoreFs['readdir'],
      rename: async (...a: Parameters<typeof realFs.rename>) => {
        await g.wait;
        return realFs.rename(...a);
      },
    } as StoreFs;
    const rebuilding = open({ fs: slow }).rebuild();
    await looked.wait;
    f.release();
    await forgetting;
    g.release();
    await rebuilding;
    expect(await open().list()).toEqual([]);
    expect(await leftovers()).toEqual([]);
  });

  it('writes nothing at all while a forget is in progress, then works once it is done', async () => {
    await open().write('zzz.txt', 'forgotten soon');
    const f = pausedForgetter((p) => p.endsWith('zzz.txt'));
    const forgetting = open({ fs: f.fs }).forget();
    await f.reached;
    await open().rebuild();
    expect(await readdir(h.dir)).not.toContain('index.json');
    f.release();
    await forgetting;
    await open().write('new.txt', 'fresh');
    await open().rebuild();
    expect((await open().list()).map((e) => e.path)).toEqual(['new.txt']);
  });
});

describe('an ordinary write() that starts while forget() is still deleting', () => {
  it('is refused, not kept: it began after forget started', async () => {
    const s = open();
    await s.write('zzz.txt', 'forgotten soon');
    const f = pausedForgetter((p) => p.endsWith('zzz.txt'));
    const forgetting = open({ fs: f.fs }).forget();
    await f.reached;
    expect(await open().write('late.txt', 'written mid-forget')).toBe(false);
    f.release();
    await forgetting;
    expect(await leftovers()).toEqual([]);
    expect(await open().list()).toEqual([]);
  });

  it('a write that landed just before forget but commits after it leaves no stale index entries', async () => {
    // Writer W: its rename lands, then it pauses. A store forgets (removing everything
    // it can see, including W's file and the old index). W then resumes: its index
    // commit must not bring the other, forgotten names back.
    await open().write('keep-a.txt', 'a');
    await open().write('keep-b.txt', 'b');
    const g = gate();
    const atCommit = gate();
    let renames = 0;
    const slow = {
      ...realFs,
      rename: async (...a: Parameters<typeof realFs.rename>) => {
        if (++renames === 2) {
          // the second rename is the index commit: hold it until forget() is over
          atCommit.release();
          await g.wait;
        }
        return realFs.rename(...a);
      },
    } as StoreFs;
    const pending = open({ fs: slow }).write('w.txt', 'in flight');
    await atCommit.wait;
    await open({ fs: blind }).forget();
    g.release();
    expect(await pending).toBe(false);
    expect(await open().list()).toEqual([]);
    expect(await leftovers()).toEqual([]);
  });
});

describe('remove() against a forget()', () => {
  it('does not write the index back with forgotten names', async () => {
    const s = open();
    await s.write('a.txt', 'a');
    await s.write('zzz.txt', 'z');
    const g = gate();
    const reached = gate();
    let renames = 0;
    const slow = {
      ...realFs,
      rename: async (...a: Parameters<typeof realFs.rename>) => {
        if (++renames === 1) {
          reached.release();
          await g.wait;
        }
        return realFs.rename(...a);
      },
    } as StoreFs;
    const removing = open({ fs: slow }).remove('a.txt');
    await reached.wait;
    await open({ fs: blind }).forget();
    g.release();
    await removing;
    expect(await open().list()).toEqual([]);
    expect(await leftovers()).toEqual([]);
  });
});

describe('two forgets at once', () => {
  it('the first one still deleting keeps the store closed after the second finishes', async () => {
    await open().write('zzz.txt', 'forgotten soon');
    const f = pausedForgetter((p) => p.endsWith('zzz.txt'));
    const first = open({ fs: f.fs }).forget();
    await f.reached;
    await open().forget(); // runs to the end; must not clear or delete the first one's marker
    await open().rebuild(); // still refused: the first forget has not finished
    f.release();
    await first;
    expect(await leftovers()).toEqual([]);
    expect(await open().list()).toEqual([]);
  });

  it('both finish and leave no marker behind', async () => {
    const s = open();
    await s.write('a.txt', '1');
    await Promise.all([open().forget(), open().forget()]);
    expect(await readdir(h.dir)).toEqual(['.generation']);
  });
});

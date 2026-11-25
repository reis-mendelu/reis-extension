// Review round 3 on PR #755 (Greptile, P1): a rebuild() that captures the new
// generation token while forget() is still deleting files used to publish an
// index naming files forget() then removed. forget() now leaves a visible
// "in progress" marker; while a fresh one exists no token is readable, so no
// write, rebuild or index update can start or publish. Made-up content only.
import { describe, expect, it } from 'vitest';
import { readdir, stat, utimes, writeFile, mkdir } from 'node:fs/promises';
import * as realFs from 'node:fs/promises';
import { join } from 'node:path';
import type { StoreFs } from '../storeFs';
import { gate, storeHarness } from './storeTestKit';

const { h, open, leftovers } = storeHarness();
const MARKER = '.forgetting-';
// Misses in-flight temp files, so a held rename can still land after forget().
const blind = {
  ...realFs,
  rm: (async (p: string, o: object) =>
    String(p).includes('.tmp-') ? undefined : realFs.rm(p, o)) as StoreFs['rm'],
} as StoreFs;

/** A forgetter whose deletion pauses at the first rm of a file matching `at`; listing is sorted. */
function pausedForgetter(at: (p: string) => boolean) {
  const reached = gate();
  const release = gate();
  let paused = false;
  const fs = {
    ...realFs,
    readdir: (async (...a: Parameters<typeof realFs.readdir>) => {
      const r = await (realFs.readdir as (...x: unknown[]) => Promise<unknown[]>)(...a);
      return typeof r[0] === 'string' ? (r as string[]).sort() : r;
    }) as StoreFs['readdir'],
    rm: (async (p: string, o: object) => {
      if (!paused && at(String(p))) {
        paused = true;
        reached.release();
        await release.wait;
      }
      return realFs.rm(p, o);
    }) as StoreFs['rm'],
  } as StoreFs;
  return { fs, reached: reached.wait, release: release.release };
}

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

describe('a forget that crashed does not wedge the store', () => {
  const plant = async (ageMs: number) => {
    await mkdir(h.dir, { recursive: true });
    const marker = join(h.dir, `${MARKER}1234-abcdef`);
    await writeFile(marker, '1234');
    const t = new Date(Date.now() - ageMs);
    await utimes(marker, t, t);
    return marker;
  };
  // the harness clock counts up from a fixed past instant, so give these stores the real one
  const real = () => open({ now: Date.now });

  it('a fresh marker closes writes and rebuilds', async () => {
    await plant(1000);
    expect(await real().write('a.txt', 'x')).toBe(false);
    await real().rebuild();
    expect(await readdir(h.dir)).not.toContain('index.json');
  });

  it('an abandoned marker is ignored, and the next forget sweeps it away', async () => {
    const marker = await plant(60 * 60_000);
    const s = real();
    expect(await s.write('a.txt', 'x')).toBe(true);
    await s.forget();
    await expect(stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readdir(h.dir)).toEqual(['.generation']);
  });

  it('a live forget refreshes its marker as it deletes, so a slow one is not read as abandoned', async () => {
    const s0 = open();
    await s0.write('a.txt', '1');
    await s0.write('b.txt', '2');
    const stamps: number[] = [];
    let t = Date.now();
    const fs = {
      ...realFs,
      rm: (async (p: string, o: object) => {
        if (String(p).includes(MARKER)) return realFs.rm(p, o); // forget taking its own marker down
        const marker = (await realFs.readdir(h.dir)).find((n) => n.startsWith(MARKER));
        if (marker) stamps.push((await stat(join(h.dir, marker))).mtimeMs);
        t += 120_000;
        return realFs.rm(p, o);
      }) as StoreFs['rm'],
    } as StoreFs;
    await open({ fs, now: () => t }).forget();
    expect(stamps.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < stamps.length; i++) expect(stamps[i]).toBeGreaterThan(stamps[i - 1]!);
  });
});

describe("the marker is the store's own file", () => {
  it('no caller can name it, and it is never listed as content', async () => {
    const { safeRelPath } = await import('../storePath');
    expect(() => safeRelPath(`${MARKER}1-x`)).toThrow(/reserved/);
    expect(() => safeRelPath(`${MARKER.toUpperCase()}1-x/a.txt`)).toThrow(/reserved/);
    await mkdir(h.dir, { recursive: true });
    await writeFile(join(h.dir, `${MARKER}1-x`), '1');
    await writeFile(join(h.dir, 'a.txt'), 'a');
    const t = new Date(Date.now() - 60 * 60_000);
    await utimes(join(h.dir, `${MARKER}1-x`), t, t); // abandoned, so a rebuild may run
    const s = open({ now: Date.now });
    await s.rebuild();
    expect((await s.list()).map((e) => e.path)).toEqual(['a.txt']);
    expect(await s.usage()).toEqual({ files: 1, bytes: 1 });
  });
});

describe('review of the marker itself', () => {
  const failing = (code: string, when: (p: string) => boolean, times = Infinity): StoreFs => {
    let n = 0;
    return {
      ...realFs,
      rename: (async (a: string, b: string) => {
        if (when(String(b)) && n++ < times) throw Object.assign(new Error(code), { code });
        return realFs.rename(a, b);
      }) as StoreFs['rename'],
    } as StoreFs;
  };

  it('a forget that cannot raise its marker deletes nothing and says so', async () => {
    const s = open();
    await s.write('a.txt', '1');
    const before = await readdir(h.dir);
    await expect(
      open({ fs: failing('ENOSPC', (p) => p.includes(MARKER)) }).forget()
    ).rejects.toMatchObject({ code: 'ENOSPC' });
    expect(await readdir(h.dir)).toEqual(before);
  });

  it('retries when another forget deleted its temp file under it (ENOENT)', async () => {
    const s = open();
    await s.write('a.txt', '1');
    await open({
      fs: failing('ENOENT', (p) => p.includes(MARKER) || p.endsWith('.generation'), 3),
    }).forget();
    expect(await readdir(h.dir)).toEqual(['.generation']);
  });

  it('keeps deleting after a name that will not go, then reports it and leaves no marker', async () => {
    const s = open();
    await s.write('a.txt', '1');
    await s.write('zzz.txt', '2');
    const fs = {
      ...realFs,
      rm: (async (p: string, o: object) => {
        if (String(p).endsWith('a.txt')) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
        return realFs.rm(p, o);
      }) as StoreFs['rm'],
    } as StoreFs;
    await expect(open({ fs }).forget()).rejects.toMatchObject({ code: 'EBUSY' });
    expect(await readdir(h.dir)).toEqual(['.generation', 'a.txt']);
  });

  it('a marker that cannot be read counts as live, not as finished', async () => {
    await mkdir(h.dir, { recursive: true });
    await writeFile(join(h.dir, `${MARKER}1-x`), '1');
    const fs = {
      ...realFs,
      stat: (async (p: string, ...r: unknown[]) => {
        if (String(p).includes(MARKER))
          throw Object.assign(new Error('pending'), { code: 'EPERM' });
        return (realFs.stat as (...a: unknown[]) => unknown)(p, ...r);
      }) as StoreFs['stat'],
    } as StoreFs;
    expect(await open({ fs, now: Date.now }).write('a.txt', 'x')).toBe(false);
  });

  it('a forget whose marker was swept puts it back as it goes on deleting', async () => {
    const s = open();
    await s.write('a.txt', '1');
    await s.write('b.txt', '2');
    let swept = false;
    let sawBack = false;
    const fs = {
      ...realFs,
      rm: (async (p: string, o: object) => {
        if (String(p).includes(MARKER)) return realFs.rm(p, o);
        const marker = (await realFs.readdir(h.dir)).find((n) => n.startsWith(MARKER));
        if (!swept) {
          swept = true;
          await realFs.rm(join(h.dir, marker!)); // another forget swept it
        } else {
          sawBack ||= Boolean(marker);
        }
        return realFs.rm(p, o);
      }) as StoreFs['rm'],
    } as StoreFs;
    await open({ fs }).forget();
    expect(sawBack).toBe(true);
    expect(await readdir(h.dir)).toEqual(['.generation']);
  });

  it("a write submitted behind the same store's own running forget still lands", async () => {
    const s = open();
    await s.write('old.txt', 'old');
    const f = pausedForgetter((p) => p.endsWith('old.txt'));
    const own = open({ fs: f.fs });
    const forgetting = own.forget();
    await f.reached; // this store's forget is mid-delete
    const written = own.write('new.txt', 'new');
    f.release();
    await forgetting;
    expect(await written).toBe(true);
    expect(await own.readText('new.txt')).toBe('new');
    expect(await own.readText('old.txt')).toBeUndefined();
  });

  it('memory held by a degraded store is dropped as soon as another process starts a forget', async () => {
    await mkdir(h.dir, { recursive: true });
    const broken = open({
      fs: {
        ...realFs,
        open: async () => {
          throw Object.assign(new Error('denied'), { code: 'EACCES' });
        },
      } as unknown as StoreFs,
    });
    await broken.write('a.txt', 'kept in memory');
    expect(broken.persistent).toBe(false);
    await open().write('x.txt', 'x');
    const f = pausedForgetter((p) => p.endsWith('x.txt'));
    const forgetting = open({ fs: f.fs }).forget();
    await f.reached;
    expect(await broken.readText('a.txt')).toBeUndefined();
    f.release();
    await forgetting;
  });
});

// Round 3, review of the marker itself: it fails closed, a swept one is put back, forget keeps deleting past a stuck name, and memory-only stores follow a forget.
// Made-up content only.
import { describe, expect, it } from 'vitest';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import * as realFs from 'node:fs/promises';
import { join } from 'node:path';
import type { StoreFs } from '../storeFs';
import { beginForget } from '../storeGen';
import { MARKER, gate, pausedForgetter, storeHarness } from './storeTestKit';

const { h, open } = storeHarness();

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

describe('review round 4 on the marker (Greptile on abae6bfa)', () => {
  it('a memory-only write that saw a forget in progress stays refused after it ended', async () => {
    await mkdir(h.dir, { recursive: true });
    await open().write('x.txt', 'x');
    const looked = gate();
    const hold = gate();
    let armed = false;
    const degraded = open({
      fs: {
        ...realFs,
        open: async () => {
          await hold.wait; // keeps this store's queue busy, so the next write's turn comes late
          throw Object.assign(new Error('denied'), { code: 'EACCES' });
        },
        readdir: (async (...a: Parameters<typeof realFs.readdir>) => {
          try {
            return await (realFs.readdir as (...x: unknown[]) => Promise<unknown>)(...a);
          } finally {
            if (armed) looked.release(); // the write has seen the forget's marker
          }
        }) as StoreFs['readdir'],
      } as unknown as StoreFs,
    });
    const blocker = degraded.write('b.txt', 'first');
    const f = pausedForgetter((p) => p.endsWith('x.txt'));
    const forgetting = open({ fs: f.fs }).forget();
    await f.reached;
    armed = true;
    const pending = degraded.write('a.txt', 'kept in memory?'); // submitted mid-forget
    await looked.wait;
    f.release();
    await forgetting; // the forget is over before the write's turn
    hold.release();
    await blocker;
    expect(await pending).toBe(false);
    expect(await degraded.readText('a.txt')).toBeUndefined();
    await open().forget(); // nothing may be left in memory for this to miss
    expect(await degraded.usage()).toEqual({ files: 0, bytes: 0 });
  });

  it('a heartbeat in flight when forget ends cannot put the marker back', async () => {
    await mkdir(h.dir, { recursive: true });
    const reached = gate();
    const hold = gate();
    let armed = false;
    const fs = {
      ...realFs,
      utimes: (async (p: string, ...r: unknown[]) => {
        if (armed && String(p).includes(MARKER))
          throw Object.assign(new Error('swept'), { code: 'ENOENT' });
        return (realFs.utimes as (...a: unknown[]) => unknown)(p, ...r);
      }) as StoreFs['utimes'],
      rename: (async (a: string, b: string) => {
        if (armed && String(b).includes(MARKER)) {
          reached.release();
          await hold.wait;
        }
        return realFs.rename(a, b);
      }) as StoreFs['rename'],
    } as StoreFs;
    const marker = await beginForget(fs, h.dir, Date.now);
    armed = true;
    await realFs.rm(
      join(
        h.dir,
        (await readdir(h.dir)).find((n) => n.startsWith(MARKER))!
      )
    ); // swept
    const beat = marker.beat(); // finds it gone and starts to write it again
    await reached.wait;
    const end = marker.end(); // the forget is over while that write is held
    hold.release();
    await Promise.all([beat, end]);
    expect((await readdir(h.dir)).filter((n) => n.startsWith(MARKER))).toEqual([]);
  });
});

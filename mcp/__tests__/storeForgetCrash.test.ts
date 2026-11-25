// Round 3: a forget that crashed does not wedge the store, and the marker is the store's own file.
// Made-up content only.
import { describe, expect, it } from 'vitest';
import { mkdir, readdir, stat, utimes, writeFile } from 'node:fs/promises';
import * as realFs from 'node:fs/promises';
import { join } from 'node:path';
import type { StoreFs } from '../storeFs';
import { MARKER, storeHarness } from './storeTestKit';

const { h, open } = storeHarness();

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

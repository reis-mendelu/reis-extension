// Originals in the store: hostile names land inside the folder, one folder per link, the
// staleness rule, and no path claimed for what only memory holds.
import { describe, it, expect } from 'vitest';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import * as realFs from 'node:fs/promises';
import { createOriginals, originalDir } from '../storeOriginals';
import { createMapPersist } from '../storeMap';
import type { StoreFs } from '../storeFs';
import { storeHarness } from './storeTestKit';

const { h, open } = storeHarness();
const URL_A = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=1;download=1';
const URL_B = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=1;download=2';
const STAMP = 'modified 20. 11. 2025';
/** A read that began on 25 Nov 2025, later than the listed date. */
const token = (gen: string | null) => ({ gen, at: Date.parse('2025-11-25T10:00:00Z') });
const bytes = (s: string) => new TextEncoder().encode(s);

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

describe('saving originals', () => {
  it('lands every hostile name inside the store folder', async () => {
    const store = open();
    const o = createOriginals(store);
    const hostile = [
      '../../x',
      'C:\\x',
      'con.txt',
      '..',
      '/abs/path.pdf',
      `${'y'.repeat(300)}.zip`,
    ];
    for (const [i, name] of hostile.entries()) {
      const rel = await o.save({
        url: `${URL_A}${i}`,
        stamp: STAMP,
        bytes: bytes(name),
        filename: name,
        token: token(await store.generation()),
      });
      expect(rel, name).toMatch(/^originals\/[0-9a-f]{32}\/[^/\\]+$/);
    }
    const root = resolve(h.root);
    const all = await walk(root);
    expect(all.length).toBeGreaterThan(0);
    for (const p of all) {
      expect(p.startsWith(resolve(h.dir) + sep), p).toBe(true);
      expect(relative(h.dir, p).startsWith('..')).toBe(false);
    }
  });

  it('keeps two files with the same name apart, and replaces a file under a new name', async () => {
    const store = open();
    const o = createOriginals(store);
    const g = token(await store.generation());
    const a = await o.save({
      url: URL_A,
      stamp: STAMP,
      bytes: bytes('A'),
      filename: 'x.pdf',
      token: g,
    });
    const b = await o.save({
      url: URL_B,
      stamp: STAMP,
      bytes: bytes('B'),
      filename: 'x.pdf',
      token: g,
    });
    expect(a).not.toBe(b);
    expect((await store.read(a!))!.toString()).toBe('A');
    expect((await store.read(b!))!.toString()).toBe('B');
    const renamed = await o.save({
      url: URL_A,
      stamp: 'modified 21. 11. 2025',
      bytes: bytes('A2'),
      filename: 'y.pdf',
      token: g,
    });
    const left = (await store.listFolder(originalDir(URL_A))).map((e) => e.path);
    expect(left.sort()).toEqual([`${originalDir(URL_A)}/.reis-original.json`, renamed].sort());
  });

  it('trusts a kept original only for the same date, read on a later day, with its bytes on disk', async () => {
    const store = open();
    const o = createOriginals(store);
    await o.save({
      url: URL_A,
      stamp: STAMP,
      bytes: bytes('A'),
      filename: 'a.pdf',
      token: token(await store.generation()),
    });
    expect(await o.kept(URL_A, STAMP)).toBe(`${originalDir(URL_A)}/a.pdf`);
    expect(await o.keptPath(URL_A, STAMP)).toBe(
      join(h.dir, 'originals', originalDir(URL_A).slice(10), 'a.pdf')
    );
    expect(await o.kept(URL_A, 'modified 21. 11. 2025')).toBeUndefined();
    expect(await o.kept(URL_A, 'date 1. 10. 2025')).toBeUndefined();
    // Read the same day IS shows as modified: a later edit that day would look the same.
    await o.save({
      url: URL_B,
      stamp: 'modified 25. 11. 2025',
      bytes: bytes('B'),
      filename: 'b.pdf',
      token: token(await store.generation()),
    });
    expect(await o.kept(URL_B, 'modified 25. 11. 2025')).toBeUndefined();
    await store.remove(`${originalDir(URL_A)}/a.pdf`);
    expect(await o.kept(URL_A, STAMP)).toBeUndefined();
  });

  it('claims no path for an original only memory holds', async () => {
    const broken = {
      ...realFs,
      open: (async () => {
        throw Object.assign(new Error('no'), { code: 'EACCES' });
      }) as StoreFs['open'],
    } as StoreFs;
    const store = open({ fs: broken });
    const o = createOriginals(store);
    await o.save({
      url: URL_A,
      stamp: STAMP,
      bytes: bytes('A'),
      filename: 'a.pdf',
      token: token(''),
    });
    expect(store.persistent).toBe(false);
    expect(await o.kept(URL_A, STAMP)).toBeUndefined();
  });

  it('hands a kept original back by its path in the plugin build, never its bytes', async () => {
    const store = open();
    const o = createOriginals(store);
    await o.save({
      url: URL_A,
      stamp: STAMP,
      bytes: bytes('%PDF-1.4'),
      filename: 'a.pdf',
      token: token(await store.generation()),
    });
    const plugin = createMapPersist(store, { extractsText: false });
    const served = (await plugin.persist.load(
      'mendelu_read_file',
      { url: URL_A },
      STAMP
    )) as Record<string, unknown>;
    expect(served).toMatchObject({
      kind: 'saved file',
      filename: 'a.pdf',
      localPath: join(h.dir, `${originalDir(URL_A)}/a.pdf`),
    });
    expect(JSON.stringify(served)).not.toContain('PDF-1.4');
    // The .mcpb build serves only saved text: a kept original alone means download and extract.
    const mcpb = createMapPersist(store, { extractsText: true });
    expect(await mcpb.persist.load('mendelu_read_file', { url: URL_A }, STAMP)).toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import * as realFs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../store';
import type { StoreFs } from '../storeFs';

// Made-up content only: nothing here is a real student's data.
let root: string;
let dir: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'reis-store-safe-'));
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
const gate = () => {
  let release!: () => void;
  const wait = new Promise<void>((r) => (release = r));
  return { wait, release };
};
/** Everything under the folder except forget's own token. */
async function leftovers(): Promise<string[]> {
  const out: string[] = [];
  const walk = async (abs: string, rel: string) => {
    for (const e of await readdir(abs, { withFileTypes: true }).catch(() => [])) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (!rel && e.name === '.generation') continue;
      out.push(e.isDirectory() ? `${r}/` : r);
      if (e.isDirectory()) await walk(join(abs, e.name), r);
    }
  };
  await walk(dir, '');
  return out;
}

describe('forget() against a write in flight (another process)', () => {
  const settle = async (hold: 'open' | 'rename', forgetterFs?: StoreFs) => {
    const g = gate();
    const reached = gate();
    const slow: StoreFs = {
      ...realFs,
      [hold]: async (...args: unknown[]) => {
        reached.release();
        await g.wait;
        return (realFs[hold] as (...a: unknown[]) => unknown)(...args);
      },
    } as StoreFs;
    const writer = open({ fs: slow });
    const forgetter = open(forgetterFs ? { fs: forgetterFs } : {});
    await forgetter.write('keep/old.txt', 'written before');
    const pending = writer.write('subjects/X/new.txt', 'in flight');
    await reached.wait;
    await forgetter.forget();
    g.release();
    return { writer, forgetter, result: await pending };
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
    const { result } = await settle('rename', blind);
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

describe('names that clash', () => {
  it('a file and a folder of the same name do not drop the store to memory', async () => {
    const s = open();
    await s.write('subjects/X', 'a file');
    await expect(s.write('subjects/X/y.txt', 'nested')).resolves.toBe(false);
    await s.write('a/b', 'one');
    await expect(s.write('a', 'two')).resolves.toBe(false);
    expect(s.persistent).toBe(true);
    await expect(s.write('fine.txt', 'ok')).resolves.toBe(true);
    expect(await readFile(join(dir, 'fine.txt'), 'utf8')).toBe('ok');
  });

  it('refuses INDEX.JSON and .GENERATION in any case', async () => {
    const s = open();
    for (const p of ['INDEX.JSON', 'Index.Json', '.GENERATION', '.TMP-1-x']) {
      await expect(s.write(p, 'junk'), p).rejects.toThrow(/path/i);
    }
  });

  it('names differing only by case or Unicode form are one file in the index', async () => {
    const s = open();
    await s.write('a.txt', '1111');
    await s.write('A.txt', '22');
    const nfc = 'café.txt';
    const nfd = 'café.txt';
    await s.write(nfc, 'x');
    await s.write(nfd, 'yy');
    const listed = (await s.list()).map((e) => e.path);
    expect(listed.filter((p) => p.toLowerCase() === 'a.txt')).toHaveLength(1);
    expect(listed.filter((p) => p.normalize('NFC') === nfc)).toHaveLength(1);
  });

  it('a file named __proto__ is indexed, listed and removable like any other', async () => {
    const s = open();
    await s.write('__proto__', 'odd');
    await s.write('constructor', 'odd too');
    expect((await s.list()).map((e) => e.path)).toEqual(['__proto__', 'constructor']);
    await s.remove('constructor');
    expect((await s.list()).map((e) => e.path)).toEqual(['__proto__']);
    expect(await s.usage()).toEqual({ files: 1, bytes: 3 });
  });
});

describe('eviction and the memory fallback under trouble', () => {
  it('skips a file it cannot delete and still indexes the new write', async () => {
    const stuck = join(dir, 'a');
    const fs: StoreFs = {
      ...realFs,
      rm: (async (p: string, o: object) => {
        if (p === stuck) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
        return realFs.rm(p, o);
      }) as StoreFs['rm'],
    };
    const s = open({ fs, maxBytes: 20 });
    await s.write('a', '1234567890');
    await s.write('b', '1234567890');
    await s.write('c', '1234567890'); // wants a gone, cannot; takes b instead
    const listed = (await s.list()).map((e) => e.path);
    expect(listed).toContain('c');
    expect(listed).toContain('a'); // still on disk, so still listed
    expect(listed).not.toContain('b');
  });

  it('an older copy on disk is never served for a file rewritten in memory', async () => {
    const s = open();
    await s.write('grades.md', 'old grades');
    // From here the folder cannot be written; the rewrite lives in memory only.
    const failing: StoreFs = {
      ...realFs,
      open: async () => {
        throw Object.assign(new Error('ro'), { code: 'EROFS' });
      },
    };
    const m = open({ fs: failing, maxBytes: 20 });
    await m.write('grades.md', 'new grades');
    expect(await m.readText('grades.md')).toBe('new grades');
    await m.write('other.md', 'a different one'); // evicts grades.md from memory
    expect(await m.read('grades.md')).toBeUndefined();
    expect((await m.list()).map((e) => e.path)).not.toContain('grades.md');
  });

  it('refuses a file bigger than the memory cap once it has fallen back', async () => {
    const failing: StoreFs = {
      ...realFs,
      open: async () => {
        throw Object.assign(new Error('ro'), { code: 'EROFS' });
      },
    };
    const s = open({ fs: failing, maxBytes: 10 });
    await expect(s.write('big', '12345678901')).resolves.toBe(false);
    await expect(s.write('ok', '1234567890')).resolves.toBe(true);
  });
});

describe('what lands on disk', () => {
  it('is readable by its owner only', async () => {
    if (process.platform === 'win32') return;
    const s = open();
    await s.write('sub/a.txt', 'private');
    const { stat } = realFs;
    expect((await stat(join(dir, 'sub', 'a.txt'))).mode & 0o777).toBe(0o600);
    expect((await stat(join(dir, 'sub'))).mode & 0o777).toBe(0o700);
  });
});

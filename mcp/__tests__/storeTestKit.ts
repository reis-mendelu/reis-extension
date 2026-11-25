// Shared setup for the store tests. Made-up content only: nothing here is a real
// student's data.
import { afterEach, beforeEach } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../store';

export function clock(start = 1_700_000_000_000) {
  let t = start;
  return () => (t += 1000);
}

export const gate = () => {
  let release!: () => void;
  const wait = new Promise<void>((r) => (release = r));
  return { wait, release };
};

/** Registers a fresh temp folder per test; read `h.dir` / `h.root` inside tests. */
export function storeHarness() {
  const h = { root: '', dir: '' };
  beforeEach(async () => {
    h.root = await mkdtemp(join(tmpdir(), 'reis-store-'));
    h.dir = join(h.root, 'reIS for Claude');
  });
  afterEach(async () => {
    await rm(h.root, { recursive: true, force: true });
  });
  const open = (extra: Parameters<typeof createStore>[0] = {}) =>
    createStore({ dir: h.dir, now: clock(), ...extra });
  const names = async (p: string) => (await readdir(p)).sort();
  /** Everything under the folder except forget's own token. */
  async function leftovers(): Promise<string[]> {
    const out: string[] = [];
    const walk = async (abs: string, rel: string) => {
      // An absent folder is empty; any other failure must fail the test.
      const found = await readdir(abs, { withFileTypes: true }).catch(
        (e: NodeJS.ErrnoException) => {
          if (e.code === 'ENOENT') return [];
          throw e;
        }
      );
      for (const e of found) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (!rel && e.name === '.generation') continue;
        out.push(e.isDirectory() ? `${r}/` : r);
        if (e.isDirectory()) await walk(join(abs, e.name), r);
      }
    };
    await walk(h.dir, '');
    return out;
  }
  return { h, open, names, leftovers };
}

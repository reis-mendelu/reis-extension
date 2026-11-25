// reIS for Claude's map on disk: one shared folder per laptop that Desktop and
// every Claude Code window read and write at once. Decided with Dominik
// 2026-11-25 (docs/superpowers/specs/2026-11-25-reis-for-claude-map-design.md).
// Nothing imports this yet (step 1 of 7). It never holds the password or the
// IS sign-in; mcpStaysReadOnly.test.ts keeps those words out of the store files.
import * as realFs from 'node:fs/promises';
import path from 'node:path';
import { atomicWrite, type StoreFs } from './storeFs';
import {
  readIndex,
  writeIndex,
  scan,
  toIndex,
  toEntries,
  totalBytes,
  pickEvictions,
  type Entry,
} from './storeIndex';
import { insideDir, resolveStoreDir, safeRelPath } from './storePath';

export { safeRelPath, resolveStoreDir, StorePathError } from './storePath';
export type { Entry } from './storeIndex';

/** The real number is chosen after measuring a real student's files. */
export const DEFAULT_MAX_BYTES = 4 * 1024 ** 3;
/** The in-memory fallback lives inside the server's own memory, so it is far smaller. */
const MEMORY_MAX_BYTES = 128 * 1024 ** 2;

export type StoreOptions = {
  /** Folder to use; tests pass one. Default: the per-laptop folder from resolveStoreDir. */
  dir?: string;
  resolve?: Parameters<typeof resolveStoreDir>[0];
  fs?: StoreFs;
  now?: () => number;
  maxBytes?: number;
  sleep?: (ms: number) => Promise<void>;
};

export type Notice = { persistent: false; reason: string };
export type Store = ReturnType<typeof createStore>;

export function createStore(opts: StoreOptions = {}) {
  const dir = path.resolve(opts.dir ?? resolveStoreDir(opts.resolve));
  const fs = opts.fs ?? (realFs as StoreFs);
  const now = opts.now ?? Date.now;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const memMax = Math.min(maxBytes, MEMORY_MAX_BYTES);

  let persistent = true;
  let notice: Notice | undefined;
  const mem = new Map<string, { data: Buffer; at: number }>();
  // One write at a time per process; other processes are handled by the atomic
  // rename and by re-reading the index right before each merge.
  let chain: Promise<unknown> = Promise.resolve();
  const locked = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };

  const memEntries = (): Entry[] =>
    [...mem].map(([p, v]) => ({ path: p, bytes: v.data.length, at: v.at }));

  function degrade(e: unknown) {
    persistent = false;
    const code = (e as NodeJS.ErrnoException)?.code;
    notice = { persistent: false, reason: code ?? (e instanceof Error ? e.message : String(e)) };
  }

  function putInMemory(p: string, data: Buffer, at: number) {
    mem.delete(p);
    mem.set(p, { data, at });
    for (const old of pickEvictions(memEntries(), memMax, p)) mem.delete(old.path);
  }

  /** Record a finished write in the index and evict the oldest files if over budget. */
  async function commit(p: string, bytes: number, at: number) {
    const index = await readIndex(fs, dir);
    let entries: Entry[];
    let scanned = false;
    if (index) {
      index[p] = { bytes, at };
      entries = toEntries(index);
    } else {
      entries = await scan(fs, dir, now());
      scanned = true;
    }
    if (totalBytes(entries) > maxBytes) {
      if (!scanned) entries = await scan(fs, dir, now()); // the files are the truth
      const gone = pickEvictions(entries, maxBytes, p);
      for (const e of gone) await fs.rm(insideDir(dir, e.path), { force: true });
      const goneSet = new Set(gone.map((e) => e.path));
      entries = entries.filter((e) => !goneSet.has(e.path));
    }
    await writeIndex(fs, dir, toIndex(entries), at);
  }

  return {
    /** False once the folder could not be used and the store fell back to memory. */
    get persistent() {
      return persistent;
    },

    /** Returns the memory-only notice once, then undefined. */
    notice(): Notice | undefined {
      const n = notice;
      notice = undefined;
      return n;
    },

    /** True if kept; false if the file alone is bigger than the budget. */
    async write(rel: string, data: string | Uint8Array): Promise<boolean> {
      const p = safeRelPath(rel);
      const buf = Buffer.from(data);
      return locked(async () => {
        if (buf.length > (persistent ? maxBytes : memMax)) return false;
        const at = now();
        if (persistent) {
          try {
            await atomicWrite(fs, insideDir(dir, p), buf, at, { sleep: opts.sleep });
          } catch (e) {
            degrade(e);
          }
        }
        if (persistent) {
          await commit(p, buf.length, at).catch(() => {}); // the index is only a cache
          mem.delete(p);
          return true;
        }
        putInMemory(p, buf, at);
        return true;
      });
    },

    async read(rel: string): Promise<Buffer | undefined> {
      const p = safeRelPath(rel);
      const held = mem.get(p);
      if (held) return held.data;
      try {
        return await fs.readFile(insideDir(dir, p));
      } catch {
        return undefined;
      }
    },

    async readText(rel: string): Promise<string | undefined> {
      return (await this.read(rel))?.toString('utf8');
    },

    async remove(rel: string): Promise<void> {
      const p = safeRelPath(rel);
      return locked(async () => {
        mem.delete(p);
        await fs.rm(insideDir(dir, p), { force: true }).catch(() => {});
        const index = await readIndex(fs, dir);
        if (index && p in index) {
          delete index[p];
          await writeIndex(fs, dir, index, now()).catch(() => {});
        }
      });
    },

    /** From the index: empty when it is missing or damaged (see rebuild). */
    async list(): Promise<Entry[]> {
      const merged = (await readIndex(fs, dir)) ?? {};
      return toEntries({ ...merged, ...toIndex(memEntries()) });
    },

    /** Count and size of the content files themselves, not the index. */
    async usage(): Promise<{ files: number; bytes: number }> {
      const byPath = toIndex(await scan(fs, dir, now()));
      const entries = toEntries({ ...byPath, ...toIndex(memEntries()) });
      return { files: entries.length, bytes: totalBytes(entries) };
    },

    /** Rewrite the index from the files on disk. */
    rebuild(): Promise<void> {
      return locked(async () => {
        const entries = await scan(fs, dir, now());
        await writeIndex(fs, dir, toIndex(entries), now()).catch(() => {});
      });
    },

    /** Delete everything in the store folder (and memory). Throws if something could not be deleted. */
    forget(): Promise<void> {
      return locked(async () => {
        mem.clear();
        let names: string[];
        try {
          names = await fs.readdir(dir);
        } catch (e) {
          const code = (e as NodeJS.ErrnoException).code;
          if (code === 'ENOENT' || code === 'ENOTDIR') return;
          throw e;
        }
        for (const name of names) {
          await fs.rm(path.join(dir, name), { recursive: true, force: true });
        }
      });
    },
  };
}

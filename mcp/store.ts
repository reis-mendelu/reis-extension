// reIS for Claude's map on disk: one shared folder per laptop that Desktop and
// every Claude Code window read and write at once. Decided with Dominik
// 2026-11-25 (docs/superpowers/specs/2026-11-25-reis-for-claude-map-design.md).
// Nothing imports this yet (step 1 of 7). It never holds the password or the
// IS sign-in; mcpStaysReadOnly.test.ts keeps those words out of the store files.
import * as realFs from 'node:fs/promises';
import path from 'node:path';
import type { StoreFs } from './storeFs';
import { bumpGeneration } from './storeGen';
import {
  pickEvictions,
  readIndex,
  scan,
  toEntries,
  toIndex,
  totalBytes,
  writeIndex,
  type Entry,
  type Index,
} from './storeIndex';
import { GEN_FILE, insideDir, resolveStoreDir, safeRelPath } from './storePath';
import { createDiskWriter } from './storeWrite';

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

export function createStore(opts: StoreOptions = {}) {
  const dir = path.resolve(opts.dir ?? resolveStoreDir(opts.resolve));
  const fs = opts.fs ?? (realFs as StoreFs);
  const now = opts.now ?? Date.now;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const memMax = Math.min(maxBytes, MEMORY_MAX_BYTES);

  let persistent = true;
  let notice: Notice | undefined;
  const mem = new Map<string, { data: Buffer; at: number }>();
  /** Paths written in memory after the fall-back: an older copy on disk is stale, never served. */
  const shadowed = new Set<string>();
  // One write at a time per process; other processes are handled by the
  // atomic swap and by re-reading the index right before each merge.
  let chain: Promise<unknown> = Promise.resolve();
  const locked = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };

  const memEntries = (): Entry[] =>
    [...mem].map(([p, v]) => ({ path: p, bytes: v.data.length, at: v.at }));
  const withMemory = (disk: Index): Index => {
    const merged: Index = Object.assign(Object.create(null), disk, toIndex(memEntries()));
    for (const p of shadowed) if (!mem.has(p)) delete merged[p];
    return merged;
  };

  function degrade(e: unknown) {
    persistent = false;
    const code = (e as NodeJS.ErrnoException)?.code;
    notice = { persistent: false, reason: code ?? (e instanceof Error ? e.message : String(e)) };
  }

  function putInMemory(p: string, data: Buffer, at: number) {
    mem.delete(p);
    mem.set(p, { data, at });
    shadowed.add(p);
    for (const old of pickEvictions(memEntries(), memMax, p)) mem.delete(old.path);
  }

  const disk = createDiskWriter({ fs, dir, now, maxBytes, sleep: opts.sleep, degrade });

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

    /**
     * True if kept. False if it was not stored: bigger than the budget, a name
     * that clashes with another file's folder, or forget() ran while it wrote.
     */
    async write(rel: string, data: string | Uint8Array): Promise<boolean> {
      const p = safeRelPath(rel);
      const buf = Buffer.from(data);
      return locked(async () => {
        if (persistent) {
          if (buf.length > maxBytes) return false;
          const result = await disk.write(p, buf);
          if (result === 'skipped') return false;
          if (result === 'kept') {
            mem.delete(p);
            return true;
          }
        }
        if (buf.length > memMax) return false;
        putInMemory(p, buf, now());
        return true;
      });
    },

    async read(rel: string): Promise<Buffer | undefined> {
      const p = safeRelPath(rel);
      const held = mem.get(p);
      if (held) return held.data;
      if (shadowed.has(p)) return undefined;
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
        shadowed.delete(p);
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
      return toEntries(withMemory((await readIndex(fs, dir)) ?? toIndex([])));
    },

    /** Count and size of the content files themselves, not the index. */
    async usage(): Promise<{ files: number; bytes: number }> {
      const entries = toEntries(withMemory(toIndex(await scan(fs, dir, now()))));
      return { files: entries.length, bytes: totalBytes(entries) };
    },

    /** Rewrite the index from the files on disk. */
    rebuild(): Promise<void> {
      return locked(async () => {
        const entries = await scan(fs, dir, now());
        await writeIndex(fs, dir, toIndex(entries), now()).catch(() => {});
      });
    },

    /**
     * Delete everything in the store folder (and memory). A write that began
     * before this, in this process or another, is cancelled and cannot land
     * afterwards. Throws if something could not be deleted.
     */
    forget(): Promise<void> {
      return locked(async () => {
        mem.clear();
        shadowed.clear();
        let bumpError: unknown;
        try {
          await bumpGeneration(fs, dir, now());
        } catch (e) {
          bumpError = e;
        }
        let names: string[] = [];
        try {
          names = await fs.readdir(dir);
        } catch (e) {
          const code = (e as NodeJS.ErrnoException).code;
          if (code !== 'ENOENT' && code !== 'ENOTDIR') throw e;
        }
        for (const name of names) {
          if (name === GEN_FILE) continue;
          await fs.rm(path.join(dir, name), { recursive: true, force: true });
        }
        if (bumpError && (bumpError as NodeJS.ErrnoException).code !== 'ENOTDIR') throw bumpError;
      });
    },
  };
}

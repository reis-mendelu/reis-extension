// reIS for Claude's map on disk: one shared folder per laptop that Desktop and
// every Claude Code window read and write at once. Decided with Dominik
// 2026-11-25 (docs/superpowers/specs/2026-11-25-reis-for-claude-map-design.md).
// server.ts creates one and register.ts passes it to storeMap.ts (step 2 of 7).
// It never holds the password or the IS sign-in (mcpStaysReadOnly.test.ts keeps
// those words out of the store files).
import * as realFs from 'node:fs/promises';
import path from 'node:path';
import { withFileLock, type StoreFs } from './storeFs';
import { forgetFolder } from './storeForget';
import { FORGETTING, readGeneration } from './storeGen';
import { scan, toEntries, toIndex, totalBytes } from './storeIndex';
import { OS_MAX_PATH, insideDir, resolveStoreDir, safeRelPath } from './storePath';
import { createMemory } from './storeMemory';
import { createReader } from './storeRead';
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
  /** Longest whole path the OS accepts; default 259 on Windows, unlimited elsewhere. */
  maxPathLength?: number;
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
  const mem = createMemory(memMax);
  // One write at a time per process; other processes are handled by the
  // atomic swap and by re-reading the index right before each merge.
  let chain: Promise<unknown> = Promise.resolve();
  const locked = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };

  let forgets = 0; // forget() runs here: a write queued behind one re-reads its generation
  let forgetting = false; // this store's own forget() is running
  const syncMemory = async () => {
    // While another process is deleting this reads FORGETTING, which is not the
    // token memory holds, so what memory holds is dropped with the rest.
    if (mem.active) mem.sync(await readGeneration(fs, dir, now));
  };

  function degrade(e: unknown) {
    persistent = false;
    const code = (e as NodeJS.ErrnoException)?.code;
    notice = { persistent: false, reason: code ?? (e instanceof Error ? e.message : String(e)) };
  }

  const reader = createReader(fs, dir, mem, syncMemory, now);
  const disk = createDiskWriter({
    fs,
    dir,
    now,
    maxBytes,
    maxPathLength: opts.maxPathLength ?? OS_MAX_PATH,
    sleep: opts.sleep,
    degrade,
  });

  return {
    /** The folder this store uses (it may not exist until something is saved). */
    dir,

    /** The byte budget of the folder; a bulk download stops at it (buildMap.ts). */
    maxBytes,

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
    async write(
      rel: string,
      data: string | Uint8Array,
      opts: { after?: string | null } = {}
    ): Promise<boolean> {
      const p = safeRelPath(rel);
      const buf = Buffer.from(data);
      // Noted at submit, not at its turn, so another store's forget() in between
      // cancels it; not awaited, so the queue order is unchanged. A caller that
      // began earlier (a download) passes the token it took then: a forget() since
      // that moment, here or in another process, cancels the write.
      const submitted = forgets;
      const noted =
        'after' in opts ? Promise.resolve(opts.after ?? null) : readGeneration(fs, dir, now);
      const queuedBehindOwnForget = forgetting;
      return locked(async () => {
        const g0 =
          'after' in opts || (forgets === submitted && !queuedBehindOwnForget)
            ? await noted
            : await readGeneration(fs, dir, now);
        // Submitted while a forget() was deleting: it began after that forget did, so
        // it is refused, and never kept in memory (which cannot tell a later forget
        // apart without a token). Judged by what was seen then, not by looking again.
        if (g0 === FORGETTING) return false;
        if (persistent) {
          if (buf.length > maxBytes) return false;
          const result = await disk.write(p, buf, g0);
          if (result === 'skipped') return false;
          if (result === 'kept') {
            mem.delete(p);
            return true;
          }
        }
        if (buf.length > memMax) return false;
        mem.put(p, buf, now(), g0);
        return true;
      });
    },

    /**
     * Runs `fn` holding a lock shared with every server process on this folder, for a change
     * that reads several files and writes back. The store's own write and remove may be
     * called inside it: they take only this process's lock, a different one.
     */
    exclusive: <T>(name: string, fn: () => Promise<T>): Promise<T> =>
      withFileLock(fs, dir, name, fn),

    /** The folder's forget token now; hand it to write({ after }) to cancel the write if forget() runs first. */
    generation: () => readGeneration(fs, dir, now),

    read: reader.read,

    readHead: reader.readHead,

    diskPath: reader.diskPath,

    async readText(rel: string): Promise<string | undefined> {
      return (await this.read(rel))?.toString('utf8');
    },

    async remove(rel: string): Promise<void> {
      const p = safeRelPath(rel);
      return locked(async () => {
        mem.delete(p);
        // If the disk will not let go, hide the path for this process rather than
        // let the old copy come back on the next read.
        await fs.rm(insideDir(dir, p), { force: true }).catch(() => mem.hide(p));
        await disk.dropEntry(p);
      });
    },

    list: reader.list,

    /** The files directly in one folder, read from the folder itself rather than the index. */
    listFolder: reader.listFolder,

    usage: reader.usage,

    /** Rewrite the index from the files on disk. A folder that does not exist yet is left alone. */
    rebuild(): Promise<void> {
      return locked(async () => {
        if (!(await fs.stat(dir).catch(() => null))) return;
        await disk.rebuild();
      });
    },

    /**
     * Delete everything in the store folder (and memory). A write that began
     * before this, in this process or another, is cancelled and cannot land
     * afterwards. Returns what it removed, counted under the same lock as the
     * delete (a write by another process landing during the delete is removed but
     * not counted); throws if something could not be deleted.
     */
    forget(): Promise<{ files: number; bytes: number }> {
      return locked(async () => {
        await syncMemory();
        const held = toEntries(mem.overlay(toIndex(await scan(fs, dir, now()))));
        const removed = { files: held.length, bytes: totalBytes(held) };
        forgets++;
        forgetting = true;
        try {
          mem.clear();
          await forgetFolder(fs, dir, now);
        } finally {
          forgetting = false;
        }
        return removed;
      });
    },
  };
}

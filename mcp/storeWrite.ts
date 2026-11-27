// One write to the folder: atomic file, index entry, budget, and the checks that
// make forget() safe against a write in flight (storeGen.ts).
import { atomicWrite, type StoreFs } from './storeFs';
import {
  isOpen,
  isPerPathFailure,
  pruneEmptyDirs,
  readGeneration,
  sameGeneration,
} from './storeGen';
import {
  evict,
  putEntry,
  readIndex,
  scan,
  toEntries,
  toIndex,
  totalBytes,
  writeIndex,
  type Entry,
} from './storeIndex';
import { INDEX_FILE, insideDir } from './storePath';
import path from 'node:path';

type Ctx = {
  fs: StoreFs;
  dir: string;
  now: () => number;
  maxBytes: number;
  /** A joined path longer than this cannot be stored here (Windows); that file is skipped. */
  maxPathLength: number;
  sleep?: (ms: number) => Promise<void>;
  /** The folder cannot be used: the store goes memory-only. */
  degrade: (e: unknown) => void;
};

export function createDiskWriter({ fs, dir, now, maxBytes, maxPathLength, sleep, degrade }: Ctx) {
  /** Record a finished write in the index and evict the oldest files if over budget. */
  async function commit(p: string, bytes: number, at: number) {
    const index = await readIndex(fs, dir);
    let entries: Entry[];
    let scanned = false;
    if (index) {
      putEntry(index, p, bytes, at);
      entries = toEntries(index);
    } else {
      entries = await scan(fs, dir, now());
      scanned = true;
    }
    if (totalBytes(entries) > maxBytes) {
      if (!scanned) entries = await scan(fs, dir, now()); // the files are the truth
      entries = await evict(fs, dir, entries, maxBytes, p);
    }
    await writeIndex(fs, dir, toIndex(entries), at);
  }

  /**
   * The write landed, then a forget() began (or is still running): take back what
   * it left. A newer writer may have put its own file at the same path since, so
   * only a file holding our bytes is deleted. The index is not patched: the one on
   * disk may be a commit that read it before forget() deleted everything, so it can
   * name forgotten files. It is a cache, so it goes, and rebuild() (which refuses
   * while a forget() is running) writes the true one from the files.
   */
  async function undo(p: string, buf: Buffer) {
    const target = insideDir(dir, p);
    const current = await fs.readFile(target).catch(() => null);
    if (current?.equals(buf)) await fs.rm(target, { force: true }).catch(() => {});
    await fs.rm(path.join(dir, INDEX_FILE), { force: true }).catch(() => {});
    await pruneEmptyDirs(fs, dir, p);
    await rebuild();
  }

  /** Take one entry out of the index (its file was deleted); never lets a forgotten name back in. */
  async function dropEntry(p: string) {
    const g = await readGeneration(fs, dir, now);
    const indexFile = path.join(dir, INDEX_FILE);
    if (!isOpen(g)) {
      // A forget() is running (or the token is unreadable): do not rewrite anything.
      await fs.rm(indexFile, { force: true }).catch(() => {});
      return;
    }
    const index = await readIndex(fs, dir);
    if (!index || !(p in index)) return;
    delete index[p];
    await writeIndex(fs, dir, index, now()).catch(() => {});
    if (!sameGeneration(await readGeneration(fs, dir, now), g))
      await fs.rm(indexFile, { force: true }).catch(() => {});
  }

  /**
   * On disk: 'kept', or 'skipped' when this file was not stored (and nothing was
   * left behind). `g0` is the folder generation when the write was submitted, not
   * when its turn came: a forget() in between cancels it.
   */
  async function write(
    p: string,
    buf: Buffer,
    g0: string | null
  ): Promise<'kept' | 'skipped' | 'unusable'> {
    const at = now();
    // An unreadable token counts as changed: the write cannot prove it is not stale.
    const forgotten = async () => !sameGeneration(await readGeneration(fs, dir, now), g0);
    const target = insideDir(dir, p);
    // The temp file sits beside the target and has a longer name; a path the OS
    // would refuse is this file's problem, not the folder's.
    if (Math.max(target.length, path.dirname(target).length + 32) > maxPathLength) return 'skipped';
    let stored = false;
    try {
      stored = await atomicWrite(fs, target, buf, at, {
        sleep,
        stillValid: async () => !(await forgotten()),
      });
    } catch (e) {
      // Only a token that is readable and different proves forget() ran; a folder
      // that cannot be read at all must still fall back to memory.
      // (A forget() still deleting proves it too: that reads as FORGETTING, not as a token.)
      const current = await readGeneration(fs, dir, now);
      const proven = isOpen(g0) && current !== null && current !== g0;
      if (!proven) {
        if (!(await isPerPathFailure(fs, dir, e))) {
          degrade(e);
          return 'unusable';
        }
      }
    }
    if (!stored) {
      await pruneEmptyDirs(fs, dir, p);
      return 'skipped';
    }
    if (await forgotten()) {
      // forget() ran since: neither index this file nor evict a newer writer's.
      await undo(p, buf);
      return 'skipped';
    }
    await commit(p, buf.length, at).catch(() => {}); // the index is only a cache
    if (await forgotten()) {
      await undo(p, buf);
      return 'skipped';
    }
    return 'kept';
  }

  /**
   * Rewrite the index from the files on disk. It must never publish names that a
   * forget() has deleted or is about to: it starts only when the token is readable,
   * which excludes a forget() still deleting (storeGen.ts), and if the token moved
   * while it ran, it publishes nothing, or takes the index back if it already
   * landed (it is only a cache).
   */
  async function rebuild(): Promise<void> {
    const g0 = await readGeneration(fs, dir, now);
    if (!isOpen(g0)) return; // a forget() is deleting, or the token cannot be read
    const moved = async () => !sameGeneration(await readGeneration(fs, dir, now), g0);
    const entries = await scan(fs, dir, now());
    if (await moved()) return;
    // An empty store has no index at all, as after forget(): nothing to list or to go stale.
    if (entries.length) await writeIndex(fs, dir, toIndex(entries), now()).catch(() => {});
    else await fs.rm(path.join(dir, INDEX_FILE), { force: true }).catch(() => {});
    if (await moved()) await fs.rm(path.join(dir, INDEX_FILE), { force: true }).catch(() => {});
  }

  return { write, rebuild, dropEntry };
}

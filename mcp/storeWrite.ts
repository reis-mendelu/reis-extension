// One write to the folder: atomic file, index entry, budget, and the checks that
// make forget() safe against a write in flight (storeGen.ts).
import { atomicWrite, type StoreFs } from './storeFs';
import { isPerPathFailure, pruneEmptyDirs, readGeneration, sameGeneration } from './storeGen';
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
   * The write landed, then a forget() began: take back what it left. A newer
   * writer may have put its own file at the same path since, so only a file
   * holding our bytes is deleted and only our index entry is touched.
   */
  async function undo(p: string, buf: Buffer) {
    const target = insideDir(dir, p);
    const current = await fs.readFile(target).catch(() => null);
    const ours = current?.equals(buf) ?? false;
    if (ours) await fs.rm(target, { force: true }).catch(() => {});
    const index = await readIndex(fs, dir);
    if (index) {
      const st = current && !ours ? await fs.stat(target).catch(() => null) : null;
      if (st) index[p] = { bytes: st.size, at: st.mtimeMs };
      else delete index[p];
      if (Object.keys(index).length) await writeIndex(fs, dir, index, now()).catch(() => {});
      else await fs.rm(path.join(dir, INDEX_FILE), { force: true }).catch(() => {});
    }
    await pruneEmptyDirs(fs, dir, p);
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
    const forgotten = async () => !sameGeneration(await readGeneration(fs, dir), g0);
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
      const current = await readGeneration(fs, dir);
      const proven = g0 !== null && current !== null && current !== g0;
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

  return { write };
}

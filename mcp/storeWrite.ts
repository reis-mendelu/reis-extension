// One write to the folder: atomic file, index entry, budget, and the checks that
// make forget() safe against a write in flight (storeGen.ts).
import { atomicWrite, type StoreFs } from './storeFs';
import { isPerPathFailure, pruneEmptyDirs, readGeneration } from './storeGen';
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
  sleep?: (ms: number) => Promise<void>;
  /** The folder cannot be used: the store goes memory-only. */
  degrade: (e: unknown) => void;
};

export function createDiskWriter({ fs, dir, now, maxBytes, sleep, degrade }: Ctx) {
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

  /** The write landed, then a forget() began: take back what it left. */
  async function undo(p: string) {
    await fs.rm(insideDir(dir, p), { force: true }).catch(() => {});
    await fs.rm(path.join(dir, INDEX_FILE), { force: true }).catch(() => {});
    await pruneEmptyDirs(fs, dir, p);
  }

  /** On disk: 'kept', or 'skipped' when this file was not stored (and nothing was left behind). */
  async function write(p: string, buf: Buffer): Promise<'kept' | 'skipped' | 'unusable'> {
    const at = now();
    const g0 = await readGeneration(fs, dir);
    const forgotten = async () => (await readGeneration(fs, dir)) !== g0;
    let stored = false;
    try {
      stored = await atomicWrite(fs, insideDir(dir, p), buf, at, {
        sleep: sleep,
        stillValid: async () => !(await forgotten()),
      });
    } catch (e) {
      if (!(await forgotten())) {
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
    await commit(p, buf.length, at).catch(() => {}); // the index is only a cache
    if (await forgotten()) {
      await undo(p);
      return 'skipped';
    }
    return 'kept';
  }

  return { write };
}

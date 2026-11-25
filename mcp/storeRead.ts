// How the store reads a file back: what memory holds first (the fallback after the folder
// gave out), then the folder, unless the path is shadowed by a newer memory-only write.
// Split from store.ts. `sync` first, so a forget() in another process (a new folder
// generation) empties memory before anything is served from it.
import type { StoreFs } from './storeFs';
import type { createMemory } from './storeMemory';
import { readIndex, scan, toEntries, toIndex, totalBytes, type Entry } from './storeIndex';
import { insideDir, safeRelPath } from './storePath';

type Memory = ReturnType<typeof createMemory>;

export function createReader(
  fs: StoreFs,
  dir: string,
  mem: Memory,
  sync: () => Promise<void>,
  now: () => number
) {
  return {
    async read(rel: string): Promise<Buffer | undefined> {
      const p = safeRelPath(rel);
      await sync();
      const held = mem.get(p);
      if (held) return held;
      if (mem.isShadowed(p)) return undefined;
      try {
        return await fs.readFile(insideDir(dir, p));
      } catch {
        return undefined;
      }
    },

    /**
     * Only the first `bytes` of a file, as text, so a caller that needs a record's header
     * does not read a whole document. The cut may end inside a multi-byte character.
     */
    async readHead(rel: string, bytes: number): Promise<string | undefined> {
      const p = safeRelPath(rel);
      await sync();
      const held = mem.get(p);
      if (held) return held.subarray(0, bytes).toString('utf8');
      if (mem.isShadowed(p)) return undefined;
      try {
        const handle = await fs.open(insideDir(dir, p), 'r');
        try {
          const buf = Buffer.alloc(bytes);
          const { bytesRead } = await handle.read(buf, 0, bytes, 0);
          return buf.subarray(0, bytesRead).toString('utf8');
        } finally {
          await handle.close();
        }
      } catch {
        return undefined;
      }
    },

    /** From the index: empty when it is missing or damaged (see rebuild). */
    async list(): Promise<Entry[]> {
      await sync();
      return toEntries(mem.overlay((await readIndex(fs, dir)) ?? toIndex([])));
    },

    /** Count and size of the content files themselves, not the index. */
    async usage(): Promise<{ files: number; bytes: number }> {
      await sync();
      const entries = toEntries(mem.overlay(toIndex(await scan(fs, dir, now()))));
      return { files: entries.length, bytes: totalBytes(entries) };
    },
  };
}

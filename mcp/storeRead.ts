// How the store reads a file back: what memory holds first (the fallback after the folder
// gave out), then the folder, unless the path is shadowed by a newer memory-only write.
// Split from store.ts. `sync` first, so a forget() in another process (a new folder
// generation) empties memory before anything is served from it.
import type { StoreFs } from './storeFs';
import type { createMemory } from './storeMemory';
import { readIndex, scan, toEntries, toIndex, totalBytes, type Entry } from './storeIndex';
import { TEMP_PREFIX, insideDir, safeRelPath } from './storePath';

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

    /**
     * The absolute path of a file that is really in the folder, for a caller that hands a path
     * to Claude. Undefined when it is not there, or when memory holds a newer copy or hides it
     * (the folder gave out): a path is never claimed for what only memory has.
     */
    async diskPath(rel: string): Promise<string | undefined> {
      const p = safeRelPath(rel);
      await sync();
      if (mem.get(p) || mem.isShadowed(p)) return undefined;
      const full = insideDir(dir, p);
      try {
        return (await fs.stat(full)).isFile() ? full : undefined;
      } catch {
        return undefined;
      }
    },

    /** From the index: empty when it is missing or damaged (see rebuild). */
    async list(): Promise<Entry[]> {
      await sync();
      return toEntries(mem.overlay((await readIndex(fs, dir)) ?? toIndex([])));
    },

    /**
     * The files directly inside one folder, read from the folder itself, not the index: two
     * processes committing at once can each overwrite the other's index entry, so a file that
     * is on disk may be missing from it. What memory holds is laid over the result.
     */
    async listFolder(folder: string): Promise<Entry[]> {
      await sync();
      const found = toIndex([]);
      try {
        for (const item of await fs.readdir(insideDir(dir, safeRelPath(folder)), {
          withFileTypes: true,
        }))
          if (item.isFile() && !item.name.startsWith(TEMP_PREFIX))
            found[`${folder}/${item.name}`] = { bytes: 0, at: 0 };
      } catch {
        // no such folder yet: nothing saved there on disk
      }
      const prefix = `${folder}/`;
      return toEntries(mem.overlay(found)).filter((e) => e.path.startsWith(prefix));
    },

    /** Count and size of the content files themselves, not the index. */
    async usage(): Promise<{ files: number; bytes: number }> {
      await sync();
      const entries = toEntries(mem.overlay(toIndex(await scan(fs, dir, now()))));
      return { files: entries.length, bytes: totalBytes(entries) };
    },
  };
}

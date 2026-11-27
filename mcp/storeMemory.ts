// The memory-only fallback. A path written here after the folder gave out is
// "shadowed": an older copy of it on disk is stale and is never served or listed,
// even once the memory copy has been evicted or the disk would not delete it.
import { pickEvictions, toIndex, type Entry, type Index } from './storeIndex';

export function createMemory(maxBytes: number) {
  const held = new Map<string, { data: Buffer; at: number }>();
  const shadowed = new Set<string>();
  // The folder generation the held copies were taken under. If another process
  // runs forget() they are forgotten too, so a changed token empties memory.
  let gen: string | null = null;
  const moved = (g: string | null) => g !== null && gen !== null && g !== gen;
  const entries = (): Entry[] =>
    [...held].map(([p, v]) => ({ path: p, bytes: v.data.length, at: v.at }));

  return {
    maxBytes,
    /** Something is held or hidden, so the folder's generation is worth checking. */
    get active() {
      return held.size > 0 || shadowed.size > 0;
    },
    /** A copy, so a caller cannot change what is kept. */
    get: (p: string) => {
      const v = held.get(p)?.data;
      return v && Buffer.from(v);
    },
    /** Empty memory if the folder was forgotten under another generation. */
    sync(g: string | null) {
      if (moved(g)) this.clear();
    },
    isShadowed: (p: string) => shadowed.has(p),
    /** A copy kept in memory; evicts the oldest (never `p`) to stay inside the cap. */
    put(p: string, data: Buffer, at: number, g: string | null) {
      this.sync(g);
      gen = held.size ? (g ?? gen) : g;
      held.delete(p);
      held.set(p, { data, at });
      shadowed.add(p);
      for (const old of pickEvictions(entries(), maxBytes, p)) held.delete(old.path);
    },
    /** Hide `p` from disk reads too (the disk would not delete it). */
    hide: (p: string) => void shadowed.add(p),
    delete(p: string, { keepHidden = false } = {}) {
      held.delete(p);
      if (!keepHidden) shadowed.delete(p);
    },
    clear() {
      held.clear();
      shadowed.clear();
      gen = null;
    },
    /** What the disk index says, overlaid with memory, minus stale shadowed paths. */
    overlay(disk: Index): Index {
      const merged: Index = Object.assign(Object.create(null), disk, toIndex(entries()));
      for (const p of shadowed) if (!held.has(p)) delete merged[p];
      return merged;
    },
  };
}

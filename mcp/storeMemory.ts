// The memory-only fallback. A path written here after the folder gave out is
// "shadowed": an older copy of it on disk is stale and is never served or listed,
// even once the memory copy has been evicted or the disk would not delete it.
import { pickEvictions, toIndex, type Entry, type Index } from './storeIndex';

export function createMemory(maxBytes: number) {
  const held = new Map<string, { data: Buffer; at: number }>();
  const shadowed = new Set<string>();
  const entries = (): Entry[] =>
    [...held].map(([p, v]) => ({ path: p, bytes: v.data.length, at: v.at }));

  return {
    maxBytes,
    get: (p: string) => held.get(p)?.data,
    isShadowed: (p: string) => shadowed.has(p),
    /** A copy kept in memory; evicts the oldest (never `p`) to stay inside the cap. */
    put(p: string, data: Buffer, at: number) {
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
    },
    /** What the disk index says, overlaid with memory, minus stale shadowed paths. */
    overlay(disk: Index): Index {
      const merged: Index = Object.assign(Object.create(null), disk, toIndex(entries()));
      for (const p of shadowed) if (!held.has(p)) delete merged[p];
      return merged;
    },
  };
}

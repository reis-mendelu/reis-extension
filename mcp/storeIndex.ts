// The index is a cache of what is on disk: a missing or damaged one reads as
// empty and is rebuilt from the content files, which are the truth.
import path from 'node:path';
import { atomicWrite, type StoreFs } from './storeFs';
import { INDEX_FILE, TEMP_PREFIX, safeRelPath } from './storePath';

export type Entry = { path: string; bytes: number; at: number };
export type Index = Record<string, { bytes: number; at: number }>;

const VERSION = 1;
const STALE_TEMP_MS = 3600_000;

/** `null` when the index is missing or unreadable, so a caller can tell it from an empty store. */
export async function readIndex(fs: StoreFs, dir: string): Promise<Index | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(dir, INDEX_FILE), 'utf8')) as unknown;
    const o = raw as { version?: unknown; entries?: unknown } | null;
    if (!o || o.version !== VERSION) return null;
    if (!o.entries || typeof o.entries !== 'object' || Array.isArray(o.entries)) return null;
    const index: Index = {};
    for (const [p, v] of Object.entries(o.entries)) {
      const e = v as { bytes?: unknown; at?: unknown } | null;
      if (!e || typeof e.bytes !== 'number' || typeof e.at !== 'number') continue;
      try {
        index[safeRelPath(p)] = { bytes: e.bytes, at: e.at };
      } catch {
        // an entry naming a path the store would never write: ignore it
      }
    }
    return index;
  } catch {
    return null;
  }
}

export async function writeIndex(fs: StoreFs, dir: string, index: Index, at: number) {
  const body = Buffer.from(JSON.stringify({ version: VERSION, entries: index }));
  await atomicWrite(fs, path.join(dir, INDEX_FILE), body, at);
}

/**
 * Every content file in the folder, from the filesystem itself. Skips the
 * index, symlinks and other processes' in-flight temp files; removes a temp
 * file a crashed process left more than an hour ago.
 */
export async function scan(fs: StoreFs, dir: string, nowMs: number): Promise<Entry[]> {
  const out: Entry[] = [];
  const walk = async (abs: string, rel: string) => {
    let items;
    try {
      items = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const childRel = rel ? `${rel}/${item.name}` : item.name;
      const childAbs = path.join(abs, item.name);
      if (item.isDirectory()) await walk(childAbs, childRel);
      else if (item.isFile()) {
        if (!rel && item.name === INDEX_FILE) continue;
        try {
          const st = await fs.stat(childAbs);
          if (item.name.startsWith(TEMP_PREFIX)) {
            if (nowMs - st.mtimeMs > STALE_TEMP_MS) await fs.rm(childAbs, { force: true });
          } else {
            out.push({ path: childRel, bytes: st.size, at: st.mtimeMs });
          }
        } catch {
          // vanished between readdir and stat: another process removed it
        }
      }
    }
  };
  await walk(dir, '');
  return out;
}

export const toIndex = (entries: Entry[]): Index =>
  Object.fromEntries(entries.map((e) => [e.path, { bytes: e.bytes, at: e.at }]));

export const toEntries = (index: Index): Entry[] =>
  Object.entries(index)
    .map(([p, v]) => ({ path: p, bytes: v.bytes, at: v.at }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

export const totalBytes = (entries: Entry[]) => entries.reduce((n, e) => n + e.bytes, 0);

/** Oldest first, ties by path; the one in `keep` is never chosen. */
export function pickEvictions(entries: Entry[], max: number, keep: string): Entry[] {
  let total = totalBytes(entries);
  const chosen: Entry[] = [];
  const oldest = entries
    .filter((e) => e.path !== keep)
    .sort((a, b) => a.at - b.at || (a.path < b.path ? -1 : 1));
  for (const e of oldest) {
    if (total <= max) break;
    chosen.push(e);
    total -= e.bytes;
  }
  return chosen;
}

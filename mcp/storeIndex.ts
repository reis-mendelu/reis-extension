// The index is a cache of what is on disk: a missing or damaged one reads as
// empty and is rebuilt from the content files, which are the truth.
import path from 'node:path';
import { atomicWrite, type StoreFs } from './storeFs';
import { FORGET_PREFIX, GEN_FILE, INDEX_FILE, TEMP_PREFIX, fold, safeRelPath } from './storePath';

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
    const index: Index = Object.create(null); // a file may be named __proto__
    for (const [p, v] of Object.entries(o.entries)) {
      const e = v as { bytes?: unknown; at?: unknown } | null;
      if (!e || !Number.isFinite(e.bytes) || !Number.isFinite(e.at) || (e.bytes as number) < 0)
        continue;
      try {
        index[safeRelPath(p)] = { bytes: e.bytes as number, at: e.at as number };
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
 * index, links and other processes' in-flight temp files; removes a temp
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
        if (
          !rel &&
          (item.name === INDEX_FILE ||
            item.name === GEN_FILE ||
            item.name.startsWith(FORGET_PREFIX))
        )
          continue;
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

export function toIndex(entries: Entry[]): Index {
  const index: Index = Object.create(null);
  for (const e of entries) index[e.path] = { bytes: e.bytes, at: e.at };
  return index;
}

/** Record a write; a spelling of the same name that differs only by case or Unicode form is replaced. */
export function putEntry(index: Index, p: string, bytes: number, at: number) {
  const key = fold(p);
  for (const other of Object.keys(index))
    if (other !== p && fold(other) === key) delete index[other];
  index[p] = { bytes, at };
}

export const toEntries = (index: Index): Entry[] =>
  Object.entries(index)
    .map(([p, v]) => ({ path: p, bytes: v.bytes, at: v.at }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

export const totalBytes = (entries: Entry[]) => entries.reduce((n, e) => n + e.bytes, 0);

/**
 * The ledger of upcoming events (ledgerTool.ts) is the one thing here that cannot be fetched
 * again from IS: the budget evicts copies, never the student's saved dates. It stays inside the
 * budget's count, and it is capped at a few hundred small files, so it cannot crowd the rest out.
 */
const isProtected = (p: string) => p.startsWith('ledger/');

/**
 * Original files (storeOriginals.ts) are the cheapest to lose: IS hands them out again, and
 * the text kept of them still answers a search. They go first, oldest first, and only then
 * the saved text, the listings and the overview's record.
 */
const tier = (p: string) => (p.startsWith('originals/') ? 0 : 1);

/** Originals first, then oldest first, ties by path; the one in `keep` and the ledger are never listed. */
const oldestFirst = (entries: Entry[], keep: string) =>
  entries
    .filter((e) => e.path !== keep && !isProtected(e.path))
    .sort((a, b) => tier(a.path) - tier(b.path) || a.at - b.at || (a.path < b.path ? -1 : 1));

export function pickEvictions(entries: Entry[], max: number, keep: string): Entry[] {
  let total = totalBytes(entries);
  const chosen: Entry[] = [];
  for (const e of oldestFirst(entries, keep)) {
    if (total <= max) break;
    chosen.push(e);
    total -= e.bytes;
  }
  return chosen;
}

/**
 * Delete the oldest files until the rest fits; returns what is left. A file that
 * cannot be deleted (open in a viewer on Windows) is skipped, not fatal. Another
 * process may rewrite a file between the scan and this delete; the store is a
 * cache, so the worst case is one fresh copy fetched again.
 */
export async function evict(
  fs: StoreFs,
  dir: string,
  entries: Entry[],
  max: number,
  keep: string
): Promise<Entry[]> {
  const removed = new Set<string>();
  let total = totalBytes(entries);
  for (const e of oldestFirst(entries, keep)) {
    if (total <= max) break;
    try {
      await fs.rm(path.join(dir, ...e.path.split('/')), { force: true });
      removed.add(e.path);
      total -= e.bytes;
    } catch {
      // keep it listed and take the next-oldest instead; the next write tries again
    }
  }
  return entries.filter((e) => !removed.has(e.path));
}

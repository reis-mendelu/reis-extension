// Where a ledger entry's date came from, and whether that source has changed since (step 4b
// of the map). The check is stateless: it compares what Claude recorded (the file's date
// modified) with what the folder listing shows now, every time, so "recheck" stays on an entry
// until Claude reads the file again and updates it. It is never derived from the diff's
// "replaced" line, which is reported once and then gone.
import type { Store } from './store';
import type { LedgerEntry } from './ledgerEntry';
import { textPath } from './storeText';

type Listed = {
  downloadUrl: string;
  modified?: string;
  date?: string;
  file?: string;
  name?: string;
};
/** Folder listings by subject code; undefined for a subject whose listing could not be read. */
export type Listings = Record<string, Listed[] | undefined>;

/** The date IS shows for a file: Modifikace when there is one, else the upload date. */
export const listedDate = (f: Listed) => f.modified || f.date || '';
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** Why this entry's date needs checking again, or undefined when its source is as Claude read it. */
export function recheckReason(e: LedgerEntry, listings: Listings): string | undefined {
  if (!e.sourceUrl) return undefined;
  const lists = Object.values(listings).filter((l): l is Listed[] => !!l);
  const file = lists.flat().find((f) => f.downloadUrl === e.sourceUrl);
  if (file) {
    const now = listedDate(file);
    if (!e.sourceModified || !now || squash(now) === squash(e.sourceModified)) return undefined;
    return `its source file was replaced in IS (modified ${e.sourceModified}, now ${now}): read it again and update or remove this entry`;
  }
  // Gone is only said when the subject's own listing was read and does not have the file.
  if (e.code && listings[e.code]) {
    return 'its source file is no longer listed in IS: check the date another way, then update or remove this entry';
  }
  return undefined;
}

/** The listings the store holds (saved when a tool read them), for a call that does not ask IS. */
export async function storedListings(store: Store): Promise<Listings> {
  const out: Listings = {};
  const paths = (await store.list())
    .map((e) => e.path)
    .filter((p) => /^listings\/[^/]+\.json$/.test(p));
  for (const p of paths) {
    try {
      const rec = JSON.parse((await store.readText(p)) ?? 'null') as {
        code?: unknown;
        files?: unknown;
      } | null;
      if (typeof rec?.code !== 'string' || !Array.isArray(rec.files)) continue;
      out[rec.code] = (rec.files as Listed[]).filter(
        (f) => f && typeof f === 'object' && typeof f.downloadUrl === 'string'
      );
    } catch {
      // half-written by nobody (writes are atomic) or just forgotten
    }
  }
  return out;
}

/** What the listing knows about a file Claude names by its link, to fill in what Claude left out. */
export function findListed(listings: Listings, url: string) {
  return Object.values(listings)
    .flatMap((l) => l ?? [])
    .find((f) => f.downloadUrl === url);
}

/**
 * The date modified of the version of a file that was actually read: the stamp saved with its
 * text (storeMap.ts), not what the listing shows now. A teacher may have replaced the file since
 * Claude read it; filling in today's date would hide exactly that. Undefined when no text of it
 * is saved (a PDF in the plugin build, or a file not read through reIS).
 */
export async function readVersion(store: Store, url: string): Promise<string | undefined> {
  const head = (await store.readHead(textPath(url), 2048)) ?? '';
  const m = /"stamp":("(?:[^"\\]|\\.)*")/.exec(head);
  try {
    const stamp = m ? (JSON.parse(m[1]!) as string) : '';
    return /^(?:modified|date)\s+(.+)$/.exec(stamp)?.[1]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

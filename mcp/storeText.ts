// A file's saved text in the store (text/<hash>.json), split from storeMap.ts: where it lives,
// the record as written, what it costs the budget, and the one rule for trusting it.
import { createHash } from 'node:crypto';
import type { Store } from './store';
import { readAfterModified } from './storeStamp';

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);

/** A file's place in the store: its link, not its name, because IS names can repeat or clash. */
export const textPath = (url: string) =>
  `text/${createHash('sha256').update(url).digest('hex').slice(0, 32)}.json`;

/** A saved text's record without its savedAt; the order is the header's (textIsKept reads it). */
export const textBody = (url: string, stamp: string | undefined, value: Json) => ({
  url,
  stamp: stamp || null,
  kind: value.kind,
  file: value,
});

/** The bytes a record takes in the store: what put() writes for `body` read at `at`. */
export const recordBytes = (body: Json, at: number) =>
  Buffer.byteLength(JSON.stringify({ savedAt: new Date(at).toISOString(), ...body }));

/** What a kept text's decision needs, without its body. */
type TextMeta = { url: unknown; stamp: unknown; savedAt: unknown; kind: unknown };

/**
 * The one rule for a kept text, shared by load() and the overview's "textSaved" hint so they
 * cannot disagree: the record is for this link, was read against the date the listing shows
 * now, was read on a later day than that date, and (in the plugin build) is plain text.
 */
function isKept(m: TextMeta, url: string, stamp: string, extractsText: boolean): boolean {
  if (m.url !== url || m.stamp !== stamp) return false;
  if (!readAfterModified(stamp, m.savedAt)) return false;
  return extractsText || m.kind === 'text';
}

/** A whole record: the rule above plus the shape of the file it holds. Returns the file to hand back. */
export function keptText(rec: unknown, url: string, stamp: string, extractsText: boolean) {
  if (!isObject(rec)) return undefined;
  const f = rec.file;
  if (!isObject(f) || typeof f.text !== 'string' || typeof f.kind !== 'string') return undefined;
  return isKept(
    { url: rec.url, stamp: rec.stamp, savedAt: rec.savedAt, kind: f.kind },
    url,
    stamp,
    extractsText
  )
    ? f
    : undefined;
}

/**
 * Whether the record at `path` would be served, decided from its first bytes only. A record
 * is written as {savedAt, url, stamp, kind, file} in that order (see save), so the header
 * ends before the document's text starts. A record that does not match (older, damaged, a
 * very long link) is not saved: the hint errs on the side of "download again".
 */
const HEAD = 2048;
const STR = String.raw`"(?:[^"\\]|\\.)*"`;
const HEADER = new RegExp(
  String.raw`^\{"savedAt":("[^"]*"),"url":(${STR}),"stamp":(${STR}|null)(?:,"kind":("[^"]*"))?`
);
export async function textIsKept(
  store: Pick<Store, 'readHead'>,
  path: string,
  url: string,
  stamp: string,
  extractsText: boolean
): Promise<boolean> {
  const m = HEADER.exec((await store.readHead(path, HEAD)) ?? '');
  if (!m) return false;
  try {
    const [savedAt, u, st, kind] = m
      .slice(1)
      .map((x) => (x ? (JSON.parse(x) as unknown) : undefined));
    return isKept({ url: u, stamp: st, savedAt, kind }, url, stamp, extractsText);
  } catch {
    return false;
  }
}

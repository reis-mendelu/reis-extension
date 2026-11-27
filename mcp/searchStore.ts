// What search can look at, read from the store through its public API only (list and
// readText): subjects.json, listings/<CODE>.json and text/<hash>.json, as storeMap.ts
// wrote them. Never writes, and a file another process is replacing or a forget deleted
// in the meantime simply reads as missing.
import type { Store } from './store';
import { stampOf } from './cache';

/** One file the store knows: from a folder listing, from a saved text, or both. */
export type Doc = {
  url: string;
  /** Subject code; absent for a text whose listing is not stored. */
  code?: string;
  subjectName?: string;
  /** The document's title as IS prints it. */
  title?: string;
  /** The file's own name. */
  file?: string;
  folder?: string;
  modified?: string;
  date?: string;
  /** Where the text is saved, relative to the store folder; absent when none is. */
  textPath?: string;
  /** The whole saved text; absent when none is saved or the file had no text in it. */
  text?: string;
  /** What the listing shows now for the file (the cache's "modified …" / "date …"). */
  listedStamp?: string;
  /** What the listing showed when the saved text was read. */
  readStamp?: string;
};

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

async function readJson(store: Store, path: string): Promise<Json | undefined> {
  try {
    const v = JSON.parse((await store.readText(path)) ?? 'null') as unknown;
    return isObject(v) ? v : undefined;
  } catch {
    return undefined; // half-written by nobody (writes are atomic) or just forgotten
  }
}

/** The name a subject goes by in IS data: the Czech name first, as a Czech student reads it. */
const subjectNameOf = (s: Json) =>
  str(s.nameCs) ?? str(s.fullName) ?? str(s.displayName) ?? str(s.name);

export async function loadDocs(store: Store): Promise<{ docs: Doc[] }> {
  const paths = (await store.list()).map((e) => e.path);
  const names = new Map<string, string>();
  const subjects = await readJson(store, 'subjects.json');
  const list = Array.isArray(subjects?.subjects) ? (subjects.subjects as unknown[]) : [];
  for (const s of list) {
    if (!isObject(s)) continue;
    const code = str(s.subjectCode) ?? str(s.code);
    const name = subjectNameOf(s);
    if (code && name) names.set(code, name);
  }

  const byUrl = new Map<string, Doc>();
  const listings = paths.filter((p) => /^listings\/[^/]+\.json$/.test(p));
  for (const rec of await Promise.all(listings.map((p) => readJson(store, p)))) {
    const code = str(rec?.code);
    if (!code || !Array.isArray(rec?.files)) continue;
    for (const f of rec.files as unknown[]) {
      if (!isObject(f) || !str(f.downloadUrl)) continue;
      const url = f.downloadUrl as string;
      byUrl.set(url, {
        url,
        code,
        ...(names.has(code) ? { subjectName: names.get(code) } : {}),
        title: str(f.name),
        file: str(f.file),
        folder: str(f.folder),
        modified: str(f.modified),
        date: str(f.date),
        listedStamp: stampOf(f),
      });
    }
  }

  // The saved texts, a few at a time: each is a whole file's text, so they are the big reads.
  const texts = paths.filter((p) => /^text\/[^/]+\.json$/.test(p));
  for (let i = 0; i < texts.length; i += 8) {
    const batch = texts.slice(i, i + 8);
    const recs = await Promise.all(batch.map((p) => readJson(store, p)));
    recs.forEach((rec, k) => {
      const url = str(rec?.url);
      const file = rec?.file;
      if (!url || !isObject(file)) return;
      const doc = byUrl.get(url) ?? { url, file: str(file.filename) };
      doc.textPath = batch[k];
      doc.readStamp = str(rec?.stamp);
      // An empty text (a scanned PDF) is a file with no text, not a text with nothing in it.
      if (typeof file.text === 'string' && file.text.trim()) doc.text = file.text;
      byUrl.set(url, doc);
    });
  }
  return { docs: [...byUrl.values()] };
}

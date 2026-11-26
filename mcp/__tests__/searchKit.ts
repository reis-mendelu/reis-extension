// Shared by the search tests: writes into a store exactly what storeMap.ts writes
// (subjects.json, listings/<CODE>.json, text/<hash>.json), made-up content only.
import type { Store } from '../store';
import { textPath } from '../storeText';

export type Seed = {
  code: string;
  name?: string;
  /** Title IS prints for the document. */
  title?: string;
  file: string;
  folder?: string;
  modified?: string;
  /** Saved text; omit for a listed file nobody read. */
  text?: string;
  /** The listing date the text was read at; default: the listed one. */
  readStamp?: string;
};

export const urlOf = (code: string, file: string) =>
  `https://is.mendelu.cz/auth/dok_server/slozka.pl?code=${code};download=${encodeURIComponent(file)}`;

export async function seed(store: Store, items: Seed[]) {
  const codes = [...new Set(items.map((i) => i.code))];
  await store.write(
    'subjects.json',
    JSON.stringify({
      subjects: codes.map((code) => ({
        subjectCode: code,
        nameCs: items.find((i) => i.code === code && i.name)?.name,
      })),
    })
  );
  for (const code of codes) {
    const files = items
      .filter((i) => i.code === code)
      .map((i) => ({
        name: i.title ?? i.file,
        file: i.file,
        ...(i.folder ? { folder: i.folder } : {}),
        author: 'A',
        date: '1. 10. 2026',
        ...(i.modified ? { modified: i.modified } : {}),
        downloadUrl: urlOf(code, i.file),
      }));
    await store.write(`listings/${code}.json`, JSON.stringify({ code, files }));
  }
  for (const i of items) {
    if (i.text === undefined) continue;
    const url = urlOf(i.code, i.file);
    const stamp = i.readStamp ?? (i.modified ? `modified ${i.modified}` : 'date 1. 10. 2026');
    await store.write(
      textPath(url),
      JSON.stringify({
        savedAt: '2026-11-25T08:00:00.000Z',
        url,
        stamp,
        file: { filename: i.file, kind: 'pdf', text: i.text },
      })
    );
  }
}

export type SearchResult = {
  found: number;
  note?: string;
  searched?: string;
  hits: {
    subject: string;
    file: string;
    snippet?: string;
    line?: number;
    stale?: string;
    storedPath?: string;
    textSaved?: string;
    modified: string;
  }[];
};

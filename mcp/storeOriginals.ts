// The original files of the map (step 5, docs/superpowers/specs/2026-11-25-reis-for-claude-map-
// design.md decision 3): the bytes of a course file exactly as IS served them, so Claude Code can
// open a PDF, a zip or a .mat natively by its path. Zips stay zipped. One folder per file:
//   originals/<hash of the link>/<the file's own name, made safe>
//   originals/<hash of the link>/.reis-original.json   its link, listing date and when it was read
// The folder is the link's hash, so two files can never land on one path, whatever their names.
// The name comes from IS and is untrusted: safeFileName() repairs it into one plain segment, and
// the store's own path guard (storePath.ts) checks it again. Written only through store.write, so
// the budget, the forget token and the memory-only fallback apply to originals as to everything
// else; the budget evicts originals before anything else, since they can be fetched again.
import { createHash } from 'node:crypto';
import type { Store } from './store';
import { readAfterModified } from './storeStamp';
import { safeRelPath } from './storePath';

export const ORIGINALS = 'originals';
const META = '.reis-original.json';

export const originalDir = (url: string) =>
  `${ORIGINALS}/${createHash('sha256').update(url).digest('hex').slice(0, 32)}`;
export const metaPath = (url: string) => `${originalDir(url)}/${META}`;

const MAX_BASE_BYTES = 120;
// eslint-disable-next-line no-control-regex -- control characters are exactly what is replaced
const UNSAFE = /[\u0000-\u001f\u007f<>:"|?*\\/]/g;
const DEVICE =
  /^(con|prn|aux|nul|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3]|conin\$|conout\$)$/i;

/** Cut to at most `max` UTF-8 bytes without splitting a character. */
function cutBytes(s: string, max: number): string {
  let out = '';
  let used = 0;
  for (const ch of s) {
    const n = Buffer.byteLength(ch);
    if (used + n > max) break;
    out += ch;
    used += n;
  }
  return out;
}

/**
 * One safe file name from whatever IS sent: no separators (`../../x` and `C:\x` become plain
 * names), no control or Windows-forbidden characters, no leading dot (no hidden or relative
 * names, no `.tmp-` the store reserves), no trailing dot or space, never a Windows device name
 * (`con.txt`), at most 120 bytes before the extension. It repairs rather than refuses: a file is
 * stored under the closest safe name, and `file` when nothing usable is left.
 */
export function safeFileName(raw: unknown): string {
  const s = (typeof raw === 'string' ? raw : '')
    .normalize('NFC')
    .replace(UNSAFE, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^[\s.]+/, '')
    .replace(/[\s.]+$/, '');
  const ext = /\.[A-Za-z0-9]{1,10}$/.exec(s)?.[0] ?? '';
  let base = s.slice(0, s.length - ext.length).replace(/[\s.]+$/, '');
  // Windows reads `con.txt`, `CON .tar.gz` and `com1` as devices, whatever follows the dot.
  if (DEVICE.test((base.split('.')[0] ?? '').trim())) base = `_${base}`;
  base = cutBytes(base, MAX_BASE_BYTES).replace(/[\s.]+$/, '');
  const name = `${base || 'file'}${ext}`;
  try {
    safeRelPath(`${ORIGINALS}/x/${name}`);
    return name;
  } catch {
    return `file${ext}`;
  }
}

export type OriginalMeta = {
  savedAt: string;
  url: string;
  stamp: string;
  file: string;
  bytes: number;
  mediaType?: string;
};

type Token = { gen: string | null; at: number } | null | undefined;

/** The record kept beside an original, exactly as written. */
export function recordOf(o: {
  url: string;
  stamp: string;
  bytes: Uint8Array | number;
  filename?: string;
  mediaType?: string;
  at: number;
}): OriginalMeta {
  return {
    savedAt: new Date(o.at).toISOString(),
    url: o.url,
    stamp: o.stamp,
    file: safeFileName(o.filename),
    bytes: typeof o.bytes === 'number' ? o.bytes : o.bytes.byteLength,
    ...(o.mediaType ? { mediaType: o.mediaType } : {}),
  };
}

/** What an original with this record costs the budget: its bytes plus the record's. */
export const originalCost = (r: OriginalMeta) => r.bytes + Buffer.byteLength(JSON.stringify(r));

/** A listing stamp's day as YYYYMMDD, for ordering two copies of one file; 0 when unknown. */
const dayOf = (stamp: string) => {
  const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(stamp);
  return m ? Number(`${m[3]}${m[2]!.padStart(2, '0')}${m[1]!.padStart(2, '0')}`) : 0;
};
type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);

export function createOriginals(store: Store, now: () => number = Date.now) {
  async function meta(url: string): Promise<OriginalMeta | undefined> {
    try {
      const m = JSON.parse((await store.readText(metaPath(url))) ?? 'null') as unknown;
      if (!isObject(m) || m.url !== url || typeof m.file !== 'string') return undefined;
      if (typeof m.stamp !== 'string' || typeof m.savedAt !== 'string') return undefined;
      if (m.file !== safeFileName(m.file)) return undefined; // never a name this file did not make
      return m as OriginalMeta;
    } catch {
      return undefined;
    }
  }

  /**
   * Where the kept original of this link is, relative to the store folder, when it was read
   * against the date the listing shows now (`stamp`), on a later day than that date (the rule
   * the saved text follows, storeStamp.ts), and its bytes are really on disk: a copy that only
   * memory holds (the folder gave out) is never claimed as a path.
   */
  async function kept(url: string, stamp: string): Promise<string | undefined> {
    const m = await meta(url);
    if (!m || m.stamp !== stamp || !readAfterModified(stamp, m.savedAt)) return undefined;
    const rel = `${originalDir(url)}/${m.file}`;
    return (await store.diskPath(rel)) ? rel : undefined;
  }

  /** The absolute path of a kept original, or undefined. */
  async function keptPath(url: string, stamp: string): Promise<string | undefined> {
    const rel = await kept(url, stamp);
    return rel && store.diskPath(rel);
  }

  /** What mendelu_read_file answers in the plugin build for a kept original: its path, not its bytes. */
  async function handBack(url: string, stamp: string) {
    const m = await meta(url);
    const path = await keptPath(url, stamp);
    if (!m || !path) return undefined;
    return {
      filename: m.file,
      kind: 'saved file',
      localPath: path,
      bytes: m.bytes,
      note: 'This file is saved on this computer, unchanged since IS last listed it. Read it from localPath with your own file tools (a PDF directly; DOCX, PPTX, XLSX and ODT are zip archives of XML).',
    };
  }

  /**
   * Keeps the bytes, then the record that vouches for them. `token` is the forget token taken
   * when the download began: a forget() since then cancels both writes. Returns the stored path
   * relative to the folder, or undefined when it was not kept (over the budget, a path this
   * computer cannot hold, forgotten meanwhile). An older copy under another name is removed.
   */
  async function save(o: {
    url: string;
    stamp: string;
    bytes: Uint8Array;
    filename?: string;
    mediaType?: string;
    token?: Token;
  }): Promise<string | undefined> {
    const dir = originalDir(o.url);
    const file = safeFileName(o.filename);
    const rel = `${dir}/${file}`;
    const after = o.token ? { after: o.token.gen } : {};
    const record = recordOf({ ...o, at: o.token?.at ?? now() });
    // One save of a link at a time across every process on the folder, cleanup included:
    // otherwise two saves under different names could each delete the other's bytes, or an
    // older body could end up under a newer record.
    return store.exclusive(`original-${dir.slice(ORIGINALS.length + 1)}`, async () => {
      // A download that began against an older listing date never replaces a newer copy.
      const held = await meta(o.url);
      if (held && dayOf(held.stamp) > dayOf(o.stamp)) return undefined;
      if (!(await store.write(rel, o.bytes, after))) return undefined;
      if (!(await store.write(metaPath(o.url), JSON.stringify(record), after))) return undefined;
      for (const e of await store.listFolder(dir))
        if (e.path !== rel && e.path !== metaPath(o.url))
          await store.remove(e.path).catch(() => {});
      // The record's write may have pushed the folder over its budget and evicted the body.
      return (await store.readHead(rel, 1)) === undefined ? undefined : rel;
    });
  }

  return { kept, keptPath, handBack, save, meta };
}

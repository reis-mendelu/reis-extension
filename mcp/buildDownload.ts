// The download half of mendelu_build_my_map, shared with mendelu_refresh (step 6): GET each
// planned file from IS, keep its original and, where this build reads the type, its text, within
// the store's byte budget. A forget() after the call began stops it and nothing more is kept.
// Read-only toward IS: GET requests to dok_server only. It writes through the store alone.
import { assertDokServerUrl, extOf, headersOf, readKindOf, textOfBytes } from './files';
import { recordBytes, textBody } from './storeText';
import { MAX_FILE_BYTES } from './files';
// Aliased to ./documentHandover in the plugin build, like the import in files.ts.
import { MAX_DOCUMENT_BYTES } from './documentText';
import { readCapped, TooBigError } from './download';
import type { ToolCtx } from './tools';
import type { Store } from './store';
import { createOriginals, originalCost, originalDir, recordOf } from './storeOriginals';
import { sameGeneration } from './storeGen';
import { pool } from './buildPlan';
import type { Planned, Outcome } from './buildReport';

/** One original past this is not kept (a lecture recording in a folder); it is reported. */
export const MAX_ORIGINAL_BYTES = 100 * 1024 * 1024;
/** Downloads at once: the overview reads four listings at a time through the same sign-in. */
const CONCURRENCY = 3;

export type DownloadDeps = {
  store: Store;
  ctx: ToolCtx;
  /** The call's forget token: a forget() after the call began cancels every write and stops it. */
  token: { gen: string | null; at: number } | null;
  /** Saves a file's text as mendelu_read_file would (storeMap's saveText); true once kept. */
  saveText: (url: string, value: unknown, stamp: string) => Promise<boolean>;
  /** True where this build extracts document text (the .mcpb); the plugin keeps plain text only. */
  extractsText: boolean;
  maxFileBytes?: number;
  /** Largest file whose text is extracted; default the caps mendelu_read_file uses per kind. */
  maxTextBytes?: number;
  concurrency?: number;
};

export type Stop = 'budget' | 'forgotten' | 'folder' | undefined;

/** Downloads every planned file not already kept; `budget.used` is what the store holds after. */
export async function downloadPlanned(d: DownloadDeps, planned: Planned[]) {
  const budget = { max: d.store.maxBytes, used: (await d.store.usage()).bytes };
  const originals = createOriginals(d.store);
  /** What a file's folder really holds now: a record can outlive a body the budget evicted. */
  const bytesIn = async (dir: string) =>
    (await d.store.list())
      .filter((e) => e.path.startsWith(`${dir}/`))
      .reduce((n, e) => n + e.bytes, 0);
  const maxFile = d.maxFileBytes ?? MAX_ORIGINAL_BYTES;
  const outcomes = new Map<Planned, Outcome>();
  let stop: Stop;
  const halted = () =>
    stop === 'budget'
      ? 'skipped: the byte budget is reached'
      : stop === 'forgotten'
        ? 'skipped: everything was forgotten while this ran'
        : 'skipped: reIS lost access to its folder';

  async function one(p: Planned) {
    if (p.kept) return void outcomes.set(p, { state: 'kept' });
    // No readable token at the start means no write can be vouched for: the folder is the problem.
    if (!stop && (d.token?.gen ?? null) === null) stop = 'folder';
    if (!stop && !sameGeneration(await d.store.generation(), d.token!.gen)) stop = 'forgotten';
    if (!stop && !d.store.persistent) stop = 'folder';
    // What the record beside the original will take, before the body is known (its size field
    // grows by a few digits at most, which the exact check after the download covers).
    const at = d.token?.at ?? Date.now();
    const listed = p.file.file ?? p.file.name;
    const recordOnly = originalCost(
      recordOf({
        url: p.file.downloadUrl,
        stamp: p.stamp,
        bytes: 0,
        filename: listed,
        mediaType: 'x'.repeat(80),
        at,
      })
    );
    // A replaced file's stale copy goes when its new one is saved: only the growth is charged,
    // and only for bytes really on disk in its folder, never for a record whose body was evicted.
    const dir = originalDir(p.file.downloadUrl);
    const credit = await bytesIn(dir);
    const room = budget.max - budget.used - recordOnly + credit;
    if (!stop && room <= 0) stop = 'budget';
    if (stop) return void outcomes.set(p, { state: 'skipped', reason: halted() });
    const url = p.file.downloadUrl;
    try {
      assertDokServerUrl(url);
      const res = await d.ctx.fetch(url);
      if (!res.ok) throw new Error(`IS answered HTTP ${res.status} for this file.`);
      const h = headersOf(res);
      const limit = Math.min(maxFile, room);
      let bytes: Uint8Array;
      try {
        bytes = await readCapped(res, limit);
      } catch (e) {
        if (!(e instanceof TooBigError)) throw e;
        // IS said how big it is: past the per-file limit it is a size skip, never a budget stop.
        const declared = Number(res.headers.get('content-length') ?? 0);
        if (limit < maxFile && declared <= maxFile) {
          stop = 'budget';
          return void outcomes.set(p, { state: 'skipped', reason: halted() });
        }
        const mb = Math.round(maxFile / 1024 / 1024);
        return void outcomes.set(p, { state: 'skipped', reason: `skipped: over ${mb} MB` });
      }
      // Several downloads run at once: whichever finishes past the budget is not kept.
      const filename = h.filename ?? listed;
      // Exactly what the store will hold: the body and its record as written.
      const cost = originalCost(
        recordOf({ url, stamp: p.stamp, bytes, filename, mediaType: h.mediaType, at })
      );
      if (budget.used + cost - credit > budget.max) {
        stop = 'budget';
        return void outcomes.set(p, { state: 'skipped', reason: halted() });
      }
      budget.used += cost - credit;
      const saved = await originals.save({
        url,
        stamp: p.stamp,
        bytes,
        filename,
        mediaType: h.mediaType,
        token: d.token,
      });
      if (!saved) {
        budget.used -= cost - credit;
        // Refused because a forget ran meanwhile: say so, and stop the rest.
        if (!sameGeneration(await d.store.generation(), d.token!.gen)) {
          stop = 'forgotten';
          return void outcomes.set(p, { state: 'skipped', reason: halted() });
        }
        return void outcomes.set(p, {
          state: 'failed',
          reason: 'not saved: the path is too long for this computer, or everything was forgotten',
        });
      }
      // What the folder holds after the save, not what it should: a copy under an older name whose
      // removal failed is still there and still counts.
      // Awaited first: `used += await …` would read `used` before the wait and drop what other
      // downloads reserved meanwhile.
      const actual = await bytesIn(dir);
      budget.used += actual - cost;
      outcomes.set(p, { state: 'downloaded', text: await keepText(p, bytes, h, filename) });
    } catch (e) {
      const m = (e instanceof Error ? e.message : String(e)).split('\n')[0]!.slice(0, 120);
      outcomes.set(p, { state: 'failed', reason: m });
    }
  }

  /** The text too, where this build reads the type; within the budget, never a zip. */
  async function keepText(
    p: Planned,
    bytes: Uint8Array,
    h: ReturnType<typeof headersOf>,
    filename: string
  ): Promise<boolean> {
    // No name in the headers: the listing's name says what the file is (lecture.pdf).
    const ext = h.ext || extOf(filename);
    const kind = readKindOf(h.type, ext);
    if (!kind || (kind === 'document' && !d.extractsText)) return false;
    // Never more than mendelu_read_file would extract: a 100 MB deck could exhaust the memory
    // of the host process, which no catch survives. The original is kept either way.
    const cap = d.maxTextBytes ?? (kind === 'document' ? MAX_DOCUMENT_BYTES : MAX_FILE_BYTES);
    if (bytes.byteLength > cap) return false;
    try {
      const value = await textOfBytes(bytes, kind, {
        filename,
        mediaType: h.mediaType,
        ext,
      });
      // The whole record as storeMap writes it, not the text alone.
      const size = recordBytes(
        textBody(p.file.downloadUrl, p.stamp, value as never),
        d.token?.at ?? Date.now()
      );
      if (budget.used + size > budget.max) return false;
      budget.used += size;
      const kept = await d.saveText(p.file.downloadUrl, value, p.stamp).catch(() => false);
      if (!kept) budget.used -= size; // the store refused it: nothing to count or charge
      return kept;
    } catch {
      return false; // the original is kept; the text can be read later with mendelu_read_file
    }
  }

  await pool(planned, d.concurrency ?? CONCURRENCY, one);
  // A forget during the last download leaves no next file to notice it.
  if (!stop && d.token?.gen && !sameGeneration(await d.store.generation(), d.token.gen))
    stop = 'forgotten';
  return { outcomes, budget, stop };
}

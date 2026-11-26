// mendelu_build_my_map (step 5 of the map, decision 4 of docs/superpowers/specs/2026-11-25-
// reis-for-claude-map-design.md): every file of every enrolled subject, kept on this computer
// at once. It reads the subject list and the folder listings (the cheap requests the overview
// makes too), then downloads only what the store does not already hold for the date IS shows.
// Read-only toward IS: GET requests to dok_server only. It writes through the store alone.
import { assertDokServerUrl, extOf, headersOf, readKindOf, textOfBytes } from './files';
import { recordBytes, textBody } from './storeText';
import { MAX_FILE_BYTES } from './files';
// Aliased to ./documentHandover in the plugin build, like the import in files.ts.
import { MAX_DOCUMENT_BYTES } from './documentText';
import { readCapped, TooBigError } from './download';
import type { ToolCtx } from './tools';
import type { Store } from './store';
import { createOriginals, originalCost, recordOf } from './storeOriginals';
import { sameGeneration } from './storeGen';
import { plan, pool } from './buildPlan';
import type { Run } from './overviewGather';
import { dryReport, buildReport, type Planned, type Outcome } from './buildReport';

/** One original past this is not kept (a lecture recording in a folder); it is reported. */
export const MAX_ORIGINAL_BYTES = 100 * 1024 * 1024;
/** Downloads at once: the overview reads four listings at a time through the same sign-in. */
const CONCURRENCY = 3;

export type BuildDeps = {
  store: Store;
  ctx: ToolCtx;
  /** cache.run bound to this call's ticket: the listings note each file's date there. */
  run: Run;
  /** The call's forget token: a forget() after the call began cancels every write and stops it. */
  token: { gen: string | null; at: number } | null;
  /** Saves a file's text as mendelu_read_file would (storeMap's persist.save). */
  saveText: (url: string, value: unknown, stamp: string) => Promise<unknown>;
  /** True where this build extracts document text (the .mcpb); the plugin keeps plain text only. */
  extractsText: boolean;
  dryRun: boolean;
  maxFileBytes?: number;
  /** Largest file whose text is extracted; default the caps mendelu_read_file uses per kind. */
  maxTextBytes?: number;
  concurrency?: number;
};

export async function buildMap(d: BuildDeps) {
  const { planned, problems, codes } = await plan(d);
  const budget = { max: d.store.maxBytes, used: (await d.store.usage()).bytes };
  if (d.dryRun) return dryReport(planned, problems, budget, codes);
  if (!d.store.persistent)
    throw new Error(
      'reIS cannot save to its folder on this computer right now, so nothing was downloaded. Close any program holding files in that folder and try again.'
    );

  const originals = createOriginals(d.store);
  const maxFile = d.maxFileBytes ?? MAX_ORIGINAL_BYTES;
  const outcomes = new Map<Planned, Outcome>();
  let stop: 'budget' | 'forgotten' | 'folder' | undefined;
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
    const room = budget.max - budget.used - recordOnly;
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
        if (limit < maxFile) {
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
      if (budget.used + cost > budget.max) {
        stop = 'budget';
        return void outcomes.set(p, { state: 'skipped', reason: halted() });
      }
      budget.used += cost;
      const saved = await originals.save({
        url,
        stamp: p.stamp,
        bytes,
        filename,
        mediaType: h.mediaType,
        token: d.token,
      });
      if (!saved) {
        budget.used -= cost;
        return void outcomes.set(p, {
          state: 'failed',
          reason: 'not saved: the path is too long for this computer, or everything was forgotten',
        });
      }
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
      await d.saveText(p.file.downloadUrl, value, p.stamp);
      return true;
    } catch {
      return false; // the original is kept; the text can be read later with mendelu_read_file
    }
  }

  await pool(planned, d.concurrency ?? CONCURRENCY, one);
  return buildReport(planned, outcomes, problems, codes, {
    ...budget,
    stoppedAtBudget: stop === 'budget',
    forgotten: stop === 'forgotten',
    folder: d.store.dir,
  });
}

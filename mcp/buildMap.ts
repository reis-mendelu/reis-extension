// mendelu_build_my_map (step 5 of the map, decision 4 of docs/superpowers/specs/2026-11-25-
// reis-for-claude-map-design.md): every file of every enrolled subject, kept on this computer
// at once. It reads the subject list and the folder listings (the cheap requests the overview
// makes too), then downloads only what the store does not already hold for the date IS shows.
// Read-only toward IS: GET requests to dok_server only. It writes through the store alone.
import { listFolderFiles, assertDokServerUrl, headersOf, readKindOf, textOfBytes } from './files';
import type { SubjectFile } from './files';
import { readCapped, TooBigError } from './download';
import { subjectsData, type ToolCtx } from './tools';
import { stampOf } from './cache';
import type { Store } from './store';
import { createOriginals } from './storeOriginals';
import { sameGeneration } from './storeGen';
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
  concurrency?: number;
};

async function pool<T>(items: T[], n: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

/** The subjects and their listings, read the way the overview reads them. */
async function plan(d: BuildDeps): Promise<{ planned: Planned[]; problems: string[] }> {
  const data = await subjectsData(d.ctx);
  const originals = createOriginals(d.store);
  const planned: Planned[] = [];
  const problems: string[] = [];
  await pool(Object.entries(data), 4, async ([code, s]) => {
    if (typeof s.folderUrl !== 'string') return;
    const folderUrl = s.folderUrl;
    let files: SubjectFile[];
    try {
      files = (await d.run('mendelu_subject_files', { code }, () =>
        listFolderFiles(folderUrl)
      )) as SubjectFile[];
    } catch (e) {
      problems.push(
        `files of ${code}: ${(e instanceof Error ? e.message : String(e)).slice(0, 120)}`
      );
      return;
    }
    for (const f of files) {
      const stamp = stampOf(f);
      planned.push({ code, file: f, stamp, kept: !!(await originals.kept(f.downloadUrl, stamp)) });
    }
  });
  planned.sort((a, b) => a.code.localeCompare(b.code));
  return { planned, problems };
}

export async function buildMap(d: BuildDeps) {
  const { planned, problems } = await plan(d);
  const budget = { max: d.store.maxBytes, used: (await d.store.usage()).bytes };
  if (d.dryRun) return dryReport(planned, problems, budget);
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
    const room = budget.max - budget.used;
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
      if (budget.used + bytes.byteLength > budget.max) {
        stop = 'budget';
        return void outcomes.set(p, { state: 'skipped', reason: halted() });
      }
      budget.used += bytes.byteLength;
      const filename = h.filename ?? p.file.file ?? p.file.name;
      const saved = await originals.save({
        url,
        stamp: p.stamp,
        bytes,
        filename,
        mediaType: h.mediaType,
        token: d.token,
      });
      if (!saved) {
        budget.used -= bytes.byteLength;
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
    const kind = readKindOf(h.type, h.ext);
    if (!kind || (kind === 'document' && !d.extractsText)) return false;
    try {
      const value = await textOfBytes(bytes, kind, {
        filename,
        mediaType: h.mediaType,
        ext: h.ext,
      });
      const size = Buffer.byteLength(JSON.stringify(value));
      if (budget.used + size > budget.max) return false;
      budget.used += size;
      await d.saveText(p.file.downloadUrl, value, p.stamp);
      return true;
    } catch {
      return false; // the original is kept; the text can be read later with mendelu_read_file
    }
  }

  await pool(planned, d.concurrency ?? CONCURRENCY, one);
  return buildReport(planned, outcomes, problems, {
    ...budget,
    stoppedAtBudget: stop === 'budget',
    forgotten: stop === 'forgotten',
    folder: d.store.dir,
  });
}

// The front door of reIS for Claude (step 3 of the map, docs/superpowers/specs/
// 2026-11-25-reis-for-claude-map-design.md): one call that looks at IS, says what
// is new since it last told Claude, and hands over the map. Not in TOOLS: it needs
// the store and the tool cache, and it is registered first (register.ts).
import type { Store } from './store';
import type { ToolCtx } from './tools';
import type { Gathered, Run } from './overviewGather';
import { look, readRecord, recordLook } from './overviewLook';
import { fitOverview } from './overviewRender';
import { textIsKept, textPath } from './storeText';
import { createOriginals, metaPath } from './storeOriginals';
import { stampOf } from './cache';

// Why "overview": the failure it fixes is Claude not knowing where to look. The
// description is the only thing a model that has never seen reIS reads before it
// chooses a tool, so it says when to call this and what to do with the answer.
export const OVERVIEW_TOOL = {
  name: 'mendelu_overview',
  title: 'Overview of my school situation, and what changed',
  description:
    'START HERE. Call this FIRST, before any other mendelu_ tool, for any question about the student\'s school situation: how they are doing, their points, what is due, exams, the timetable, what is new, or where something is. One call returns: (1) "changed": what is new in IS since the last time it was called (new, replaced or removed course files, new or changed points, new assignment boxes or deadlines, new exam terms, new subjects), each shown ONCE; (2) the student\'s study programme and form; (3) every enrolled subject with the student\'s points in it and its course files (name, date modified, a `url` to give to mendelu_read_file, `textSaved: yes` when that file\'s text is already kept on this computer, and `localPath` when the original file itself is saved: it is relative to the folder named in `savedFiles`, so you can open it with your own file tools instead of downloading it; mendelu_build_my_map saves them all); (4) "upcoming": what is coming, soonest first, with days left, `attendance: yes` for events the student must attend in person, and `inNext14Days`: the registered exam and credit terms and assignment deadlines from IS, plus every event saved in the ledger (`source: ledger`, with its `id`; `basis: inferred` dates carry a `confirm` note, and `recheck` means the file the date came from changed: read it again and fix the entry); tell the student about anything within a week, and about every `recheck` and `confirm`. When you read a course file, conditions, harmonogram or mail that names a date the student must attend or act on, SAVE it with mendelu_ledger before answering; (5) the open assignments with deadlines, the exam terms and the lessons of the next 7 days. It downloads no file and changes nothing in IS. ' +
    'IMPORTANT: many answers are only inside a course file, not in IS\'s exam list or timetable: a credit-test date, test topics, passing conditions, a reference sheet, a project brief usually sit in a file such as a course schedule ("harmonogram") or conditions PDF. When a question is about such a thing, open the likely files from this map with mendelu_read_file (pass the file\'s `url`) BEFORE saying IS has no answer, and say which file the answer came from. If a subject\'s file list is cut ("N files in all"), call mendelu_subject_files with that code. When the answer depends on the student\'s study form (P = full-time, K = combined), use `student.form` rather than guessing. A subject with no points listed has none in IS yet. If the first line says this is the first overview, there is nothing to compare yet. Pass "json" as response_format only if you need raw data.',
} as const;

/** What the overview last told Claude. Lives in the store, so forget everything removes it. */
export const RECORD = 'overview/seen.json';

export type OverviewDeps = {
  store: Store;
  ctx: ToolCtx;
  /** cache.run bound to this call's ticket. */
  run: Run;
  /** The ticket's token: a forget() after the call began cancels the record's write. */
  token: unknown;
  /** Resolves once the study profile a call started has been written. */
  settled: () => Promise<unknown>;
  format: 'markdown' | 'json';
  now?: Date;
  /** False in the plugin build: only plain-text files have their text kept there. */
  extractsText?: boolean;
};

// One overview at a time per store in this process: two parallel calls (subagents) would
// both read the same record and report the same change twice.
const queues = new WeakMap<Store, Promise<unknown>>();

export function runOverview(d: OverviewDeps) {
  const prior = queues.get(d.store) ?? Promise.resolve();
  const run = prior.then(
    () => overview(d),
    () => overview(d)
  );
  queues.set(
    d.store,
    run.catch(() => {})
  );
  return run;
}

async function overview(d: OverviewDeps) {
  const { prev } = await readRecord(d.store, RECORD);
  const { g, ledger, changes } = await look(d.store, d.run, d.ctx, d.now ?? new Date(), prev);
  await d.settled();

  let profile: Record<string, unknown> | null = null;
  try {
    const p = JSON.parse((await d.store.readText('profile.json')) ?? 'null') as unknown;
    profile = p && typeof p === 'object' ? (p as Record<string, unknown>) : null;
  } catch {
    profile = null;
  }
  const saved = await savedFiles(d, g.listings);
  const localPath = await savedOriginals(d, g.listings);
  const { out, held } = fitOverview({
    g,
    first: !prev,
    changes,
    profile,
    saved,
    localPath,
    folder: d.store.dir,
    ledger,
    format: d.format,
    now: d.now,
  });
  // What the answer had to leave out (a bulk upload) is not recorded: the next call reports it.
  await recordLook(d.store, RECORD, prev, g.world, held, d.token);
  return out;
}

/**
 * The same rule as storeMap's load(), applied to the stored record itself (its stamp and
 * the day it was read), not to when the file was written: a text saved before any listing
 * has no stamp and load() downloads it again, so it is not "saved". The plugin build keeps
 * only plain text.
 */
async function savedFiles(d: OverviewDeps, listings: Gathered['listings']) {
  const stored = new Set((await d.store.list()).map((e) => e.path));
  const kept = new Set<string>();
  for (const f of Object.values(listings).flatMap((l) => l ?? [])) {
    const path = textPath(f.downloadUrl);
    if (!f.modified || !stored.has(path)) continue;
    // From the record's first bytes only: the text of a document can be megabytes.
    if (
      await textIsKept(
        d.store,
        path,
        f.downloadUrl,
        `modified ${f.modified}`,
        d.extractsText !== false
      )
    ) {
      kept.add(f.downloadUrl);
    }
  }
  return (f: { downloadUrl: string }) => kept.has(f.downloadUrl);
}

/**
 * Where each file's original is kept, relative to the store folder, for the files whose bytes
 * are on disk and current for the date the listing shows (storeOriginals.kept). A file that is
 * not kept gets no path: none is ever claimed for a copy that is stale or only in memory.
 */
async function savedOriginals(d: OverviewDeps, listings: Gathered['listings']) {
  const stored = new Set((await d.store.list()).map((e) => e.path));
  const originals = createOriginals(d.store);
  const paths = new Map<string, string>();
  for (const f of Object.values(listings).flatMap((l) => l ?? [])) {
    if (!f.modified || !stored.has(metaPath(f.downloadUrl))) continue;
    const rel = await originals.kept(f.downloadUrl, stampOf(f));
    if (rel) paths.set(f.downloadUrl, rel);
  }
  return (f: { downloadUrl: string }) => paths.get(f.downloadUrl);
}

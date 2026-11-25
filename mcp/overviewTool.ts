// The front door of reIS for Claude (step 3 of the map, docs/superpowers/specs/
// 2026-11-25-reis-for-claude-map-design.md): one call that looks at IS, says what
// is new since it last told Claude, and hands over the map. Not in TOOLS: it needs
// the store and the tool cache, and it is registered first (register.ts).
import type { Store } from './store';
import type { ToolCtx } from './tools';
import { gather, type Run } from './overviewGather';
import { diffWorld } from './overviewDiff';
import { parseSnapshot, snapshotOf } from './overviewRecord';
import { renderOverview } from './overviewRender';
import { readAfterModified, textPath } from './storeMap';

// Why "overview": the failure it fixes is Claude not knowing where to look. The
// description is the only thing a model that has never seen reIS reads before it
// chooses a tool, so it says when to call this and what to do with the answer.
export const OVERVIEW_TOOL = {
  name: 'mendelu_overview',
  title: 'Overview of my school situation, and what changed',
  description:
    'START HERE. Call this FIRST, before any other mendelu_ tool, for any question about the student\'s school situation: how they are doing, their points, what is due, exams, the timetable, what is new, or where something is. One call returns: (1) "changed": what is new in IS since the last time it was called (new, replaced or removed course files, new or changed points, new assignment boxes or deadlines, new exam terms, new subjects), each shown ONCE; (2) the student\'s study programme and form; (3) every enrolled subject with the student\'s points in it and its course files (name, date modified, a `url` to give to mendelu_read_file, and `textSaved: yes` when that file\'s text is already kept on this computer); (4) "upcoming": what is coming, soonest first, with days left and `attendance: yes` for events the student must attend in person (registered exam and credit terms) next to assignment deadlines; tell the student about anything within a week; (5) the open assignments with deadlines, the exam terms and the lessons of the next 7 days. It downloads no file and changes nothing in IS. ' +
    'IMPORTANT: many answers are only inside a course file, not in IS\'s exam list or timetable: a credit-test date, test topics, passing conditions, a reference sheet, a project brief usually sit in a file such as a course schedule ("harmonogram") or conditions PDF. When a question is about such a thing, open the likely files from this map with mendelu_read_file (pass the file\'s `url`) BEFORE saying IS has no answer, and say which file the answer came from. If a subject\'s file list is cut ("N files in all"), call mendelu_subject_files with that code. When the answer depends on the student\'s study form (P = full-time, K = combined), use `student.form` rather than guessing. A subject with no points listed has none in IS yet. If the first line says this is the first overview, there is nothing to compare yet. Pass "json" as response_format only if you need raw data.',
} as const;

/** What the overview last told Claude. Lives in the store, so forget everything removes it. */
export const RECORD = 'overview/seen.json';

type Token = { gen: string | null; at: number };
const isToken = (t: unknown): t is Token => !!t && typeof t === 'object' && 'gen' in t && 'at' in t;

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
};

export async function runOverview(d: OverviewDeps) {
  const prev = parseSnapshot(await d.store.readText(RECORD));
  const g = await gather(d.run, d.ctx, d.now ?? new Date());
  const changes = prev ? diffWorld(prev, g.world) : [];
  // Written only once the look at IS has succeeded, and only if no forget() ran since
  // the call began (the same token every other save of this call carries).
  await d.store
    .write(
      RECORD,
      JSON.stringify(snapshotOf(g.world, prev)),
      isToken(d.token) ? { after: d.token.gen } : {}
    )
    .catch(() => false);
  await d.settled();

  let profile: Record<string, unknown> | null = null;
  try {
    const p = JSON.parse((await d.store.readText('profile.json')) ?? 'null') as unknown;
    profile = p && typeof p === 'object' ? (p as Record<string, unknown>) : null;
  } catch {
    profile = null;
  }
  // The same rule as storeMap's load(): a text is good for a file whose Modifikace is
  // earlier than the day it was read.
  const readAt = new Map((await d.store.list()).map((e) => [e.path, e.at]));
  const saved = (f: { downloadUrl: string; modified?: string }) => {
    const at = readAt.get(textPath(f.downloadUrl));
    return (
      !!at &&
      !!f.modified &&
      readAfterModified(`modified ${f.modified}`, new Date(at).toISOString())
    );
  };
  return renderOverview({ g, first: !prev, changes, profile, saved, format: d.format, now: d.now });
}

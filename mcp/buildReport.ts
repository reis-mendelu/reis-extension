// What mendelu_build_my_map answers: counts per subject, then the files it could not keep and
// why. Kept inside one tool answer (format.ts CHARACTER_LIMIT): long lists are cut and the cut
// is said, never silent.
import type { SubjectFile } from './files';
import { shown } from './forgetTool';

export type Planned = { code: string; file: SubjectFile; stamp: string; kept: boolean };
export type Outcome =
  | { state: 'kept' }
  | { state: 'downloaded'; text: boolean }
  | { state: 'skipped' | 'failed'; reason: string };

/** Most files listed by name under skipped and failed; the rest are counted. */
export const LISTED = 25;

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const size = (b: number) => (b >= GB ? `${(b / GB).toFixed(1)} GB` : `${(b / MB).toFixed(1)} MB`);

/** Up to LISTED entries under `key`, and how many were left out under `moreKey`. */
function capped<T>(items: T[], key: string, moreKey: string, what: string) {
  if (!items.length) return {};
  return {
    [key]: items.slice(0, LISTED),
    ...(items.length > LISTED ? { [moreKey]: `${items.length - LISTED} ${what}` } : {}),
  };
}

/** A file's type as the listing names it: the extension of its own name. */
export const typeOf = (f: SubjectFile) =>
  /\.([A-Za-z0-9]{1,10})$/.exec(f.file ?? '')?.[1]?.toLowerCase() ?? 'no extension';

const labelOf = (f: SubjectFile) => f.file || f.name;

/** Every subject in `codes`, in order, with its files; a subject with none keeps an empty row. */
function bySubject(planned: Planned[], codes: string[] = []) {
  const out = new Map<string, Planned[]>(codes.map((c) => [c, []]));
  for (const p of planned) out.set(p.code, [...(out.get(p.code) ?? []), p]);
  return out;
}

const typeLine = (rows: Planned[]) => {
  if (!rows.length) return 'no files';
  const counts = new Map<string, number>();
  for (const p of rows) counts.set(typeOf(p.file), (counts.get(typeOf(p.file)) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t, n]) => `${t} ${n}`)
    .join(', ');
};

export function dryReport(
  planned: Planned[],
  problems: string[],
  budget: { max: number; used: number },
  codes: string[] = []
) {
  const saved = planned.filter((p) => p.kept).length;
  return {
    dryRun: true,
    note: 'Nothing was downloaded. IS lists no file sizes, so the total size is UNKNOWN until the files are downloaded, and reIS makes no extra requests to learn it. To build the map, call mendelu_build_my_map again with dry_run: false: it downloads only the files not already saved, and stops at the byte budget.',
    totalSize: 'UNKNOWN (IS lists no sizes)',
    files: planned.length,
    alreadySaved: saved,
    toDownload: planned.length - saved,
    budget: `${size(budget.used)} used of ${size(budget.max)}`,
    ...capped(
      [...bySubject(planned, codes)].map(([code, rows]) => ({
        code,
        files: rows.length,
        alreadySaved: rows.filter((p) => p.kept).length,
        types: typeLine(rows),
      })),
      'subjects',
      'moreSubjects',
      'more subjects, counted in the totals above'
    ),
    ...capped(problems, 'problems', 'moreProblems', 'more problems'),
  };
}

export function buildReport(
  planned: Planned[],
  outcomes: Map<Planned, Outcome>,
  problems: string[],
  codes: string[],
  run: { max: number; used: number; stoppedAtBudget: boolean; forgotten: boolean; folder: string }
) {
  const state = (p: Planned) => outcomes.get(p)?.state ?? 'kept';
  const count = (rows: Planned[], s: Outcome['state']) => rows.filter((p) => state(p) === s).length;
  const listOf = (s: 'skipped' | 'failed') =>
    planned
      .filter((p) => state(p) === s)
      .map((p) => {
        const o = outcomes.get(p) as { reason: string };
        return { code: p.code, file: labelOf(p.file), reason: o.reason };
      });
  const skipped = listOf('skipped');
  const failed = listOf('failed');
  const textSaved = planned.filter((p) => {
    const o = outcomes.get(p);
    return o?.state === 'downloaded' && o.text;
  }).length;
  const downloaded = count(planned, 'downloaded');
  const why = run.forgotten
    ? ' It stopped because everything reIS saved was forgotten while it ran; nothing from this run was kept after that.'
    : run.stoppedAtBudget
      ? ` It stopped at the byte budget (${size(run.max)}): the files under "skipped" were not downloaded.`
      : '';
  return {
    dryRun: false,
    note: `Downloaded ${downloaded} file(s); ${count(planned, 'kept')} were already saved and unchanged, so they were not downloaded again.${why} Saved files are listed with a localPath by mendelu_overview; they are inside the folder below.`,
    folder: shown(run.folder),
    downloaded,
    alreadySaved: count(planned, 'kept'),
    textSaved,
    skipped: skipped.length,
    failed: failed.length,
    stoppedAtBudget: run.stoppedAtBudget,
    stored: `${size(run.used)} of ${size(run.max)}`,
    ...capped(
      [...bySubject(planned, codes)].map(([code, rows]) => ({
        code,
        files: rows.length,
        saved: count(rows, 'kept') + count(rows, 'downloaded'),
        downloaded: count(rows, 'downloaded'),
        skipped: count(rows, 'skipped'),
        failed: count(rows, 'failed'),
      })),
      'subjects',
      'moreSubjects',
      'more subjects, counted in the totals above'
    ),
    skippedFiles: skipped.length ? skipped.slice(0, LISTED) : undefined,
    moreSkipped: skipped.length > LISTED ? `${skipped.length - LISTED} more skipped` : undefined,
    failedFiles: failed.length ? failed.slice(0, LISTED) : undefined,
    moreFailed:
      failed.length > LISTED
        ? `${failed.length - LISTED} more failed; run mendelu_build_my_map again to retry them`
        : undefined,
    ...capped(problems, 'problems', 'moreProblems', 'more problems'),
  };
}

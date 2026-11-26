// What mendelu_refresh answers, kept inside one tool answer (format.ts CHARACTER_LIMIT): what
// changed since the last refresh, what happened to each download, the ledger entries to recheck
// and the next 14 days. When the changed files do not fit, the ones left out are `held`: the
// caller does not record them, so the next refresh reports them. Never a silent cut.
import { CHARACTER_LIMIT } from './format';
import { toMarkdown } from './markdown';
import type { Change } from './overviewDiff';
import type { Stop } from './buildDownload';
import { SOON_DAYS, type Upcoming } from './overviewUpcoming';
import { shown } from './forgetTool';

export type FileRow = {
  code: string;
  file: string;
  what: string;
  modified?: string;
  url?: string;
  /** downloaded, already saved, or why not; none for a file gone from IS. */
  outcome?: string;
};

export type RefreshInput = {
  first: boolean;
  /** No refresh record yet: compared with what the overview last reported. */
  borrowed: boolean;
  since?: unknown;
  changes: Change[];
  rows: { change: Change; row: FileRow }[];
  counts: { downloaded: number; alreadySaved: number; skipped: number; failed: number };
  stop: Stop;
  budget: { max: number; used: number };
  recheck: { id: string; code: string; title: string; when: string; reason: string }[];
  upcoming: Upcoming[];
  problems: string[];
  folder: string;
  format: 'markdown' | 'json';
};

const LINES = 40;
const MB = 1024 ** 2;
const size = (b: number) =>
  b >= 1024 * MB ? `${(b / 1024 / MB).toFixed(1)} GB` : `${(b / MB).toFixed(1)} MB`;

const some = <T>(xs: T[]) => (xs.length ? xs : undefined);

const NEVER =
  "This refresh only read IS and wrote reIS's own folder: it sent no mail and wrote no calendar.";

/** How much of each list one answer shows; tried in turn, largest first, until the answer fits. */
type Level = { lines: number; upcoming: number; recheck: number };
const LEVELS: Level[] = [
  { lines: LINES, upcoming: 30, recheck: 30 },
  { lines: 20, upcoming: 15, recheck: 15 },
  { lines: 10, upcoming: 8, recheck: 8 },
  { lines: 5, upcoming: 4, recheck: 4 },
  { lines: 2, upcoming: 2, recheck: 2 },
  { lines: 0, upcoming: 0, recheck: 0 },
];
/** Points rows, assignment boxes and exam terms: a change left out is held and comes next time. */
const HELD_KINDS = ['points', 'box', 'exam', 'subject'] as const;

function build(input: RefreshInput, rows: FileRow[], omitted: number, lvl: Level) {
  const held: Change[] = [];
  const of = (kind: Change['kind']) => {
    const all = input.changes.filter((c) => c.kind === kind);
    const shownLines = all.slice(0, lvl.lines).map((c) => c.text);
    const left = all.length - shownLines.length;
    if (!left) return some(shownLines);
    if ((HELD_KINDS as readonly string[]).includes(kind)) {
      held.push(...all.slice(lvl.lines));
      return [
        ...shownLines,
        `${left} more do not fit in this answer: the next mendelu_refresh reports them`,
      ];
    }
    // Ledger lines: every entry they name is in "recheck" (or mendelu_ledger list) as well.
    return [...shownLines, `${left} more: see recheck, or mendelu_ledger (action list)`];
  };
  const allSubjects = input.changes.filter((c) => c.kind === 'subject');
  const subjectLines = allSubjects
    .slice(0, lvl.lines)
    .map((c) =>
      c.text.startsWith('New subject')
        ? `${c.text} (its files are not downloaded by a refresh: call mendelu_build_my_map)`
        : c.text
    );
  if (allSubjects.length > subjectLines.length) {
    held.push(...allSubjects.slice(lvl.lines));
    subjectLines.push(
      `${allSubjects.length - subjectLines.length} more subject changes do not fit in this answer: the next mendelu_refresh reports them`
    );
  }
  const subjects = some(subjectLines);
  const changed = {
    subjects,
    files: some(rows),
    moreFiles: omitted
      ? `${omitted} more changed file(s) do not fit in this answer: the next mendelu_refresh reports the new and replaced ones again`
      : undefined,
    points: of('points'),
    assignments: of('box'),
    exams: of('exam'),
    ledger: of('ledger'),
  };
  const any = Object.values(changed).some(Boolean);
  const { downloaded, skipped, failed } = input.counts;
  const since = typeof input.since === 'string' ? input.since : undefined;
  const head = input.first
    ? 'First refresh on this computer: this look is the baseline, so nothing is compared and nothing was downloaded. From the next refresh on, "changed" lists what is new since this one, and new or replaced files of subjects already known are downloaded. To save every course file now, call mendelu_build_my_map.'
    : `${any ? `${input.changes.length} change(s) in IS` : 'Nothing changed in IS'} since ${input.borrowed ? 'what mendelu_overview last reported (no earlier refresh on this computer)' : `the last refresh${since ? ` (${since})` : ''}`}. Downloaded ${downloaded} file(s)${skipped ? `, skipped ${skipped}` : ''}${failed ? `, ${failed} failed` : ''}.${input.stop === 'budget' ? ` It stopped at the byte budget (${size(input.budget.max)}): skipped files come again with the next refresh.` : ''}${input.stop === 'forgotten' ? ' Everything reIS saved was forgotten while it ran, so nothing more was kept.' : ''}`;
  const near = input.upcoming.filter((u) => u.daysLeft <= SOON_DAYS);
  const later = input.upcoming.length - near.length;
  const nearLeft = Math.max(0, near.length - lvl.upcoming);
  const recheckLeft = Math.max(0, input.recheck.length - lvl.recheck);
  const problems = input.problems.slice(0, Math.max(lvl.lines, 3));
  const out = {
    note: `${head} Read new or replaced harmonogram, conditions or brief files with mendelu_read_file (pass the url) and save every date they state with mendelu_ledger. ${NEVER}`,
    first: input.first || undefined,
    since: input.first ? undefined : (since ?? (input.borrowed ? 'last overview' : undefined)),
    changed: any ? changed : undefined,
    ...input.counts,
    stoppedAtBudget: input.stop === 'budget',
    stored: `${size(input.budget.used)} of ${size(input.budget.max)}`,
    folder: shown(input.folder),
    recheck: some(input.recheck.slice(0, lvl.recheck)),
    moreRecheck: recheckLeft
      ? `${recheckLeft} more ledger entries to recheck do not fit here: mendelu_ledger (action list) lists them all`
      : undefined,
    upcoming: some(near.slice(0, lvl.upcoming)),
    moreUpcoming:
      nearLeft || later
        ? `${nearLeft} more in the next ${SOON_DAYS} days${nearLeft ? ' do not fit here' : ''} and ${later} later: mendelu_ledger (action list) and mendelu_overview list them`
        : undefined,
    problems: some(problems),
    moreProblems:
      input.problems.length > problems.length
        ? `${input.problems.length - problems.length} more problems`
        : undefined,
  };
  return { out, held };
}

/**
 * The answer, and the changes it left out (`held`), which the caller must not record as reported.
 * File rows go first (kept whole while they fit), then every other list shrinks a level at a time.
 */
export function fitRefresh(input: RefreshInput): { out: object; held: Change[] } {
  const sizeOf = (o: object) =>
    input.format === 'json' ? JSON.stringify(o, null, 2).length : toMarkdown(o).length;
  const small = (o: object) => sizeOf(o) <= CHARACTER_LIMIT - 300;
  const lean = (k: number, lvl: Level) => {
    const kept = input.rows.slice(0, k);
    const { out, held } = build(
      input,
      kept.map((r) => r.row),
      input.rows.length - k,
      lvl
    );
    const cut = input.rows
      .slice(k)
      .map((r) => r.change)
      .filter((c) => c.url);
    return { out, held: [...cut, ...held] };
  };
  const n = input.rows.length;
  if (small(lean(n, LEVELS[0]!).out)) return lean(n, LEVELS[0]!);
  const lvl = LEVELS.find((l) => small(lean(0, l).out));
  // Never hand back an answer that would be cut mid-text; the caller records nothing then.
  if (!lvl)
    throw new Error(
      'The refresh report does not fit in one answer even at its smallest. Nothing was recorded; try again.'
    );
  let [lo, hi] = [0, n];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (small(lean(mid, lvl).out)) lo = mid;
    else hi = mid - 1;
  }
  return lean(lo, lvl);
}

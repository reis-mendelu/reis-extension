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

/** At most LINES lines, the rest counted in one more line. */
const capped = (lines: string[]) =>
  lines.length > LINES
    ? [...lines.slice(0, LINES), `and ${lines.length - LINES} more like these`]
    : lines;
const some = <T>(xs: T[]) => (xs.length ? xs : undefined);

const NEVER =
  "This refresh only read IS and wrote reIS's own folder: it sent no mail and wrote no calendar.";

function build(input: RefreshInput, rows: FileRow[], omitted: number) {
  const of = (kind: Change['kind']) =>
    some(capped(input.changes.filter((c) => c.kind === kind).map((c) => c.text)));
  const subjects = some(
    capped(
      input.changes
        .filter((c) => c.kind === 'subject')
        .map((c) =>
          c.text.startsWith('New subject')
            ? `${c.text} (its files are not downloaded by a refresh: call mendelu_build_my_map)`
            : c.text
        )
    )
  );
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
  return {
    note: `${head} Read new or replaced harmonogram, conditions or brief files with mendelu_read_file (pass the url) and save every date they state with mendelu_ledger. ${NEVER}`,
    first: input.first || undefined,
    since: input.first ? undefined : (since ?? (input.borrowed ? 'last overview' : undefined)),
    changed: any ? changed : undefined,
    ...input.counts,
    stoppedAtBudget: input.stop === 'budget',
    stored: `${size(input.budget.used)} of ${size(input.budget.max)}`,
    folder: shown(input.folder),
    recheck: some(input.recheck.slice(0, 30)),
    moreRecheck:
      input.recheck.length > 30
        ? `${input.recheck.length - 30} more: mendelu_ledger (action list)`
        : undefined,
    upcoming: some(near.slice(0, 30)),
    moreUpcoming:
      near.length > 30 || input.upcoming.length > near.length
        ? `${Math.max(0, near.length - 30)} more in the next ${SOON_DAYS} days and ${input.upcoming.length - near.length} later: mendelu_ledger (action list), mendelu_overview`
        : undefined,
    problems: some(capped(input.problems)),
  };
}

export function fitRefresh(input: RefreshInput): { out: object; held: Change[] } {
  const sizeOf = (o: object) =>
    input.format === 'json' ? JSON.stringify(o, null, 2).length : toMarkdown(o).length;
  const small = (o: object) => sizeOf(o) <= CHARACTER_LIMIT - 300;
  const lean = (k: number) => {
    const kept = input.rows.slice(0, k);
    const out = build(
      input,
      kept.map((r) => r.row),
      input.rows.length - k
    );
    const held = input.rows
      .slice(k)
      .map((r) => r.change)
      .filter((c) => c.url);
    return { out, held };
  };
  if (small(lean(input.rows.length).out)) return lean(input.rows.length);
  let [lo, hi] = [0, input.rows.length];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (small(lean(mid).out)) lo = mid;
    else hi = mid - 1;
  }
  return lean(lo);
}

// The map as the overview hands it to Claude, kept inside what one answer can
// carry (format.ts CHARACTER_LIMIT). When it does not fit, whole file lists are
// replaced by a pointer and the cut is said in the answer: never a silent
// truncation. A change is reported once; only a bulk upload too big for one answer is
// split across calls (fitOverview's `held`), and what is held is not recorded as reported.
import { CHARACTER_LIMIT } from './format';
import { toMarkdown } from './markdown';
import { changeLines, type Change } from './overviewDiff';
import type { Gathered } from './overviewGather';
import type { SubjectFile } from './files';
import { deadlineKey, fileRows, shownExams, student } from './overviewRows';
import { upcomingItems } from './overviewUpcoming';
import type { LedgerEntry } from './ledgerEntry';

export type RenderInput = {
  g: Gathered;
  /** No record of an earlier overview: everything is the map, nothing is "changed". */
  first: boolean;
  changes: Change[];
  profile: Record<string, unknown> | null;
  /** Whether mendelu_read_file would answer from the store without downloading. */
  saved: (f: SubjectFile) => boolean;
  /** Where the file's original is kept, relative to `folder`; undefined when it is not. */
  localPath?: (f: SubjectFile) => string | undefined;
  /** The store folder, absolute: named once, so each file's path stays short. */
  folder?: string;
  format: 'markdown' | 'json';
  now?: Date;
  /** Changed files this answer leaves out (see fitOverview): said in the note, never silent. */
  omitted?: number;
  /** Most open assignments listed, the last resort when long names still overflow (see fitOverview). */
  assignments?: number;
  /** The events Claude saved in the ledger (ledgerTool.ts): merged into "upcoming". */
  ledger?: LedgerEntry[];
  /** Most upcoming items listed, the last resort after the assignments (see fitOverview). */
  upcomingShown?: number;
};

/** The largest file list shown whole, tried in turn until the answer fits. */
const CAPS = [Infinity, 30, 20, 12, 8, 5, 3, 1, 0];

/** `whole(code, n)`: whether a subject's n files are all listed or replaced by a pointer. */
type Whole = (code: string, n: number) => boolean;

/** `keep`: most rows a cut list still shows; changed files always, then saved ones. */
function build(input: RenderInput, whole: Whole, marks: Map<string, string>, keep = Infinity) {
  const { g } = input;
  const subjects = g.subjects.map((s) => {
    const files = g.listings[s.code];
    const points = g.world.points[s.code];
    let shown: ReturnType<typeof fileRows> | undefined;
    let more: string | undefined;
    if (files) {
      const rows = fileRows(files, marks, input.saved, input.localPath);
      if (whole(s.code, rows.length)) shown = rows;
      else {
        // Too many to list here: keep the ones that matter now, point to the rest. Saved files
        // only up to the cap: after mendelu_build_my_map every file is saved.
        const saved = rows.filter((r) => !r.changed && (r.textSaved || r.localPath));
        const kept = new Set([
          ...rows.filter((r) => r.changed),
          ...saved.slice(0, Math.max(0, keep - rows.filter((r) => r.changed).length)),
        ]);
        shown = rows.filter((r) => kept.has(r));
        more = `${files.length} files in all (${shown.length} shown): call mendelu_subject_files with code ${s.code} for the full list`;
      }
    }
    return {
      code: s.code,
      name: s.name,
      subjectId: s.subjectId,
      points: points
        ? points.length
          ? points.map((p) => (p.key.startsWith('test /') ? p.text : `${p.key}: ${p.text}`))
          : 'none in IS yet'
        : 'could not be read (see problems)',
      files: shown,
      moreFiles: more,
      ...(files ? {} : { filesNote: 'could not be read (see problems)' }),
    };
  });

  const open = (g.boxes ?? [])
    .filter((b) => b.open)
    .sort((a, b) => deadlineKey(a.deadline).localeCompare(deadlineKey(b.deadline)))
    .map((b) => ({
      code: b.code,
      name: b.name,
      deadline: b.deadline,
      state: b.submission,
      points: b.points,
    }));
  const closed = (g.boxes ?? []).length - open.length;
  const anyPath = subjects.some((s) => s.files?.some((r) => r.localPath));
  const listed = open.slice(0, input.assignments ?? open.length);

  const { exams, hidden } = shownExams(g.exams ?? []);

  const upcoming = upcomingItems(
    g.boxes,
    g.exams,
    input.now ?? new Date(),
    input.ledger?.length ? { entries: input.ledger, listings: g.listings } : undefined,
    input.upcomingShown
  );
  const lines = input.first ? [] : changeLines(input.changes);
  const note = input.first
    ? 'First overview on this computer, so this is the whole map and there is nothing to compare it with. From the next call on, "changed" lists what is new since this one.'
    : lines.length
      ? `${input.changes.length} change(s) in IS since the last overview. They are listed once under "changed" and will not be repeated.`
      : 'Nothing changed in IS since the last overview.';
  const noted = input.omitted
    ? `${note} ${input.omitted} more changed file(s) do not fit in this answer: they come with the next call to mendelu_overview.`
    : note;

  return {
    note: noted,
    changed: lines.length ? lines : undefined,
    problems: g.problems.length ? g.problems : undefined,
    student: student(input.profile),
    savedFiles:
      anyPath && input.folder
        ? `Each file with a localPath is saved on this computer: its full path is ${input.folder} joined with its localPath.`
        : undefined,
    upcoming: upcoming.items.length ? upcoming.items : undefined,
    moreUpcoming: upcoming.more
      ? `${upcoming.more} more, later: see openAssignments, exams and mendelu_ledger (action list)`
      : undefined,
    subjects,
    openAssignments: listed.length ? listed : undefined,
    moreAssignments:
      listed.length < open.length
        ? `${open.length - listed.length} more open: call mendelu_assignments`
        : undefined,
    closedAssignments:
      closed > 0 ? `${closed} closed (call mendelu_assignments to see them)` : undefined,
    exams: exams.length ? exams : undefined,
    moreExamTerms: hidden ? `${hidden} more open terms: call mendelu_exams` : undefined,
    nextSevenDays: g.week?.length ? g.week : g.week ? 'no lessons' : undefined,
  };
}

const sizeOf = (o: object, format: RenderInput['format']) =>
  format === 'json' ? JSON.stringify(o, null, 2).length : toMarkdown(o).length;

const marksOf = (changes: Change[]) =>
  new Map(changes.flatMap((c) => (c.url && c.what ? [[c.url, c.what] as const] : [])));

export const renderOverview = (input: RenderInput) => fitOverview(input).out;

/**
 * The answer, and the changed files it had to leave out (`held`), which the caller must not
 * record as reported: they are listed with the next overview instead.
 */
export function fitOverview(input: RenderInput): { out: object; held: Change[] } {
  const marks = marksOf(input.changes);
  // Room for the cut marker format.ts would add if it still did not fit.
  const small = (o: object) => sizeOf(o, input.format) <= CHARACTER_LIMIT - 300;
  const fits = (whole: Whole, keep: number) => {
    const out = build(input, whole, marks, keep);
    return small(out) ? out : null;
  };
  const cap = CAPS.find((c) => fits((_, n) => n <= c, c)) ?? 0;
  const expanded = new Set<string>();
  const whole: Whole = (code, n) => n <= cap || expanded.has(code);
  // The cap cuts the longest lists first; with room left over, give them back smallest first.
  const left = Object.entries(input.g.listings)
    .filter(([, f]) => f && f.length > cap)
    .sort((a, b) => a[1]!.length - b[1]!.length);
  for (const [code] of left) {
    expanded.add(code);
    if (!fits(whole, cap)) expanded.delete(code);
  }
  const best = fits(whole, cap);
  if (best) return { out: best, held: [] };
  // Nothing fits even with every list cut: keep only the files that changed, as many as fit.
  // The rest are held back, so a bulk upload is reported over several calls, not cut off.
  const rowed = input.changes.filter((c) => c.url && c.what);
  const isRowed = new Set(rowed);
  type Bound = { assignments?: number; upcomingShown?: number };
  const lean = (k: number, bound: Bound) => {
    const kept = new Set(rowed.slice(0, k));
    const changes = input.changes.filter((c) => !isRowed.has(c) || kept.has(c));
    const omitted = rowed.length - k;
    const out = build(
      { ...input, changes, saved: () => false, localPath: undefined, omitted, ...bound },
      (_, n) => n <= 0,
      marksOf(changes)
    );
    return { out, held: rowed.slice(k) };
  };
  // Long assignment names can still overflow with every file row held back: bound them too, and
  // only after them the upcoming list, which is the more important of the two.
  const steps: Bound[] = [
    ...[Infinity, 20, 10, 5, 3, 1, 0].map((assignments) => ({ assignments })),
    ...[10, 5, 3, 1, 0].map((upcomingShown) => ({ assignments: 0, upcomingShown })),
  ];
  const bound = steps.find((b) => small(lean(0, b).out)) ?? steps[steps.length - 1]!;
  let [lo, hi] = [0, rowed.length];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (small(lean(mid, bound).out)) lo = mid;
    else hi = mid - 1;
  }
  return lean(lo, bound);
}

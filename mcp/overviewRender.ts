// The map as the overview hands it to Claude, kept inside what one answer can
// carry (format.ts CHARACTER_LIMIT). When it does not fit, whole file lists are
// replaced by a pointer and the cut is said in the answer: never a silent
// truncation, and never of the changes, which are reported only once.
import { CHARACTER_LIMIT } from './format';
import { toMarkdown } from './markdown';
import { changeLines, type Change } from './overviewDiff';
import { labelOf, modifiedOf, type Gathered } from './overviewGather';
import type { SubjectFile } from './files';
import { upcomingItems } from './overviewUpcoming';

export type RenderInput = {
  g: Gathered;
  /** No record of an earlier overview: everything is the map, nothing is "changed". */
  first: boolean;
  changes: Change[];
  profile: Record<string, unknown> | null;
  /** Whether mendelu_read_file would answer from the store without downloading. */
  saved: (f: SubjectFile) => boolean;
  format: 'markdown' | 'json';
  now?: Date;
};

const FORMS: Record<string, string> = {
  P: 'P (prezenční, full-time)',
  K: 'K (kombinované, combined)',
};
const SHOWN_TERMS = 6;
/** The largest file list shown whole, tried in turn until the answer fits. */
const CAPS = [Infinity, 30, 20, 12, 8, 5, 3, 1, 0];

const deadlineKey = (d: string) => {
  const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(d);
  return m
    ? `${m[3]}${m[2]!.padStart(2, '0')}${m[1]!.padStart(2, '0')}${(m[4] ?? '0').padStart(2, '0')}${m[5] ?? '00'}`
    : '9';
};

function student(profile: RenderInput['profile']) {
  if (!profile) return undefined;
  const form = typeof profile.studyForm === 'string' ? profile.studyForm : '';
  return {
    programme: profile.studyProgram,
    form: form ? (FORMS[form] ?? form) : undefined,
    year: profile.studyYear,
    semester: profile.studySemester,
    faculty: profile.facultyLabel,
    period: profile.periodLabel,
  };
}

function fileRows(files: SubjectFile[], marks: Map<string, string>, input: RenderInput) {
  return files.map((f) => {
    const label = labelOf(f);
    return {
      file: label,
      // The document's own title, only when it says more than the file's name.
      ...(f.name && f.name !== label.replace(/\.[^.]+$/, '') ? { title: f.name } : {}),
      modified: modifiedOf(f),
      ...(input.saved(f) ? { textSaved: 'yes' } : {}),
      ...(marks.has(f.downloadUrl) ? { changed: marks.get(f.downloadUrl) } : {}),
      url: f.downloadUrl,
    };
  });
}

/** `whole(code, n)`: whether a subject's n files are all listed or replaced by a pointer. */
type Whole = (code: string, n: number) => boolean;

function build(input: RenderInput, whole: Whole, marks: Map<string, string>) {
  const { g } = input;
  const subjects = g.subjects.map((s) => {
    const files = g.listings[s.code];
    const points = g.world.points[s.code];
    let shown: ReturnType<typeof fileRows> | undefined;
    let more: string | undefined;
    if (files) {
      const rows = fileRows(files, marks, input);
      if (whole(s.code, rows.length)) shown = rows;
      else {
        // Too many to list here: keep the ones that matter now, point to the rest.
        shown = rows.filter((r) => r.changed || r.textSaved);
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

  const terms = new Map<string, number>();
  let hidden = 0;
  const exams = (g.exams ?? [])
    .filter((e) => {
      if (e.state === 'registered') return true;
      const k = `${e.code}|${e.section}`;
      const n = (terms.get(k) ?? 0) + 1;
      terms.set(k, n);
      if (n <= SHOWN_TERMS) return true;
      hidden++;
      return false;
    })
    .map(({ code, section, state, date, time, room }) => ({
      code,
      section,
      state,
      date,
      time,
      room,
    }));

  const upcoming = upcomingItems(g.boxes, g.exams, input.now ?? new Date());
  const lines = input.first ? [] : changeLines(input.changes);
  const note = input.first
    ? 'First overview on this computer, so this is the whole map and there is nothing to compare it with. From the next call on, "changed" lists what is new since this one.'
    : lines.length
      ? `${input.changes.length} change(s) in IS since the last overview. They are listed once under "changed" and will not be repeated.`
      : 'Nothing changed in IS since the last overview.';

  return {
    note,
    changed: lines.length ? lines : undefined,
    problems: g.problems.length ? g.problems : undefined,
    student: student(input.profile),
    upcoming: upcoming.items.length ? upcoming.items : undefined,
    moreUpcoming: upcoming.more
      ? `${upcoming.more} more, later: see openAssignments and exams`
      : undefined,
    subjects,
    openAssignments: open.length ? open : undefined,
    closedAssignments:
      closed > 0 ? `${closed} closed (call mendelu_assignments to see them)` : undefined,
    exams: exams.length ? exams : undefined,
    moreExamTerms: hidden ? `${hidden} more open terms: call mendelu_exams` : undefined,
    nextSevenDays: g.week?.length ? g.week : g.week ? 'no lessons' : undefined,
  };
}

const sizeOf = (o: object, format: RenderInput['format']) =>
  format === 'json' ? JSON.stringify(o, null, 2).length : toMarkdown(o).length;

export function renderOverview(input: RenderInput) {
  const marks = new Map<string, string>();
  for (const c of input.changes) if (c.url && c.what) marks.set(c.url, c.what);
  // Room for the cut marker format.ts would add if it still did not fit.
  const fits = (whole: Whole) => {
    const out = build(input, whole, marks);
    return sizeOf(out, input.format) <= CHARACTER_LIMIT - 300 ? out : null;
  };
  const cap = CAPS.find((c) => fits((_, n) => n <= c)) ?? 0;
  const expanded = new Set<string>();
  const whole: Whole = (code, n) => n <= cap || expanded.has(code);
  // The cap cuts the longest lists first; with room left over, give them back smallest first.
  const left = Object.entries(input.g.listings)
    .filter(([, f]) => f && f.length > cap)
    .sort((a, b) => a[1]!.length - b[1]!.length);
  for (const [code] of left) {
    expanded.add(code);
    if (!fits(whole)) expanded.delete(code);
  }
  // Nothing fits even with every list cut: keep only the files that changed.
  return fits(whole) ?? build({ ...input, saved: () => false }, (_, n) => n <= 0, marks);
}

// Traces of a sync that got an ANSWER but an empty one. Not errors: "no exams"
// is the normal answer outside exam season, and IS answers it without a
// failure. But when a student reports an empty list, these lines are the only
// thing that can say why it was empty (suggestions 41 and 42, November 2026,
// arrived with `entries: []`).
//
// Shapes and counts only. Never a name, a subject code, an id, a grade or a
// page's text — and never the studium/obdobi values, only whether they exist.
//
// Imports only `diagnosticLog`, which imports nothing: the sync runs in the
// content script on the extension (contentScriptGraph.test.ts).

import { recordDiagnostic } from './diagnosticLog';

const said = new Set<string>();

/**
 * Records a warning once per session per distinct line. Exams are fetched on
 * every run; a line per run would fill the 50-entry log and push out the real
 * errors it exists to keep.
 */
export function traceOnce(ctx: string, msg: string): void {
  const key = `${ctx}\u0000${msg}`;
  if (said.has(key)) return;
  said.add(key);
  recordDiagnostic({ level: 'warn', ctx, msg });
}

/** Tests only. */
export function resetSyncTraces(): void {
  said.clear();
}

const has = (v: unknown) => (v ? 'present' : 'absent');
const yn = (v: boolean) => (v ? 'yes' : 'no');

/** What the sync asked IS with: whether the ids exist, never their values. */
export function askedWith(p: { studium?: string; obdobi?: string } | null | undefined): string {
  return `study id ${has(p?.studium)} · period ${has(p?.obdobi)}`;
}

export interface SubjectsPageShapeLike {
  tables: number;
  table: boolean;
  rows: number;
  syllabusLinks: number;
  folderLinks: number;
  signedIn: boolean;
}

/**
 * Subjects: traced when the list is empty, or when IS's table had more rows
 * than the list kept — the parser takes a row only when it has BOTH a syllabus
 * and a folder link, so that gap is where subjects silently go missing.
 */
export function traceSubjectsAnswer(
  parsed: number,
  shape: SubjectsPageShapeLike | undefined,
  periods: number,
  params: { studium?: string; obdobi?: string } | null | undefined
): void {
  if (parsed > 0 && !(shape && shape.rows > parsed)) return;
  const page = shape
    ? ` from ${shape.rows} rows · tables ${shape.tables} · tmtab_1 ${yn(shape.table)}` +
      ` · syllabus links ${shape.syllabusLinks} · folder links ${shape.folderLinks}` +
      ` · signed in ${yn(shape.signedIn)}`
    : '';
  traceOnce(
    'Sync.subjects',
    `IS answered, ${parsed} subjects${page} · ${askedWith(params)} · ${periods} periods`
  );
}

export function traceExamsAnswer(
  count: number,
  params: { studium?: string; obdobi?: string } | null | undefined
): void {
  if (count > 0) return;
  traceOnce('Sync.exams', `IS answered, 0 exams · ${askedWith(params)}`);
}

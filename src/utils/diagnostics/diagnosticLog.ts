// The session's recent errors and warnings, held in memory so a student can
// choose to attach them to a report (FeedbackModal → "Přiložit technické
// údaje"). Nothing here transmits anything; the report form is the only reader
// that sends, and only when the student ticks the box and presses Send.
//
// THIS FILE IMPORTS NOTHING, and must keep it that way. `logError` feeds it,
// `logError` is imported by essentially every module, and that includes the
// content script, which runs at `document_start`. A dependency pulled in here
// is a dependency of the content script — the sonner crash in #266 got in
// exactly that way. scripts/lib/__tests__/contentScriptGraph.test.ts enforces it.
//
// A module-level array rather than a Zustand slice, which is otherwise the rule:
// the content script has no store, and this is not UI state.
//
// Cleaning happens at RECORD time, not at send time, so a raw message — an IS
// URL with studium=, a note's file name, a coordinate — is never held at all.

export type DiagnosticSource = 'app' | 'content';

export interface DiagnosticEntry {
  t: number;
  level: 'error' | 'warn';
  source: DiagnosticSource;
  /** logError's context ("Api.fetchExams"); null for a raw console call. */
  ctx: string | null;
  status?: number;
  msg: string;
}

export const DIAGNOSTIC_CAP = 50;
const MSG_MAX = 200;

let source: DiagnosticSource = 'app';
let entries: DiagnosticEntry[] = [];
let insideLogError = false;

export function setDiagnosticSource(s: DiagnosticSource): void {
  source = s;
}

/**
 * Order matters: URLs first (their query holds the ids), then emails, then
 * decimals (a coordinate would otherwise survive as `49.‹#›`), then long digit
 * runs — IS student, person and file ids are 5–7 digits, HTTP statuses 3.
 */
export function cleanMessage(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw);
  const firstLine = text.split('\n', 1)[0] ?? '';
  return firstLine
    .replace(/\b(https?:\/\/[^\s?#"'<>]*)[?#][^\s"'<>]*/gi, '$1')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '‹email›')
    .replace(/\d+\.\d{3,}/g, '‹n›')
    .replace(/\d{5,}/g, '‹#›')
    .slice(0, MSG_MAX);
}

export function recordDiagnostic(e: {
  level: 'error' | 'warn';
  ctx: string | null;
  msg: unknown;
  status?: number;
}): void {
  const entry: DiagnosticEntry = {
    t: Date.now(),
    level: e.level,
    source,
    ctx: e.ctx === null ? null : cleanMessage(e.ctx),
    msg: cleanMessage(e.msg),
  };
  if (typeof e.status === 'number') entry.status = e.status;
  entries.push(entry);
  if (entries.length > DIAGNOSTIC_CAP) entries = entries.slice(-DIAGNOSTIC_CAP);
}

/** Oldest first. A copy, so a caller pruning lines for a preview cannot edit the log. */
export function getDiagnostics(): DiagnosticEntry[] {
  return entries.slice();
}

export function clearDiagnostics(): void {
  entries = [];
}

/**
 * logError records a structured entry and THEN calls console.error. Running
 * that console call inside this marks it, so the console wrapper does not
 * record the same failure a second time with less information.
 */
export function asLogErrorConsoleCall(fn: () => void): void {
  insideLogError = true;
  try {
    fn();
  } finally {
    insideLogError = false;
  }
}

export function isInsideLogError(): boolean {
  return insideLogError;
}

// One entry of the upcoming-events ledger (decision 9 of the map, docs/superpowers/specs/
// 2026-11-25-reis-for-claude-map-ledger.md): what a dated event is, and the one place its
// fields are checked. Claude writes entries (reIS extracts nothing and has no model), so
// everything arriving here is untrusted text: strict types, real calendar dates, bounded
// lengths. The same check runs on what is read back from disk, so a damaged or hand-edited
// file is skipped, never trusted.

export const KINDS = [
  'test',
  'credit_test',
  'defence',
  'resit',
  'programme_day',
  'event',
  'unregister_deadline',
  'other',
] as const;
export type Kind = (typeof KINDS)[number];

/** Where the date came from. Only what reIS itself read from IS is "is". */
export const SOURCES = ['is', 'course_file', 'mail', 'calendar', 'student'] as const;
export type SourceKind = (typeof SOURCES)[number];

/** Kinds the student has to attend in person unless Claude says otherwise. */
const ATTEND: Kind[] = ['test', 'credit_test', 'defence', 'resit', 'programme_day'];

export type LedgerEntry = {
  id: string;
  title: string;
  kind: Kind;
  /** Subject code, e.g. EBC-PE; absent for an event that belongs to no subject. */
  code?: string;
  /** YYYY-MM-DD, Prague time. */
  date: string;
  /** HH:MM; absent when the file gives a day only. */
  time?: string;
  /** Last day of a window (a several-day programme, or "in the 12th week"); absent for one day. */
  until?: string;
  lengthMinutes?: number;
  room?: string;
  points?: string;
  /** The rule that matters: minimum points, no aids, bring a laptop. */
  rule?: string;
  /** YYYY-MM-DD, or YYYY-MM-DD HH:MM. */
  unregisterBy?: string;
  /** What this event gates: a programme that needs the test passed first. */
  dependsOn?: string;
  /** Whether the student has to be there in person. */
  attendance: boolean;
  sourceKind: SourceKind;
  sourceFile?: string;
  /** A course file's link as the overview shows it: what recheck compares against the listing. */
  sourceUrl?: string;
  /** The file's date modified when Claude read it. */
  sourceModified?: string;
  basis: 'stated' | 'inferred';
  /** How an inferred date was worked out. Required when basis is inferred. */
  inferredHow?: string;
  savedAt: string;
  updatedAt: string;
};

type Raw = Record<string, unknown>;
export const MAX_ENTRIES = 200;
export const ID = /^ev-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WINDOW_DAYS = 60;

export class LedgerInputError extends Error {}
export const bad = (m: string): never => {
  throw new LedgerInputError(m);
};

/** A real calendar day between 2000 and 2100: `2026-02-30` is refused, not rolled over. */
export function isDay(s: unknown): boolean {
  if (typeof s !== 'string' || !DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  const y = d.getUTCFullYear();
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && y >= 2000 && y <= 2100;
}
export const dayNumber = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86_400_000;

/** The whole entry, checked as one: what a field needs from the others. Throws LedgerInputError. */
export function finish(
  f: Raw,
  meta: { id: string; savedAt: string; updatedAt: string }
): LedgerEntry {
  const need = (k: string, why: string) =>
    f[k] ? f[k] : bad(`${k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)} is required${why}.`);
  need('title', '');
  const kind = (f.kind ?? bad('kind is required.')) as Kind;
  if (!isDay(f.date)) bad('date is required, as a real date written YYYY-MM-DD.');
  const date = f.date as string;
  if (f.until) {
    const span = dayNumber(f.until as string) - dayNumber(date);
    if (span < 0) bad('until is before date.');
    if (span > MAX_WINDOW_DAYS) bad(`A window can span at most ${MAX_WINDOW_DAYS} days.`);
  }
  const sourceKind = (f.sourceKind ??
    bad(`source_kind is required: ${SOURCES.join(', ')}.`)) as SourceKind;
  if (sourceKind === 'course_file') {
    need('sourceUrl', " for a course file (pass the file's `url` from the overview)");
    need('sourceModified', ' for a course file (pass its `modified` from the overview)');
  }
  if (f.sourceUrl && sourceKind !== 'course_file' && sourceKind !== 'is')
    bad('source_url is only for an event that comes from a course file in IS.');
  const basis = (f.basis ?? 'stated') as 'stated' | 'inferred';
  if (basis === 'inferred')
    need('inferredHow', ' when the date is inferred (say how it was worked out)');
  else if (f.inferredHow) bad('inferred_how is only for an inferred date; set basis to inferred.');
  const keep = (k: string) => (f[k] === null || f[k] === undefined ? {} : { [k]: f[k] });
  return {
    id: meta.id,
    title: f.title as string,
    kind,
    ...keep('code'),
    date,
    ...keep('time'),
    ...keep('until'),
    ...keep('lengthMinutes'),
    ...keep('room'),
    ...keep('points'),
    ...keep('rule'),
    ...keep('unregisterBy'),
    ...keep('dependsOn'),
    attendance: typeof f.attendance === 'boolean' ? f.attendance : ATTEND.includes(kind),
    sourceKind,
    ...keep('sourceFile'),
    ...keep('sourceUrl'),
    ...keep('sourceModified'),
    basis,
    ...keep('inferredHow'),
    savedAt: meta.savedAt,
    updatedAt: meta.updatedAt,
  };
}

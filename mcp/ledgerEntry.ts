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

export const MAX_ENTRIES = 200;
export const ID = /^ev-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CODE = /^[\p{L}\p{N}][\p{L}\p{N}._-]{1,29}$/u;
const MAX_WINDOW_DAYS = 60;
// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;

/** Fields a caller sets, by their name in the tool (snake_case) and the entry (camelCase). */
export const TEXT_FIELDS = {
  title: ['title', 120],
  room: ['room', 60],
  points: ['points', 40],
  rule: ['rule', 500],
  depends_on: ['dependsOn', 300],
  source_file: ['sourceFile', 200],
  source_url: ['sourceUrl', 600],
  source_modified: ['sourceModified', 40],
  inferred_how: ['inferredHow', 300],
} as const;

export class LedgerInputError extends Error {}
const bad = (m: string): never => {
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

function text(name: string, v: unknown, max: number): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return bad(`${name} must be text.`);
  const t = v.trim();
  if (!t) return undefined;
  if (CONTROL.test(t)) return bad(`${name} contains a control character.`);
  if (t.length > max)
    return bad(`${name} is ${t.length} characters; the most is ${max}. Shorten it.`);
  return t;
}

type Raw = Record<string, unknown>;

/**
 * The fields of one add or update call that were given, checked one by one. An empty string
 * means "clear this field" on an update (null here); a field not given is not in the result.
 */
export function parseFields(args: Raw): Partial<Record<keyof LedgerEntry, unknown>> {
  const out: Partial<Record<keyof LedgerEntry, unknown>> = {};
  const given = (k: string) => args[k] !== undefined;
  for (const [name, [key, max]] of Object.entries(TEXT_FIELDS)) {
    if (given(name)) out[key as keyof LedgerEntry] = text(name, args[name], max) ?? null;
  }
  if (given('code')) {
    const c = text('code', args.code, 30);
    if (c && !CODE.test(c)) bad('code must be a subject code such as EBC-PE.');
    out.code = c?.toUpperCase() ?? null;
  }
  for (const name of ['date', 'until'] as const) {
    if (!given(name)) continue;
    const v = text(name, args[name], 10) ?? null;
    if (v !== null && !isDay(v))
      bad(`${name} must be a real date written YYYY-MM-DD (2000 to 2100).`);
    out[name] = v;
  }
  if (given('time')) {
    const v = text('time', args.time, 5) ?? null;
    if (v !== null && !TIME.test(v)) bad('time must be HH:MM, 24-hour, Prague time.');
    out.time = v;
  }
  if (given('unregister_by')) {
    const v = text('unregister_by', args.unregister_by, 16) ?? null;
    if (
      v !== null &&
      !(isDay(v) || (isDay(v.slice(0, 10)) && TIME.test(v.slice(11)) && v[10] === ' '))
    )
      bad('unregister_by must be YYYY-MM-DD or YYYY-MM-DD HH:MM.');
    out.unregisterBy = v;
  }
  if (given('length_minutes')) {
    const v = args.length_minutes;
    if (v !== null && (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 1440))
      bad('length_minutes must be a whole number of minutes, 1 to 1440.');
    out.lengthMinutes = v ?? null;
  }
  for (const [name, list] of [
    ['kind', KINDS],
    ['source_kind', SOURCES],
    ['basis', ['stated', 'inferred']],
  ] as const) {
    if (!given(name)) continue;
    if (
      typeof args[name] !== 'string' ||
      !(list as readonly string[]).includes(args[name] as string)
    )
      bad(`${name} must be one of: ${list.join(', ')}.`);
    out[name === 'source_kind' ? 'sourceKind' : (name as 'kind' | 'basis')] = args[name];
  }
  if (given('attendance')) {
    if (typeof args.attendance !== 'boolean') bad('attendance must be true or false.');
    out.attendance = args.attendance;
  }
  return out;
}

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

/** A stored file read back: the same checks, so a damaged one is `null`, not trusted. */
export function parseStored(raw: string | undefined): LedgerEntry | null {
  try {
    const v = JSON.parse(raw ?? 'null') as Raw | null;
    if (!v || typeof v !== 'object' || Array.isArray(v) || !ID.test(String(v.id))) return null;
    const snake: Raw = {
      ...v,
      depends_on: v.dependsOn,
      length_minutes: v.lengthMinutes,
      unregister_by: v.unregisterBy,
      source_kind: v.sourceKind,
      source_file: v.sourceFile,
      source_url: v.sourceUrl,
      source_modified: v.sourceModified,
      inferred_how: v.inferredHow,
    };
    const fields = parseFields(snake);
    const at = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : '');
    return finish(fields, {
      id: v.id as string,
      savedAt: at('savedAt'),
      updatedAt: at('updatedAt'),
    });
  } catch {
    return null;
  }
}

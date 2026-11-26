// The fields of one add or update call, checked one by one (ledgerEntry.ts has the entry they
// make up). Everything here arrives from Claude, so it is untrusted text: strict types, bounded
// lengths, no control characters. A stored file read back goes through the same checks.
import { ID, KINDS, SOURCES, bad, finish, isDay, type LedgerEntry } from './ledgerEntry';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CODE = /^[\p{L}\p{N}][\p{L}\p{N}._-]{1,29}$/u;
// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;

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

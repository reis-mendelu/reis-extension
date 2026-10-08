import type { DesiredEvent, ExistingEvent, ReisKind } from './types';

export interface PlanInput {
  kind: ReisKind;
  desired: DesiredEvent[];
  existing: ExistingEvent[];
  today: string;
  includePast: boolean;
  sourceConfirmed: boolean;
  previousHeld: string | null;
}

export interface Plan {
  insert: DesiredEvent[];
  update: DesiredEvent[];
  remove: string[];
  held: string | null;
}

export function deleteFingerprint(ids: string[]): string {
  return [...ids].sort().join(',');
}

/**
 * One kind, one run. Pure: same input, same plan (lessonPlans.json pins it).
 *
 * Deletes are the dangerous half. Every kind needs a confirmed read. Lessons
 * also need a non-empty desired list and, past a third of the future, the
 * same set seen twice in a row: IS answers "no lessons" and "query failed"
 * with the same bytes. Exams and custom events may legitimately go empty.
 */
export function planKind(input: PlanInput): Plan {
  const { kind, today, includePast } = input;
  const inScope = (date: string) => includePast || date >= today;
  const desired = input.desired.filter((d) => inScope(d.date));
  const existing = new Map(input.existing.filter((e) => inScope(e.date)).map((e) => [e.id, e]));
  const wanted = new Set(desired.map((d) => d.id));

  const insert = desired.filter((d) => !existing.has(d.id));
  const update = desired.filter((d) => {
    const e = existing.get(d.id);
    return e !== undefined && e.hash !== d.hash;
  });

  // Deletes are only ever considered from today on, even on a creating run.
  const futureExisting = input.existing.filter((e) => e.date >= today);
  const candidates = futureExisting.filter((e) => !wanted.has(e.id)).map((e) => e.id);

  const empty = { insert, update, remove: [] as string[], held: null };
  if (candidates.length === 0) return empty;
  if (!input.sourceConfirmed) return empty;
  // Lessons only: IS answers "no lessons" and "failed" with the same bytes.
  // Exams and custom events legitimately go empty (last exam deregistered).
  if (kind === 'lesson' && input.desired.length === 0) return empty;

  const fingerprint = deleteFingerprint(candidates);
  const massive = kind === 'lesson' && candidates.length * 3 > futureExisting.length;
  if (massive && input.previousHeld !== fingerprint) {
    return { insert, update, remove: [], held: fingerprint };
  }
  return { insert, update, remove: candidates, held: null };
}

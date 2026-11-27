import type { ImpersonationResult } from '../../src/api/impersonation/types';

export interface PersonaStats {
  planRows: number;
  /** Subjects the plan semester has this persona attend; 0 = IS has no plan for it. */
  planSubjects: number;
  subjects: number;
  lectures: number;
  seminars: number;
  /** The most distinct weekly seminar slots (weekday + start) of any one subject. */
  maxSeminarSlots: number;
  /** Plan subjects of this semester with no lesson at all in the timetable. */
  subjectsWithoutLessons: number;
  /** Subjects the group is taught that the plan semester does not list (added from the timetable). */
  timetableOnly: number;
}

export interface PersonaRow {
  id: string;
  /** The programme code IS resolved to; null when the persona did not resolve. */
  code: string | null;
  group: number | null;
  stats: PersonaStats | null;
  error?: string;
}

/**
 * A first-year group has one seminar per subject a week. More than this many
 * distinct weekly slots for one subject means the timetable gave every group's
 * seminars (no group, or a group IS ignored), which "seminars > 0" alone passes.
 */
const MAX_SLOTS_FOR_ONE_GROUP = 2;

const weekday = (yyyymmdd: string) =>
  new Date(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8)).getDay();

export function personaStats(r: ImpersonationResult): PersonaStats {
  const planRows = r.plan.cz.blocks.reduce(
    (n, b) => n + b.groups.reduce((m, g) => m + g.subjects.length, 0),
    0
  );
  const codes = Object.keys(r.subjects.data);
  const slots = new Map<string, Set<string>>();
  let lectures = 0;
  let seminars = 0;
  for (const l of r.schedule) {
    if (l.isSeminar === 'true') {
      seminars++;
      const set = slots.get(l.courseCode) ?? new Set<string>();
      set.add(`${weekday(l.date)}-${l.startTime}`);
      slots.set(l.courseCode, set);
    } else lectures++;
  }
  const taught = new Set(r.schedule.map((l) => l.courseCode));
  const planned = new Set(
    r.plan.cz.blocks.flatMap((b) =>
      b.groups.flatMap((g) => g.subjects.filter((x) => x.isEnrolled).map((x) => x.code))
    )
  );
  return {
    planRows,
    planSubjects: planned.size,
    subjects: codes.length,
    lectures,
    seminars,
    maxSeminarSlots: Math.max(0, ...[...slots.values()].map((s) => s.size)),
    subjectsWithoutLessons: codes.filter((c) => !taught.has(c)).length,
    timetableOnly: [...taught].filter((c) => !planned.has(c)).length,
  };
}

/** Why a row fails; empty = it passes. */
export function personaVerdict(row: PersonaRow): string[] {
  if (!row.code) return ['unresolved'];
  if (row.error || !row.stats) return [`error: ${row.error ?? 'unknown'}`];
  const s = row.stats;
  const out: string[] = [];
  if (s.subjects === 0) out.push('0 subjects');
  if (s.planSubjects === 0) out.push('0 plan subjects');
  if (s.lectures === 0) out.push('0 lectures');
  if (s.seminars === 0 && row.group !== null) out.push('0 seminars');
  if (s.maxSeminarSlots > MAX_SLOTS_FOR_ONE_GROUP) out.push('seminars not narrowed to one group');
  return out;
}

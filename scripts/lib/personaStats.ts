import type { ImpersonationResult } from '../../src/api/impersonation/types';

export interface PersonaStats {
  planRows: number;
  /** Subjects the plan semester has this persona attend; 0 = IS has no plan for it. */
  planSubjects: number;
  subjects: number;
  lectures: number;
  seminars: number;
  /**
   * The most RECURRING weekly seminar slots (weekday + start, on two dates or
   * more) of any one subject. A one-off block day is not counted.
   */
  maxSeminarSlots: number;
  /** Plan subjects of this semester with no lesson at all in the timetable. */
  subjectsWithoutLessons: number;
  /**
   * Taught subjects the persona does not attend by its plan semester (added
   * from the timetable). Electives of that semester beyond the minimum count
   * here too; `taughtSubjects` does not add those.
   */
  timetableOnly: number;
}

/** One pinned Erasmus course: its lessons in the persona's timetable. */
export interface CourseStats {
  code: string;
  lectures: number;
  seminars: number;
}

export interface PersonaRow {
  id: string;
  /** The programme code IS resolved to; null when the persona did not resolve. */
  code: string | null;
  group: number | null;
  stats: PersonaStats | null;
  error?: string;
  /** Erasmus only: its pinned courses, which of them IS still lists, and each one's lessons. */
  courses?: { pinned: string[]; resolved: string[]; stats: CourseStats[] };
}

/**
 * A pinned Erasmus course that genuinely has no seminar, with the reason, so
 * the check does not fail it. Empty: all five have one (live 2026-11-28).
 */
const SEMINARLESS: Record<string, string> = {};

/**
 * A first-year group mostly has one seminar per subject a week; two is a real
 * week too (TAVKA1: a weekly slot and a virtual one on another day). More
 * recurring slots than that for one subject means the timetable gave every
 * group's seminars (no group, or a group IS ignored), which "seminars > 0"
 * alone passes. Blind spot: a subject with exactly two parallels and no group.
 */
const MAX_SLOTS_FOR_ONE_GROUP = 2;

const weekday = (yyyymmdd: string) =>
  new Date(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8)).getDay();

export function personaStats(r: ImpersonationResult): PersonaStats {
  const blocks = r.plan?.cz.blocks ?? [];
  const planRows = blocks.reduce(
    (n, b) => n + b.groups.reduce((m, g) => m + g.subjects.length, 0),
    0
  );
  const codes = Object.keys(r.subjects.data);
  const slots = new Map<string, Map<string, Set<string>>>();
  let lectures = 0;
  let seminars = 0;
  for (const l of r.schedule) {
    if (l.isSeminar === 'true') {
      seminars++;
      const bySlot = slots.get(l.courseCode) ?? new Map<string, Set<string>>();
      const key = `${weekday(l.date)}-${l.startTime}`;
      bySlot.set(key, (bySlot.get(key) ?? new Set<string>()).add(l.date));
      slots.set(l.courseCode, bySlot);
    } else lectures++;
  }
  const recurring = [...slots.values()].map(
    (m) => [...m.values()].filter((d) => d.size > 1).length
  );
  const taught = new Set(r.schedule.map((l) => l.courseCode));
  const planned = new Set(
    blocks.flatMap((b) =>
      b.groups.flatMap((g) => g.subjects.filter((x) => x.isEnrolled).map((x) => x.code))
    )
  );
  return {
    planRows,
    planSubjects: planned.size,
    subjects: codes.length,
    lectures,
    seminars,
    maxSeminarSlots: Math.max(0, ...recurring),
    subjectsWithoutLessons: codes.filter((c) => !taught.has(c)).length,
    timetableOnly: [...taught].filter((c) => !planned.has(c)).length,
  };
}

export function courseStats(r: ImpersonationResult, codes: string[]): CourseStats[] {
  return codes.map((code) => {
    const own = r.schedule.filter((l) => l.courseCode === code);
    const seminars = own.filter((l) => l.isSeminar === 'true').length;
    return { code, lectures: own.length - seminars, seminars };
  });
}

/**
 * Erasmus (design 2026-11-27 §7): every pinned code still resolves, and each
 * course has a lecture and a seminar. No plan rules: it has none by design.
 */
function erasmusVerdict(c: NonNullable<PersonaRow['courses']>, s: PersonaStats): string[] {
  const out = c.pinned.filter((x) => !c.resolved.includes(x)).map((x) => `unresolved: ${x}`);
  for (const x of c.stats) {
    if (!c.resolved.includes(x.code)) continue;
    if (x.lectures === 0) out.push(`${x.code}: 0 lectures`);
    if (x.seminars === 0 && !SEMINARLESS[x.code]) out.push(`${x.code}: 0 seminars`);
  }
  if (s.maxSeminarSlots > MAX_SLOTS_FOR_ONE_GROUP)
    out.push('seminars not narrowed to one parallel');
  return out;
}

/** Why a row fails; empty = it passes. */
export function personaVerdict(row: PersonaRow): string[] {
  if (!row.code) return ['unresolved'];
  if (row.error || !row.stats) return [`error: ${row.error ?? 'unknown'}`];
  const s = row.stats;
  if (row.courses) return erasmusVerdict(row.courses, s);
  const out: string[] = [];
  if (s.subjects === 0) out.push('0 subjects');
  if (s.planSubjects === 0) out.push('0 plan subjects');
  if (s.lectures === 0) out.push('0 lectures');
  if (s.seminars === 0 && row.group !== null) out.push('0 seminars');
  if (s.maxSeminarSlots > MAX_SLOTS_FOR_ONE_GROUP) out.push('seminars not narrowed to one group');
  return out;
}

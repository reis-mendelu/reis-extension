// Output shaping for the tools whose raw data is too big for one answer. A
// full semester's timetable or a whole study plan ran past CHARACTER_LIMIT
// (2026-10-10, live), and the cut fell on the FUTURE: Claude would have
// answered "what's next week" from September.

type Lesson = Record<string, unknown>;

/** YYYY-MM-DD in local time. */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Default window: today and the next 14 days. */
export function defaultRange(now: Date = new Date()): { from: string; to: string } {
  // Calendar arithmetic, not 14 × 24 h: a DST change would shift the end by a day.
  const end = new Date(now);
  end.setDate(end.getDate() + 14);
  return { from: isoDay(now), to: isoDay(end) };
}

/** IS writes lesson dates as YYYYMMDD. */
const lessonDay = (raw: unknown) => {
  const s = String(raw ?? '');
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
};

const kindOf = (l: Lesson) =>
  l.isConsultation === 'true' || l.isConsultation === true
    ? 'consultation'
    : l.isSeminar === 'true' || l.isSeminar === true
      ? 'seminar'
      : 'lecture';

const teacherNames = (t: unknown) =>
  Array.isArray(t)
    ? t
        .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>).shortName : ''))
        .filter(Boolean)
        .join(', ')
    : '';

/** One compact row per lesson inside [from, to], sorted by date and time. */
export function scheduleRows(lessons: unknown, from: string, to: string): Record<string, string>[] {
  if (!Array.isArray(lessons)) return [];
  return (lessons as Lesson[])
    .map((l) => ({
      date: lessonDay(l.date),
      start: String(l.startTime ?? ''),
      end: String(l.endTime ?? ''),
      code: String(l.courseCode ?? ''),
      subject: String(l.courseName ?? ''),
      kind: kindOf(l),
      room: String(l.room ?? ''),
      campus: String(l.campus ?? ''),
      teachers: teacherNames(l.teachers),
    }))
    .filter((r) => r.date >= from && r.date <= to)
    .sort((a, b) =>
      (a.date + a.start.padStart(5, '0')).localeCompare(b.date + b.start.padStart(5, '0'))
    );
}

const SUBJECT_FIELDS = [
  'code',
  'name',
  'type',
  'credits',
  'isEnrolled',
  'isFulfilled',
  'fulfillmentDate',
];

const pick = (o: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

const asRecords = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    : [];

/** The plan's structure, with each subject cut to what answers "what's left". */
export function compactStudyPlan(plan: unknown): unknown {
  if (!plan || typeof plan !== 'object') return plan;
  const p = plan as Record<string, unknown>;
  return {
    ...p,
    blocks: asRecords(p.blocks).map((block) => ({
      ...block,
      groups: asRecords(block.groups).map((group) => ({
        ...group,
        subjects: asRecords(group.subjects).map((s) => pick(s, SUBJECT_FIELDS)),
      })),
    })),
  };
}

export type TeacherRole = 'guarantor' | 'lecturer' | 'tutor' | 'examiner' | 'other';

export interface SyllabusTeacher {
  name: string;
  id?: string | null;
  /** IS's comma-joined list: "cvičící, garant, přednášející, zkoušející". */
  roles: string;
}

export interface TeacherGroup {
  role: TeacherRole;
  teachers: SyllabusTeacher[];
}

/** Most senior first — the order a student reads "who runs this course" in. */
const ORDER: TeacherRole[] = ['guarantor', 'lecturer', 'tutor', 'examiner', 'other'];

/**
 * Word stems rather than exact strings: IS writes the Czech roles in the
 * Czech syllabus and English ones in the English syllabus, and "tutor" turns
 * up in the Czech data too (combined-study cohorts).
 */
function roleOf(raw: string): TeacherRole {
  const r = raw.trim().toLowerCase();
  if (r.includes('garant') || r.includes('guarant')) return 'guarantor';
  if (r.includes('přednáš') || r.includes('lectur')) return 'lecturer';
  if (r.includes('cvič') || r.includes('tutor') || r.includes('seminar') || r.includes('instruct'))
    return 'tutor';
  if (r.includes('zkouš') || r.includes('examin')) return 'examiner';
  return 'other';
}

/**
 * The subject's teachers, grouped under the most senior role each one holds.
 *
 * One person, one row. IS lists the garant of Ekonometrie as "cvičící, garant,
 * přednášející, zkoušející"; filing him under every role would repeat his name
 * four times and make four teachers look like seven. Under the top role he is
 * found where a student looks for the person responsible for the course.
 *
 * A role this does not recognise lands in `other` rather than being dropped: an
 * unsorted group at the end is a cosmetic flaw, a missing teacher is not.
 */
export function groupTeachersByRole(
  teachers: readonly SyllabusTeacher[] | undefined
): TeacherGroup[] {
  if (!teachers?.length) return [];
  const byRole = new Map<TeacherRole, SyllabusTeacher[]>();
  for (const teacher of teachers) {
    const held = teacher.roles
      .split(',')
      .filter((r) => r.trim())
      .map(roleOf);
    const top = ORDER.find((role) => held.includes(role)) ?? 'other';
    byRole.set(top, [...(byRole.get(top) ?? []), teacher]);
  }
  return ORDER.filter((role) => byRole.has(role)).map((role) => ({
    role,
    teachers: byRole.get(role)!,
  }));
}

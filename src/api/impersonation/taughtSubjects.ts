import type { BlockLesson } from '../../types/schedule';
import type { SubjectInfo } from '../../types/documents';

/**
 * Subjects the timetable teaches the persona's group that its plan semester
 * does not list. A real student is enrolled in them, so they belong on the
 * persona's subject list; the plan screen keeps what IS's catalogue says.
 * ZF B-RASZ, a new accreditation, lists 3 subjects for its first semester while
 * the year-1 group is taught 7 (BOTAZ, GEODZ, FYTOP1, ZABAH: live 2026-11-27).
 * Names come from the timetable; `courseId` is the current period's subject id.
 */
export function taughtSubjects(
  schedule: BlockLesson[],
  /** Every code the plan semester lists, electives beyond the minimum included. */
  planned: Set<string>,
  fetchedAt: string
): Record<string, SubjectInfo> {
  const out: Record<string, SubjectInfo> = {};
  for (const l of schedule) {
    if (planned.has(l.courseCode) || out[l.courseCode]) continue;
    out[l.courseCode] = {
      displayName: l.courseName,
      fullName: `${l.courseCode} ${l.courseName}`,
      nameCs: l.courseName,
      nameEn: l.courseNameEn ?? l.courseName,
      subjectCode: l.courseCode,
      ...(l.courseId ? { subjectId: l.courseId } : {}),
      folderUrl: '',
      fetchedAt,
    };
  }
  return out;
}

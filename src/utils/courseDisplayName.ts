/** The student's own names for subjects, keyed by course code (`meta/course_nicknames`). */
export type CourseNicknames = Record<string, string> | undefined;

/**
 * What to call a subject: the student's nickname for it, else the name IS
 * gave it, else its code. The plain-function form of `useCourseName`, for the
 * places a hook cannot go — inside a `.map()` or a `useMemo`.
 */
export function courseDisplayName(
  nicknames: CourseNicknames,
  courseCode: string | undefined,
  fallbackName: string | undefined
): string {
  const nickname = courseCode ? nicknames?.[courseCode] : undefined;
  return nickname || fallbackName || courseCode || '';
}

/**
 * A timetable lesson's title. An exam's title is `<subject> - <section>`, and
 * a nickname names the subject, so it replaces only the part before the first
 * " - " — the rule the extension's `CalendarEventCard` applies.
 */
export function lessonDisplayName(
  nicknames: CourseNicknames,
  lesson: { courseCode?: string; isExam?: boolean },
  localizedName: string
): string {
  const nickname = lesson.courseCode ? nicknames?.[lesson.courseCode] : undefined;
  if (!nickname) return localizedName;
  const dash = localizedName.indexOf(' - ');
  return lesson.isExam && dash >= 0 ? nickname + localizedName.slice(dash) : nickname;
}

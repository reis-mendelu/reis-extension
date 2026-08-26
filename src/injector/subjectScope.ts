/**
 * Which subjects Phase 3 is allowed to crawl.
 *
 * `syncSubjectDetails` fans out over `subjects.data`, and that map is built
 * AFTER `mergePastSubjects` — so it holds every subject the student has ever
 * enrolled in, not the ones they are studying. Each entry costs a recursive,
 * paginated file crawl plus a syllabus, and for a third-year student most of
 * those folders belong to subjects finished two years ago and cannot change.
 * That fan-out, not the number of screens, is what makes a cold run ~120
 * requests (issue #197).
 *
 * Past subjects are not abandoned — they are fetched when someone actually
 * opens one. The store already owns that path per subject, with its own
 * loading state and freshness stamp: files through `createFilesSlice`,
 * syllabus through `createSyllabusSlice`, classmates through
 * `fetchClassmatesPriority` (`useClassmates` calls it on mount). The sync was
 * duplicating machinery the drawer already has, eagerly, for everyone.
 */
export function currentSemesterEntries<T>(
  entries: readonly (readonly [string, T])[],
  currentCodes: readonly string[]
): (readonly [string, T])[] {
  // An empty list means "we do not know which semester is current" — the
  // subjects fetch failed, or was skipped before this context ever ran one.
  // Crawling everything is wasteful; crawling nothing would leave the student
  // with no files at all, so the unknown case keeps the old behaviour.
  if (currentCodes.length === 0) return [...entries];

  const current = new Set(currentCodes);
  const scoped = entries.filter(([code]) => current.has(code));

  // Same reasoning one step further: if the codes we were given match nothing
  // in the map, the two came from different places and the intersection is a
  // bug, not an answer. Fall back rather than silently fetch nothing.
  return scoped.length === 0 ? [...entries] : scoped;
}

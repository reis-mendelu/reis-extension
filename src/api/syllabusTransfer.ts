// Formats a MENDELU syllabus into the plain text the Erasmus comparison shows.
// Local string building only — nothing here sends anything anywhere.
//
// This file used to also export `compareSyllabi` and `warmupTransferApi`, which
// POSTed syllabus text unauthenticated to a personal HuggingFace Space
// (darksoothingshadow-reis-syllabus-similarity) outside reIS infrastructure.
// Nothing called them, but dead client code still documents a live endpoint and
// invites reuse, so both are removed.

export function buildMendeluText(syllabus: {
  courseInfo?: { courseNameEn?: string | null; courseNameCs?: string | null } | null;
  objectivesText?: string | null;
  contentText?: string | null;
}): string {
  const parts = [
    syllabus.courseInfo?.courseNameEn ?? syllabus.courseInfo?.courseNameCs,
    syllabus.objectivesText,
    syllabus.contentText,
  ].filter(Boolean);
  return parts.join('\n\n');
}

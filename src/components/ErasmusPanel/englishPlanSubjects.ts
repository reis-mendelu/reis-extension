import type { DualLanguageStudyPlan, StudyPlan, SubjectStatus } from '../../types/studyPlan';

/**
 * The study plan's subjects under their ENGLISH names, for the Erasmus PDF —
 * EU guidelines want English whatever language the UI is in.
 *
 * A Czech student's sync fetches no English plan (`en` is null), so this asks
 * IS for it when the export runs: one request, on the one action that needs
 * it. Nothing is exported rather than Czech names passed off as English.
 */
export async function englishPlanSubjects(
  dual: DualLanguageStudyPlan | null,
  studium: string | undefined,
  fetchEnglishPlan: (studium: string) => Promise<StudyPlan | null>
): Promise<SubjectStatus[]> {
  const plan = dual?.en ?? (studium ? await fetchEnglishPlan(studium) : null);
  return (plan?.blocks ?? []).flatMap((b) => (b.groups ?? []).flatMap((g) => g.subjects ?? []));
}

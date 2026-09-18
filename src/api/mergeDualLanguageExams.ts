import type { ExamSubject } from '../types/exams';

/**
 * Fold the English fetch into the Czech one, so a single section object
 * carries both names and the UI can switch language without refetching.
 *
 * Sections are matched across languages by term id first, then by name and by
 * the registered term — IS renumbers nothing between the two renderings, so
 * the ids line up; the fallbacks exist for rows where a term id is missing.
 *
 * Lives in its own file because `api/exams.ts` is at the repository's ~200
 * line ceiling and this is the one self-contained piece of it.
 */
export function mergeDualLanguageExams(
  czData: ExamSubject[],
  enData: ExamSubject[]
): ExamSubject[] {
  const merged: ExamSubject[] = [...czData];

  enData.forEach((enSubject) => {
    const czSubject = merged.find((s) => s.code === enSubject.code);
    if (czSubject) {
      // Merge localized name
      czSubject.nameEn = enSubject.nameEn;

      // Merge sections
      enSubject.sections.forEach((enSection) => {
        const czSection = czSubject.sections.find(
          (s) =>
            s.id === enSection.id ||
            s.name === enSection.name ||
            s.terms.some((t) =>
              enSection.terms.some(
                (et) =>
                  (et.id && et.id === t.id) ||
                  (t.date === et.date && t.time === et.time && t.teacher === et.teacher)
              )
            ) ||
            (s.registeredTerm &&
              enSection.registeredTerm &&
              ((s.registeredTerm.id && s.registeredTerm.id === enSection.registeredTerm.id) ||
                (s.registeredTerm.date === enSection.registeredTerm.date &&
                  s.registeredTerm.time === enSection.registeredTerm.time)))
        );

        if (czSection) {
          czSection.nameEn = enSection.nameEn;

          // Merge terms
          enSection.terms.forEach((enTerm) => {
            const czTerm = czSection.terms.find((t) => t.id === enTerm.id);
            if (czTerm) {
              czTerm.roomEn = enTerm.roomEn;
              czTerm.sectionFormEn = enTerm.sectionFormEn;
            }
          });

          // Merge registered term if it exists
          if (enSection.registeredTerm && czSection.registeredTerm) {
            czSection.registeredTerm.roomEn = enSection.registeredTerm.roomEn;
          }
        } else {
          // Section only exists in EN? (Unlikely but safe to add)
          czSubject.sections.push(enSection);
        }
      });
    } else {
      merged.push(enSubject);
    }
  });

  return merged;
}

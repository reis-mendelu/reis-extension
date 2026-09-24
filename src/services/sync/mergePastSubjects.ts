import type { fetchDualLanguagePastSubjects } from '../../api/pastSubjects';
import type { fetchDualLanguageStudyPlan } from '../../api/studyPlan';

type PastFoldersByLang = Awaited<ReturnType<typeof fetchDualLanguagePastSubjects>>;
type DualStudyPlan = Awaited<ReturnType<typeof fetchDualLanguageStudyPlan>>;

export function mergePastSubjects(
  subjectsData: {
    data: Record<
      string,
      {
        displayName: string;
        fullName: string;
        nameCs?: string;
        nameEn?: string;
        subjectCode: string;
        subjectId?: string;
        folderUrl: string;
        fetchedAt: string;
      }
    >;
  },
  past: PastFoldersByLang,
  plan: DualStudyPlan | null
) {
  const planById = new Map<string, string>();
  const planNameCs = new Map<string, string>();
  const planNameEn = new Map<string, string>();
  if (plan) {
    for (const block of plan.cz.blocks)
      for (const group of block.groups)
        for (const s of group.subjects) {
          planById.set(s.code, s.id);
          planNameCs.set(s.code, s.name);
        }
    for (const block of plan.en?.blocks ?? [])
      for (const group of block.groups)
        for (const s of group.subjects) {
          planNameEn.set(s.code, s.name);
        }
  }

  // The folders arrive in the student's language only, so an English student's
  // `past.cz` is empty: take every code either side has, Czech folder first.
  const now = new Date().toISOString();
  for (const code of new Set([...Object.keys(past.cz), ...Object.keys(past.en)])) {
    if (subjectsData.data[code]) continue;
    const folder = past.cz[code] ?? past.en[code]!;
    const nameCs = planNameCs.get(code) ?? past.cz[code]?.displayName;
    const nameEn = planNameEn.get(code) ?? past.en[code]?.displayName;
    const displayName = nameCs ?? nameEn ?? folder.displayName;
    subjectsData.data[code] = {
      subjectCode: code,
      displayName,
      fullName: `${code} ${displayName}`,
      nameCs,
      nameEn,
      subjectId: planById.get(code),
      folderUrl: folder.folderUrl,
      fetchedAt: now,
    };
  }
}

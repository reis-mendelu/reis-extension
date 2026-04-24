import type { fetchDualLanguagePastSubjects } from "../../api/pastSubjects";
import type { fetchDualLanguageStudyPlan } from "../../api/studyPlan";

type PastFoldersByLang = Awaited<ReturnType<typeof fetchDualLanguagePastSubjects>>;
type DualStudyPlan = Awaited<ReturnType<typeof fetchDualLanguageStudyPlan>>;

export function mergePastSubjects(
    subjectsData: { data: Record<string, { displayName: string; fullName: string; nameCs?: string; nameEn?: string; subjectCode: string; subjectId?: string; folderUrl: string; fetchedAt: string }> },
    past: PastFoldersByLang,
    plan: DualStudyPlan | null,
) {
    const planById = new Map<string, string>();
    const planNameCs = new Map<string, string>();
    const planNameEn = new Map<string, string>();
    if (plan) {
        for (const block of plan.cz.blocks) for (const group of block.groups) for (const s of group.subjects) {
            planById.set(s.code, s.id);
            planNameCs.set(s.code, s.name);
        }
        for (const block of plan.en.blocks) for (const group of block.groups) for (const s of group.subjects) {
            planNameEn.set(s.code, s.name);
        }
    }

    const now = new Date().toISOString();
    for (const [code, czFolder] of Object.entries(past.cz)) {
        if (subjectsData.data[code]) continue;
        const nameCs = planNameCs.get(code) ?? czFolder.displayName;
        const nameEn = planNameEn.get(code) ?? past.en[code]?.displayName;
        subjectsData.data[code] = {
            subjectCode: code,
            displayName: nameCs,
            fullName: `${code} ${nameCs}`,
            nameCs,
            nameEn,
            subjectId: planById.get(code),
            folderUrl: czFolder.folderUrl,
            fetchedAt: now,
        };
    }
}

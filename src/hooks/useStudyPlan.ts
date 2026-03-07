import { useAppStore } from '@/store/useAppStore';
import type { StudyPlan } from '@/types/studyPlan';

export function useStudyPlan(): StudyPlan | null {
    const dual = useAppStore(s => s.studyPlanDual);
    const lang = useAppStore(s => s.language);
    return dual?.[lang === 'en' ? 'en' : 'cz'] ?? null;
}

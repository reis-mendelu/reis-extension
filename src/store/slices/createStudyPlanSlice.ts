import type { AppSlice, StudyPlanSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { isDualLanguageStudyPlan } from '../../types/studyPlan';


export const createStudyPlanSlice: AppSlice<StudyPlanSlice> = (set) => ({
    studyPlanDual: null,
    studyPlanLoading: false,
    fetchStudyPlan: async () => {
        set({ studyPlanLoading: true });
        try {
            const stored = await IndexedDBService.get('study_plan', 'current');
            if (stored && isDualLanguageStudyPlan(stored)) {
                set({ studyPlanDual: stored, studyPlanLoading: false });
            } else {
                set({ studyPlanLoading: false });
            }
        } catch (e) {
            console.error('[Study Plan Slice] Failed to fetch from IndexedDB:', e);
            set({ studyPlanLoading: false });
        }
    }
});

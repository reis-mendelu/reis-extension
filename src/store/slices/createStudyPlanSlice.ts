import type { AppSlice, StudyPlanSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createStudyPlanSlice: AppSlice<StudyPlanSlice> = (set) => ({
    studyPlan: null,
    studyPlanLoading: false,
    fetchStudyPlan: async () => {
        set({ studyPlanLoading: true });
        try {
            const plan = await IndexedDBService.get('study_plan', 'current');
            if (plan) {
                set({ studyPlan: plan, studyPlanLoading: false });
            } else {
                set({ studyPlanLoading: false });
            }
        } catch (e) {
            console.error('[Study Plan Slice] Failed to fetch from IndexedDB:', e);
            set({ studyPlanLoading: false });
        }
    }
});

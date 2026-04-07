import type { AppSlice, StudyPlanSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { isDualLanguageStudyPlan } from '../../types/studyPlan';
import type { StudyStats } from '../../types/studyPlan';

export const createStudyPlanSlice: AppSlice<StudyPlanSlice> = (set, get) => ({
    studyPlanDual: null,
    studyPlanLoading: true,   // start true — skeleton shows until first fetch resolves
    studyPlanLoaded: false,
    studyStats: null,
    fetchStudyPlan: async () => {
        // Only show loading on the very first call. Subsequent refreshes (e.g. after
        // a sync broadcast) must not flip the skeleton — that causes a visible
        // "reload" flash of the SubjectsPanel while valid data is already on screen.
        const { studyPlanLoaded } = (get() as unknown) as { studyPlanLoaded: boolean };
        if (!studyPlanLoaded) set({ studyPlanLoading: true });
        try {
            const stored = await IndexedDBService.get('study_plan', 'current');
            if (stored && isDualLanguageStudyPlan(stored)) {
                set({ studyPlanDual: stored, studyPlanLoading: false, studyPlanLoaded: true });
            } else {
                set({ studyPlanLoading: false, studyPlanLoaded: true });
            }
        } catch {
            set({ studyPlanLoading: false, studyPlanLoaded: true });
        }
    },
    fetchStudyStats: async () => {
        try {
            const stored = await IndexedDBService.get('meta', 'study_stats') as StudyStats | null;
            if (stored) set({ studyStats: stored });
        } catch {
            // Ignore if stats fail to load from IDB
        }
    },
});

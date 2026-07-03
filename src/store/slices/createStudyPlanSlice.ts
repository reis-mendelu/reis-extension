import type { AppSlice, StudyPlanSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { isDualLanguageStudyPlan } from '../../types/studyPlan';
import type { StudyStats, StudyComparison } from '../../types/studyPlan';
import type { GradeHistory } from '../../types/documents';

export const createStudyPlanSlice: AppSlice<StudyPlanSlice> = (set) => ({
    studyPlanDual: null,
    studyPlanLoaded: false,
    studyStats: null,
    studyComparison: null,
    gradeHistory: null,
    fetchStudyPlan: async () => {
        try {
            const stored = await IndexedDBService.get('study_plan', 'current');
            if (stored && isDualLanguageStudyPlan(stored)) {
                set({ studyPlanDual: stored, studyPlanLoaded: true });
            } else {
                set({ studyPlanLoaded: true });
            }
        } catch {
            set({ studyPlanLoaded: true });
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
    setStudyStats: (stats) => set({ studyStats: stats }),
    fetchStudyComparison: async () => {
        try {
            const stored = await IndexedDBService.get('meta', 'study_comparison') as StudyComparison | null;
            if (stored) set({ studyComparison: stored });
        } catch {
            // Ignore if comparison fails to load from IDB
        }
    },
    setStudyComparison: (c) => set({ studyComparison: c }),
    loadGradeHistory: async () => {
        try {
            const stored = await IndexedDBService.get('grade_history', 'all') as GradeHistory | null;
            if (stored) set({ gradeHistory: stored });
        } catch {
            // Ignore if grades fail to load from IDB
        }
    },
    setGradeHistory: (g) => set({ gradeHistory: g }),
});

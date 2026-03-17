import { create } from 'zustand';
import type { AppState } from './types';
import { createScheduleSlice } from './slices/createScheduleSlice';
import { createExamSlice } from './slices/createExamSlice';
import { createSyllabusSlice } from './slices/createSyllabusSlice';
import { createFilesSlice } from './slices/createFilesSlice';
import { createAssessmentsSlice } from './slices/createAssessmentsSlice';
import { createClassmatesSlice } from './slices/createClassmatesSlice';
import { createSubjectsSlice } from './slices/createSubjectsSlice';
import { createSyncSlice } from './slices/createSyncSlice';
import { createThemeSlice } from './slices/createThemeSlice';
import { createI18nSlice } from './slices/createI18nSlice';
import { createSuccessRateSlice } from './slices/createSuccessRateSlice';
import { createStudyJamsSlice } from './slices/createStudyJamsSlice';
import { createFeedbackSlice } from './slices/createFeedbackSlice';
import { createStudyPlanSlice } from './slices/createStudyPlanSlice';
import { createCvicneTestsSlice } from './slices/createCvicneTestsSlice';
import { createErasmusSlice } from './slices/createErasmusSlice';
import { createPinnedPagesSlice } from './slices/createPinnedPagesSlice';
import { syncService } from '../services/sync';
import { initMockData } from '../utils/initMockData';

export const useAppStore = create<AppState>()((...a) => ({
  ...createScheduleSlice(...a),
  ...createExamSlice(...a),
  ...createSyllabusSlice(...a),
  ...createFilesSlice(...a),
  ...createAssessmentsSlice(...a),
  ...createClassmatesSlice(...a),
  ...createSubjectsSlice(...a),
  ...createSyncSlice(...a),
  ...createThemeSlice(...a),
  ...createI18nSlice(...a),
  ...createSuccessRateSlice(...a),
  ...createStudyJamsSlice(...a),
  ...createFeedbackSlice(...a),
  ...createStudyPlanSlice(...a),
  ...createCvicneTestsSlice(...a),
  ...createErasmusSlice(...a),
  ...createPinnedPagesSlice(...a),
}));

// Initialize store and subscribe to sync updates
export const initializeStore = async () => {
    // Initialize mock data for demo if enabled
    // Set USE_MOCK_DATA=true in your .env file to enable
    if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
        await initMockData();
    }

    // Initial fetch
    useAppStore.getState().fetchSchedule();
    useAppStore.getState().fetchExams();
    useAppStore.getState().fetchSubjects();
    useAppStore.getState().fetchStudyPlan();
    useAppStore.getState().fetchCvicneTests();
    useAppStore.getState().fetchOdevzdavarny();
    useAppStore.getState().fetchAllFiles();
    useAppStore.getState().loadTheme();
    useAppStore.getState().loadLanguage();
    useAppStore.getState().loadFeedbackState();
    useAppStore.getState().loadPinnedPages();

    // Fire-and-forget daily usage tracking
    import('../api/feedback').then(({ trackDailyUsage }) =>
        import('../utils/userParams').then(({ getUserParams }) =>
            getUserParams().then(p => { if (p) trackDailyUsage(p.studentId); })
        )
    );

    // Subscribe to sync service
    const unsubscribe = syncService.subscribe((type) => {
        useAppStore.getState().fetchSchedule();
        useAppStore.getState().fetchExams();
        useAppStore.getState().fetchSubjects();
        useAppStore.getState().fetchStudyPlan();
        useAppStore.getState().fetchCvicneTests();
        useAppStore.getState().fetchOdevzdavarny();
        useAppStore.getState().fetchAllFiles();

        if (type === 'THEME_UPDATE') {
            useAppStore.getState().loadTheme();
        }
        if (type === 'LANGUAGE_UPDATE') {
            useAppStore.getState().loadLanguage();
            // Re-fetch files from IndexedDB so language-aware hooks detect the change
            useAppStore.getState().fetchAllFiles();
        }
    });

    // Cross-tab theme listener — use loadTheme() to also update DOM data-theme attribute
    const bcTheme = new BroadcastChannel('reis_theme_sync');
    bcTheme.onmessage = () => {
        useAppStore.getState().loadTheme();
    };

    // Cross-tab language listener — use loadLanguage() and re-fetch files for the new language
    const bcLang = new BroadcastChannel('reis_language_sync');
    bcLang.onmessage = () => {
        useAppStore.getState().loadLanguage();
        useAppStore.getState().fetchAllFiles();
    };

    return () => {
        unsubscribe();
        bcTheme.close();
        bcLang.close();
    };
};

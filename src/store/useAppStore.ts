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
import { createMenuSlice } from './slices/createMenuSlice';
import { createHiddenItemsSlice } from './slices/createHiddenItemsSlice';
import { createTeachingWeekSlice } from './slices/createTeachingWeekSlice';
import { createNavPagesSlice } from './slices/createNavPagesSlice';
import { createContextSlice } from './slices/createContextSlice';
import { createPulseSlice } from './slices/createPulseSlice';
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
  ...createMenuSlice(...a),
  ...createHiddenItemsSlice(...a),
  ...createTeachingWeekSlice(...a),
  ...createNavPagesSlice(...a),
  ...createContextSlice(...a),
  ...createPulseSlice(...a),
}));

// Initialize store and subscribe to sync updates
export const initializeStore = async () => {
    // Initialize mock data for demo if enabled
    // Set USE_MOCK_DATA=true in your .env file to enable
    if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
        await initMockData();
    }

    const s = useAppStore.getState();

    // Start global pulse
    const pulseInterval = setInterval(() => {
        useAppStore.getState().updatePulse();
    }, 1000);

    // Tier 1: User-visible data — load immediately
    s.fetchSchedule();
    s.fetchExams();
    s.fetchSubjects();
    s.loadTheme();
    s.loadLanguage();
    s.loadContext();

    // Tier 2: Background data — deferred to avoid thundering-herd on IDB at startup
    queueMicrotask(() => {
        const s2 = useAppStore.getState();
        s2.fetchStudyPlan();
        s2.fetchCvicneTests();
        s2.fetchOdevzdavarny();
        s2.fetchAllFiles();
        s2.loadFeedbackState();
        s2.loadPinnedPages();
        s2.loadHiddenItems();
        s2.fetchTeachingWeek();
    });

    // Fire-and-forget daily usage tracking
    import('../api/feedback').then(({ trackDailyUsage }) =>
        import('../utils/userParams').then(({ getUserParams }) =>
            getUserParams().then(p => { if (p) trackDailyUsage(p.studentId); })
        )
    );

    // Subscribe to sync service — selective refresh based on type
    const unsubscribe = syncService.subscribe((type) => {
        const st = useAppStore.getState();

        if (type === 'THEME_UPDATE') {
            st.loadTheme();
            return;
        }
        if (type === 'LANGUAGE_UPDATE') {
            st.loadLanguage();
            st.fetchAllFiles();
            useAppStore.setState({ menu: null });
            return;
        }

        // Default: full data refresh (e.g. after sync completes)
        st.fetchSchedule();
        st.fetchExams();
        st.fetchSubjects();
        st.fetchStudyPlan();
        st.fetchCvicneTests();
        st.fetchOdevzdavarny();
        st.fetchAllFiles();
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
        // Clear menu so it re-fetches with the new language
        useAppStore.setState({ menu: null });
    };

    return () => {
        clearInterval(pulseInterval);
        unsubscribe();
        bcTheme.close();
        bcLang.close();
    };
};

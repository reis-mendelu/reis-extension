import { create } from 'zustand';
import type { AppState } from './types';
import { createScheduleSlice } from './slices/createScheduleSlice';
import { createExamSlice } from './slices/createExamSlice';
import { createSyllabusSlice } from './slices/createSyllabusSlice';
import { createFilesSlice } from './slices/createFilesSlice';
import { createAssessmentsSlice } from './slices/createAssessmentsSlice';
import { createSubjectsSlice } from './slices/createSubjectsSlice';
import { createSyncSlice } from './slices/createSyncSlice';
import { createThemeSlice } from './slices/createThemeSlice';
import { createI18nSlice } from './slices/createI18nSlice';
import { syncService } from '../services/sync';
import { initMockData } from '../utils/initMockData';

export const useAppStore = create<AppState>()((...a) => ({
  ...createScheduleSlice(...a),
  ...createExamSlice(...a),
  ...createSyllabusSlice(...a),
  ...createFilesSlice(...a),
  ...createAssessmentsSlice(...a),
  ...createSubjectsSlice(...a),
  ...createSyncSlice(...a),
  ...createThemeSlice(...a),
  ...createI18nSlice(...a),
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
    useAppStore.getState().fetchAllFiles();
    useAppStore.getState().fetchSyncStatus();
    useAppStore.getState().loadTheme();
    useAppStore.getState().loadLanguage();

    // Subscribe to sync service
    const unsubscribe = syncService.subscribe((type) => {
        useAppStore.getState().fetchSchedule();
        useAppStore.getState().fetchExams();
        useAppStore.getState().fetchSubjects();
        useAppStore.getState().fetchSyncStatus();

        if (type === 'THEME_UPDATE') {
            useAppStore.getState().loadTheme();
        }
        if (type === 'LANGUAGE_UPDATE') {
            useAppStore.getState().loadLanguage();
            // Re-fetch files from IndexedDB so language-aware hooks detect the change
            useAppStore.getState().fetchAllFiles();
        }
    });

    // Cross-tab theme listener
    const bcTheme = new BroadcastChannel('reis_theme_sync');
    bcTheme.onmessage = (event) => {
        const newTheme = event.data;
        if (newTheme === "mendelu" || newTheme === "mendelu-dark") {
            useAppStore.setState({ theme: newTheme });
            document.documentElement.setAttribute("data-theme", newTheme);
        }
    };

    // Cross-tab language listener
    const bcLang = new BroadcastChannel('reis_language_sync');
    bcLang.onmessage = (event) => {
        const newLang = event.data;
        if (newLang === "cs" || newLang === "en") {
            useAppStore.setState({ language: newLang });
        }
    };

    return () => {
        unsubscribe();
        bcTheme.close();
        bcLang.close();
    };
};

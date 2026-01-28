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
import { syncService } from '../services/sync';

export const useAppStore = create<AppState>()((...a) => ({
  ...createScheduleSlice(...a),
  ...createExamSlice(...a),
  ...createSyllabusSlice(...a),
  ...createFilesSlice(...a),
  ...createAssessmentsSlice(...a),
  ...createSubjectsSlice(...a),
  ...createSyncSlice(...a),
  ...createThemeSlice(...a),
}));

// Initialize store and subscribe to sync updates
export const initializeStore = () => {
    // Initial fetch
    useAppStore.getState().fetchSchedule();
    useAppStore.getState().fetchExams();
    useAppStore.getState().fetchSubjects();
    useAppStore.getState().fetchSyncStatus();
    useAppStore.getState().loadTheme();

    // Subscribe to sync service
    const unsubscribe = syncService.subscribe((type) => {
        useAppStore.getState().fetchSchedule();
        useAppStore.getState().fetchExams();
        useAppStore.getState().fetchSubjects();
        useAppStore.getState().fetchSyncStatus();

        if (type === 'THEME_UPDATE') {
            useAppStore.getState().loadTheme();
        }
    });

    // Cross-tab theme listener
    const bc = new BroadcastChannel('reis_theme_sync');
    bc.onmessage = (event) => {
        const newTheme = event.data;
        if (newTheme === "mendelu" || newTheme === "mendelu-dark") {
            useAppStore.setState({ theme: newTheme });
            document.documentElement.setAttribute("data-theme", newTheme);
        }
    };

    return unsubscribe;
};

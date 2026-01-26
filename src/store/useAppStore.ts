import { create } from 'zustand';
import type { AppState } from './types';
import { createScheduleSlice } from './slices/createScheduleSlice';
import { createExamSlice } from './slices/createExamSlice';
import { createSyllabusSlice } from './slices/createSyllabusSlice';
import { syncService } from '../services/sync';

export const useAppStore = create<AppState>()((...a) => ({
  ...createScheduleSlice(...a),
  ...createExamSlice(...a),
  ...createSyllabusSlice(...a),
}));

// Initialize store and subscribe to sync updates
export const initializeStore = () => {
    // Initial fetch
    useAppStore.getState().fetchSchedule();
    useAppStore.getState().fetchExams();

    // Subscribe to sync service
    const unsubscribe = syncService.subscribe(() => {
        useAppStore.getState().fetchSchedule();
        useAppStore.getState().fetchExams();
    });

    return unsubscribe;
};

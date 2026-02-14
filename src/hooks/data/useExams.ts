/**
 * useExams - Hook to access exam data from store.
 * 
 * Returns data from Zustand global store.
 * Initialization is handled by the store itself.
 */

import { useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ExamSubject } from '../../types/exams';

export interface UseExamsResult {
    exams: ExamSubject[];
    isLoaded: boolean;
    error: string | null;
    lastSync: number | null;
    retry: () => void;
}

export function useExams(): UseExamsResult {
    const data = useAppStore(state => state.exams.data);
    const status = useAppStore(state => state.exams.status);
    const error = useAppStore(state => state.exams.error);
    const fetchExams = useAppStore(state => state.fetchExams);

    const retry = useCallback(() => {
        void fetchExams();
    }, [fetchExams]);

    return {
        exams: data,
        isLoaded: status !== 'loading' && status !== 'idle',
        error,
        lastSync: null,
        retry
    };
}


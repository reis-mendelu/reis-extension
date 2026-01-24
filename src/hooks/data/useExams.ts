/**
 * useExams - Hook to access exam data from storage.
 * 
 * Returns stored data immediately (stale-while-revalidate pattern).
 * Subscribes to sync updates for automatic refresh.
 * Includes error state for better UX feedback.
 */

import { useState, useEffect, useCallback } from 'react';
import { IndexedDBService } from '../../services/storage';
import { syncService } from '../../services/sync';
import type { ExamSubject } from '../../types/exams';

export interface UseExamsResult {
    exams: ExamSubject[];
    isLoaded: boolean;
    error: string | null;
    lastSync: number | null;
    retry: () => void;
}

export function useExams(): UseExamsResult {
    const [exams, setExams] = useState<ExamSubject[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSync, setLastSync] = useState<number | null>(null);

    const loadFromStorage = useCallback(async () => {
        try {
            // Load exams from IndexedDB (Async)
            const storedData = await IndexedDBService.get('exams', 'current');
            
            // Load last sync from IndexedDB metadata
            const storedLastSync = await IndexedDBService.get('meta', 'last_sync');

            if (storedData && Array.isArray(storedData) && storedData.length > 0) {
                setExams(storedData);
                setError(null);
            } else {
                setExams([]);
            }
            
            setLastSync(storedLastSync);
            setIsLoaded(true);
        } catch (err) {
            console.error('[useExams] Failed to load from storage:', err);
            setError('Nepodařilo se načíst data zkoušek.');
            setIsLoaded(true);
        }
    }, []);

    const retry = useCallback(() => {
        setIsLoaded(false);
        setError(null);
        void loadFromStorage();
    }, [loadFromStorage]);

    useEffect(() => {
        void loadFromStorage();

        // Subscribe to sync updates
        const unsubscribe = syncService.subscribe(() => {
            void loadFromStorage();
        });

        return unsubscribe;
    }, [loadFromStorage]);

    return { exams, isLoaded, error, lastSync, retry };
}


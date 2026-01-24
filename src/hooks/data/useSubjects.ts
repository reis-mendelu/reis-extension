/**
 * useSubjects - Hook to access subject data from storage.
 * 
 * Returns stored data immediately (stale-while-revalidate pattern).
 * Subscribes to sync updates for automatic refresh.
 */

import { useState, useEffect, useCallback } from 'react';
import { IndexedDBService } from '../../services/storage';
import { syncService } from '../../services/sync';
import type { SubjectsData, SubjectInfo } from '../../types/documents';

export interface UseSubjectsResult {
    subjects: SubjectsData | null;
    getSubject: (courseCode: string) => SubjectInfo | null;
    isLoaded: boolean;
}

export function useSubjects(): UseSubjectsResult {
    const [subjects, setSubjects] = useState<SubjectsData | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const loadFromStorage = async () => {
             // Load from IndexedDB
             const data = await IndexedDBService.get('subjects', 'current');

            if (data) {
                setSubjects(data);
            }
            setIsLoaded(true);
        };

        // Initial load
        loadFromStorage();

        // Subscribe to sync updates
        const unsubscribe = syncService.subscribe(() => {
            loadFromStorage();
        });

        return unsubscribe;
    }, []);

    // Helper to get a single subject by code (memoized to prevent re-renders)
    const getSubject = useCallback((courseCode: string): SubjectInfo | null => {
        if (!subjects) return null;
        return subjects.data[courseCode] || null;
    }, [subjects]);

    return { subjects, getSubject, isLoaded };
}

/**
 * useAssessments - Hook to access assessment data from storage.
 * 
 * Returns stored data immediately and subscribes to sync updates.
 */

import { useState, useEffect } from 'react';
import { syncService } from '../../services/sync';
import { IndexedDBService } from '../../services/storage';
import type { Assessment } from '../../types/documents';

export interface UseAssessmentsResult {
    assessments: Assessment[] | null;
    isLoading: boolean;
}

export function useAssessments(courseCode: string | undefined): UseAssessmentsResult {
    const [assessments, setAssessments] = useState<Assessment[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!courseCode) {
            setAssessments(null);
            setIsLoading(false);
            return;
        }

        const loadData = async () => {
             setIsLoading(true);
             try {
                 // Load from IndexedDB
                 const data = await IndexedDBService.get('assessments', courseCode);
                 
                 setAssessments(data || []);
             } catch (error) {
                 console.error('[useAssessments] Failed to load data:', error);
                 setAssessments(null); // Keep as null on error
             } finally {
                 setIsLoading(false);
             }
        };

        // Initial load
        loadData();

        // Subscribe to sync updates
        const unsubscribe = syncService.subscribe(() => {
            loadData();
        });

        return unsubscribe;
    }, [courseCode]);

    return { assessments, isLoading };
}

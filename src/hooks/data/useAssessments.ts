/**
 * useAssessments - Hook to access assessment data from storage.
 * 
 * Returns stored data immediately and subscribes to sync updates.
 */

import { useState, useEffect } from 'react';
import { syncService } from '../../services/sync';
import { StorageService, STORAGE_KEYS } from '../../services/storage';
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

        const loadFromStorage = async () => {
             const key = `${STORAGE_KEYS.SUBJECT_ASSESSMENTS_PREFIX}${courseCode}`;
            const storedAssessments = await StorageService.getAsync<Assessment[]>(key);
            setAssessments(storedAssessments);
            setIsLoading(false);
        };

        // 1. Initial load
        loadFromStorage();

        // 2. Subscribe to sync updates
        const unsubscribe = syncService.subscribe(() => {
            loadFromStorage();
        });

        return unsubscribe;
    }, [courseCode]);

    return { assessments, isLoading };
}

/**
 * useSyllabus - Hook to access syllabus data from storage.
 * 
 * Returns stored data immediately and subscribes to sync updates.
 */

import { useState, useEffect } from 'react';
import { StorageService, STORAGE_KEYS } from '../../services/storage';
import { syncService } from '../../services/sync';
import type { SyllabusRequirements } from '../../types/documents';

export interface UseSyllabusResult {
    syllabus: SyllabusRequirements | null;
    isLoading: boolean;
}

export function useSyllabus(courseCode: string | undefined): UseSyllabusResult {
    const [syllabus, setSyllabus] = useState<SyllabusRequirements | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!courseCode) {
            setSyllabus(null);
            setIsLoading(false);
            return;
        }

        const loadFromStorage = () => {
            const key = `${STORAGE_KEYS.SUBJECT_SYLLABUS_PREFIX}${courseCode}`;
            const storedSyllabus = StorageService.get<SyllabusRequirements>(key);
            
            setSyllabus(storedSyllabus);
            // Consistent with other hooks: if we checked storage, we are done "loading"
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

    return { syllabus, isLoading };
}

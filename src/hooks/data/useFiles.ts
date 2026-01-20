/**
 * useFiles - Hook to access subject files from storage.
 * 
 * Returns stored files immediately and subscribes to sync updates.
 */

import { useState, useEffect } from 'react';
import { syncService } from '../../services/sync';
import { StorageService, STORAGE_KEYS } from '../../services/storage';
import type { ParsedFile } from '../../types/documents';

export interface UseFilesResult {
    files: ParsedFile[] | null;
    isLoading: boolean;
}

export function useFiles(courseCode: string | undefined): UseFilesResult {
    const [files, setFiles] = useState<ParsedFile[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!courseCode) {
            setFiles(null);
            setIsLoading(false);
            return;
        }

        const loadFromStorage = async () => {
            const key = `${STORAGE_KEYS.SUBJECT_FILES_PREFIX}${courseCode}`;
            const storedFiles = await StorageService.getAsync<ParsedFile[]>(key);
            setFiles(storedFiles);
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

    return { files, isLoading };
}

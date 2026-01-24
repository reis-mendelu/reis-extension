/**
 * useSyllabus - Hook to access syllabus data from storage.
 * 
 * Returns stored data immediately and subscribes to sync updates.
 */

import { useState, useEffect } from 'react';
import { syncService } from '../../services/sync';
import { IndexedDBService } from '../../services/storage';
import { fetchSyllabus, findSubjectId } from '../../api/syllabus';
import type { SyllabusRequirements } from '../../types/documents';

export interface UseSyllabusResult {
    syllabus: SyllabusRequirements | null;
    isLoading: boolean;
}

export function useSyllabus(courseCode: string | undefined, courseId?: string, subjectName?: string): UseSyllabusResult {
    const [syllabus, setSyllabus] = useState<SyllabusRequirements | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!courseCode) {
            setSyllabus(null);
            setIsLoading(false);
            return;
        }

        const loadData = async () => {
             setIsLoading(true);
             try {
                 // 1. Load from IndexedDB
                 let data = await IndexedDBService.get('syllabuses', courseCode);
                 
                 // 2. Determine ID to use (prop or lookup)
                 let activeCourseId = courseId;

                 // 3. Trigger fetch if data missing
                 if (!data) {
                    // If no courseId provided, try to find it via search fallback
                    if (!activeCourseId) {
                        try {
                            const foundId = await findSubjectId(courseCode, subjectName);
                            if (foundId) {
                                activeCourseId = foundId;
                                
                                // OPTIMIZATION: Set partial syllabus immediately so the ID is available to the UI
                                // This allows the "External Link" to appear while we fetch the rest
                                setSyllabus(prev => ({
                                    ...prev,
                                    courseId: foundId,
                                    requirementsText: prev?.requirementsText || '',
                                    requirementsTable: prev?.requirementsTable || []
                                }));
                                
                                console.debug(`[useSyllabus] Found missing ID for ${courseCode}: ${foundId}`);
                            }
                        } catch (err) {
                            console.warn('[useSyllabus] ID lookup failed:', err);
                        }
                    }

                    // Proceed if we have an ID (either provided or found)
                    if (activeCourseId) {
                        console.debug(`[useSyllabus] Fetching syllabus for ${courseCode} (ID: ${activeCourseId})`);
                        try {
                            const fetchedData = await fetchSyllabus(activeCourseId);
                            if (fetchedData && (fetchedData.requirementsText || fetchedData.requirementsTable.length > 0)) {
                                await IndexedDBService.set('syllabuses', courseCode, fetchedData);
                                data = fetchedData;
                            }
                        } catch (err) {
                            console.error('[useSyllabus] Fetch failed:', err);
                        }
                    } else {
                        console.debug(`[useSyllabus] Cannot fetch syllabus for ${courseCode} - No ID available`);
                    }
                 }

                 setSyllabus(data || null);
             } catch (error) {
                 console.error('[useSyllabus] Failed to load data:', error);
                 setSyllabus(null); 
             } finally {
                 setIsLoading(false);
             }
        };

        loadData();

        // Subscribe to sync updates
        const unsubscribe = syncService.subscribe(() => {
            loadData();
        });

        return unsubscribe;
    }, [courseCode, courseId]);

    return { syllabus, isLoading };
}

/**
 * useSyllabus - Hook to access syllabus data from store cache.
 *
 * Returns data from Zustand global store.
 * Triggers fetch if missing or language mismatches.
 */

import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { SyllabusRequirements } from '../../types/documents';

export interface UseSyllabusResult {
    syllabus: SyllabusRequirements | null;
    isLoading: boolean;
}

export function useSyllabus(courseCode: string | undefined, courseId?: string, subjectName?: string): UseSyllabusResult {
    const language = useAppStore(state => state.language);
    const syllabus = useAppStore(state => (courseCode ? state.syllabuses.cache[courseCode] : null));
    const isLoading = useAppStore(state => (courseCode ? !!state.syllabuses.loading[courseCode] : false));

    useEffect(() => {
        if (courseCode) {
            useAppStore.getState().fetchSyllabus(courseCode, courseId, subjectName);
        }
    }, [courseCode, courseId, subjectName, language]);

    return { syllabus: syllabus ?? null, isLoading };
}

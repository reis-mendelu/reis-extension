import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { TermNote } from '../../api/terminyInfo';

export interface UseExamNoteResult {
    /** undefined = not yet fetched; null = fetched and no note exists; TermNote = real note. */
    note: TermNote | null | undefined;
    isLoading: boolean;
    error: string | undefined;
}

/**
 * Lazily fetches the teacher's Poznámka for a term, on mount of the consumer.
 * In-memory cache in the exam slice with a 6h TTL prevents refetches when a
 * section is collapsed and re-expanded.
 */
export function useExamNote(terminId: string | undefined): UseExamNoteResult {
    const note = useAppStore(state => (terminId ? state.examNotes[terminId] : undefined));
    const isLoading = useAppStore(state => (terminId ? !!state.examNotesLoading[terminId] : false));
    const error = useAppStore(state => (terminId ? state.examNotesError[terminId] : undefined));

    useEffect(() => {
        if (!terminId) return;
        useAppStore.getState().fetchExamNotePriority(terminId);
    }, [terminId]);

    return { note, isLoading, error };
}

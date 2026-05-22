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
 * Cache keyed by `${terminId}:${lang}` so each language is fetched once;
 * the slice applies a 6h TTL on success and a 5min backoff on error.
 *
 * Effect deps include studiumId/obdobiId because the slice silently no-ops
 * if those aren't hydrated yet — without re-running when they arrive, notes
 * would stay invisible until a manual remount.
 */
export function useExamNote(terminId: string | undefined): UseExamNoteResult {
    const language = useAppStore(state => state.language);
    const studiumId = useAppStore(state => state.studiumId);
    const obdobiId = useAppStore(state => state.obdobiId);
    const key = terminId ? `${terminId}:${language}` : undefined;
    const note = useAppStore(state => (key ? state.examNotes[key] : undefined));
    const isLoading = useAppStore(state => (key ? !!state.examNotesLoading[key] : false));
    const error = useAppStore(state => (key ? state.examNotesError[key] : undefined));

    useEffect(() => {
        if (!terminId || !studiumId || !obdobiId) return;
        useAppStore.getState().fetchExamNotePriority(terminId, language);
    }, [terminId, language, studiumId, obdobiId]);

    return { note, isLoading, error };
}

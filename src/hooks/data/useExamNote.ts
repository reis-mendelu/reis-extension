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
 * The note text is teacher-authored and not translated by IS, so we fetch
 * one canonical version (CZ) and show it regardless of UI language.
 *
 * Effect deps include studiumId/obdobiId because the slice silently no-ops
 * if those aren't hydrated yet — without re-running when they arrive, notes
 * would stay invisible until a manual remount.
 */
export function useExamNote(terminId: string | undefined): UseExamNoteResult {
    const studiumId = useAppStore(state => state.studiumId);
    const obdobiId = useAppStore(state => state.obdobiId);
    const note = useAppStore(state => (terminId ? state.examNotes[terminId] : undefined));
    const isLoading = useAppStore(state => (terminId ? !!state.examNotesLoading[terminId] : false));
    const error = useAppStore(state => (terminId ? state.examNotesError[terminId] : undefined));

    useEffect(() => {
        if (!terminId || !studiumId || !obdobiId) return;
        useAppStore.getState().fetchExamNotePriority(terminId);
    }, [terminId, studiumId, obdobiId]);

    return { note, isLoading, error };
}

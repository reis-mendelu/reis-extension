import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

/**
 * `useExamNote` for every term of a section at once: the card's single "Více"
 * can only show a note, or a length, that it has read for all of them.
 *
 * Requests go through the slice's own fetch slots and 6 h cache, so opening a
 * ten-term card reads ten pages a few at a time, once.
 */
export function useExamNotes(terminIds: string[]): void {
  const studiumId = useAppStore((state) => state.studiumId);
  const obdobiId = useAppStore((state) => state.obdobiId);
  const key = terminIds.join(',');

  useEffect(() => {
    if (!key || !studiumId || !obdobiId) return;
    const fetchNote = useAppStore.getState().fetchExamNotePriority;
    for (const id of key.split(',')) void fetchNote(id);
  }, [key, studiumId, obdobiId]);
}

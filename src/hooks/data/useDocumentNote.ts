import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { getDocumentNoteKey } from '../../store/slices/createNotesSlice';

export function useDocumentNote(courseCode: string, fileLink: string | undefined) {
    const key = fileLink ? getDocumentNoteKey(courseCode, fileLink) : '';

    const note = useAppStore(s => key ? s.documentNotes[key] : '');
    const isLoading = useAppStore(s => key ? s.documentNotesLoading[key] : false);
    const isSaving = useAppStore(s => key ? s.documentNotesSaving[key] : false);
    const hasError = useAppStore(s => key ? s.documentNotesError[key] : false);

    const fetchDocumentNote = useAppStore(s => s.fetchDocumentNote);
    const setDocumentNote = useAppStore(s => s.setDocumentNote);

    useEffect(() => {
        if (courseCode && fileLink) {
            void fetchDocumentNote(courseCode, fileLink);
        }
    }, [courseCode, fileLink, fetchDocumentNote]);

    const setNote = (value: string, fileName: string) => {
        if (courseCode && fileLink) {
            setDocumentNote(courseCode, fileLink, value, fileName);
        }
    };

    return { note: note ?? '', setNote, isLoading: key ? isLoading : false, isSaving, hasError };
}

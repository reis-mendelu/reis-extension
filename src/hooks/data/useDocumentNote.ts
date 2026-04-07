/**
 * useDocumentNote Hook
 *
 * Manages a text note per document file using IndexedDB.
 * Key format: {courseCode}:{fileLink}
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import type { DocumentNote } from '../../types/documents';

const MAX_NOTE_LENGTH = 500;
const DEBOUNCE_MS = 800;

export function getDocumentNoteKey(courseCode: string, fileLink: string): string {
    return `${courseCode}:${fileLink}`;
}

export function useDocumentNote(courseCode: string, fileLink: string | undefined) {
    const [note, setNoteState] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentKeyRef = useRef<string | undefined>(
        fileLink ? getDocumentNoteKey(courseCode, fileLink) : undefined
    );

    const noteRef = useRef(note);
    const hasChangesRef = useRef(false);

    const saveToStorage = useCallback((value: string, key: string) => {
        const op = value.trim()
            ? IndexedDBService.set('document_notes', key, { note: value, updatedAt: Date.now() })
            : IndexedDBService.delete('document_notes', key);

        op.then(() => { hasChangesRef.current = false; })
            .catch((error) => { console.warn('[useDocumentNote] Failed to save:', error); });
    }, []);

    useEffect(() => {
        const key = fileLink ? getDocumentNoteKey(courseCode, fileLink) : undefined;
        currentKeyRef.current = key;

        if (!key) {
            if (noteRef.current !== '' || isLoading) {
                setNoteState('');
                noteRef.current = '';
                hasChangesRef.current = false;
                setIsLoading(false);
            }
            return;
        }

        setIsLoading(true);

        IndexedDBService.get('document_notes', key)
            .then((data: DocumentNote | undefined) => {
                if (currentKeyRef.current !== key) return;
                const loadedNote = data?.note ?? '';
                setNoteState(loadedNote);
                noteRef.current = loadedNote;
                hasChangesRef.current = false;
                setIsLoading(false);
            })
            .catch((error) => {
                console.warn('[useDocumentNote] Failed to load:', error);
                if (currentKeyRef.current !== key) return;
                setNoteState('');
                noteRef.current = '';
                setIsLoading(false);
            });

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (hasChangesRef.current && currentKeyRef.current) {
                saveToStorage(noteRef.current, currentKeyRef.current);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseCode, fileLink, saveToStorage]);

    const setNote = useCallback((value: string) => {
        const key = fileLink ? getDocumentNoteKey(courseCode, fileLink) : undefined;
        if (!key) return;

        const truncated = value.slice(0, MAX_NOTE_LENGTH);
        setNoteState(truncated);
        noteRef.current = truncated;
        hasChangesRef.current = true;

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            saveToStorage(truncated, key);
        }, DEBOUNCE_MS);
    }, [courseCode, fileLink, saveToStorage]);

    return { note, setNote, isLoading };
}

/**
 * useSubjectNote Hook
 * 
 * Manages a simple text note per subject using chrome.storage.sync.
 * Notes sync across devices via Chrome account.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface SubjectNoteData {
    note: string;
    updatedAt: number;
}

const NOTE_KEY_PREFIX = 'note:';
const MAX_NOTE_LENGTH = 500;
const DEBOUNCE_MS = 800;

/**
 * Hook for managing a subject note with auto-save to chrome.storage.sync.
 * 
 * @param subjectCode - The subject code (e.g., "TZI", "EBC-AP")
 * @returns { note, setNote, isLoading }
 */
export function useSubjectNote(subjectCode: string | undefined) {
    const [note, setNoteState] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentSubjectRef = useRef(subjectCode);
    
    // Refs for flushing changes on unmount
    const noteRef = useRef(note);
    const hasChangesRef = useRef(false);

    // Save note to storage (debounced)
    const saveToStorage = useCallback((value: string, code: string) => {
        if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
            console.debug('[useSubjectNote] chrome.storage.sync unavailable for save');
            return;
        }

        const key = `${NOTE_KEY_PREFIX}${code}`;
        const data: SubjectNoteData = {
            note: value,
            updatedAt: Date.now(),
        };

        chrome.storage.sync.set({ [key]: data })
            .then(() => {
                console.debug('[useSubjectNote] Note saved:', { key, length: value.length });
                hasChangesRef.current = false;
            })
            .catch((error) => {
                console.warn('[useSubjectNote] Failed to save note:', error);
            });
    }, []);

    // Load note from storage
    useEffect(() => {
        // Track current subject to prevent stale updates
        currentSubjectRef.current = subjectCode;

        if (!subjectCode) {
            setNoteState('');
            noteRef.current = '';
            hasChangesRef.current = false;
            setIsLoading(false);
            return;
        }

        const key = `${NOTE_KEY_PREFIX}${subjectCode}`;
        setIsLoading(true);

        // Check if chrome.storage.sync is available
        if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
            console.debug('[useSubjectNote] chrome.storage.sync unavailable');
            setNoteState('');
            noteRef.current = '';
            setIsLoading(false);
            return;
        }

        chrome.storage.sync.get(key)
            .then((result) => {
                // Prevent stale update if subject changed during async load
                if (currentSubjectRef.current !== subjectCode) return;

                const data = result[key] as SubjectNoteData | undefined;
                const loadedNote = data?.note ?? '';
                setNoteState(loadedNote);
                noteRef.current = loadedNote;
                hasChangesRef.current = false;
                setIsLoading(false);
            })
            .catch((error) => {
                console.warn('[useSubjectNote] Failed to load note:', error);
                setNoteState('');
                noteRef.current = '';
                setIsLoading(false);
            });

        // Cleanup: flush pending changes and clear debounce
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            
            // Flush on unmount if there are unsaved changes
            if (hasChangesRef.current && currentSubjectRef.current) {
                saveToStorage(noteRef.current, currentSubjectRef.current);
            }
        };
    }, [subjectCode, saveToStorage]);

    // Set note with debounced save
    const setNote = useCallback((value: string) => {
        if (!subjectCode) return;

        // Enforce character limit
        const truncated = value.slice(0, MAX_NOTE_LENGTH);
        
        // Update local state and refs immediately
        setNoteState(truncated);
        noteRef.current = truncated;
        hasChangesRef.current = true;

        // Clear existing debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Schedule save
        debounceRef.current = setTimeout(() => {
            saveToStorage(truncated, subjectCode);
        }, DEBOUNCE_MS);
    }, [subjectCode, saveToStorage]);

    return { note, setNote, isLoading };
}

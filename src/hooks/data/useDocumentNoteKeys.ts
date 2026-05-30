/**
 * useDocumentNoteKeys Hook
 *
 * Returns the set of fileLinks that have notes for a given course.
 * Used to show note badges on file rows without loading every note.
 */

import { useState, useEffect, useCallback } from 'react';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';

export function useDocumentNoteKeys(courseCode: string) {
    const [noteKeys, setNoteKeys] = useState<Set<string>>(new Set());

    const updateKey = useCallback((fileLink: string, hasNote: boolean) => {
        setNoteKeys(prev => {
            const next = new Set(prev);
            if (hasNote) next.add(fileLink);
            else next.delete(fileLink);
            return next;
        });
    }, []);

    useEffect(() => {
        if (!courseCode) return;
        const prefix = `${courseCode}:`;

        IndexedDBService.getAllWithKeys('document_notes')
            .then((entries) => {
                const links = new Set<string>();
                for (const { key } of entries) {
                    if (key.startsWith(prefix)) {
                        links.add(key.slice(prefix.length));
                    }
                }
                setNoteKeys(links);
            })
            .catch((error) => {
                logError('useDocumentNoteKeys.load', error);
            });

        const handleNoteChange = (e: Event) => {
            const customEvent = e as CustomEvent<{ courseCode: string; fileLink: string; hasNote: boolean }>;
            if (customEvent.detail.courseCode === courseCode) {
                updateKey(customEvent.detail.fileLink, customEvent.detail.hasNote);
            }
        };

        window.addEventListener('document-note-changed', handleNoteChange);
        return () => {
            window.removeEventListener('document-note-changed', handleNoteChange);
        };
    }, [courseCode, updateKey]);

    return { noteKeys, updateKey };
}

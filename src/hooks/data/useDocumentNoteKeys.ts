/**
 * useDocumentNoteKeys Hook
 *
 * Returns the set of fileLinks that have notes for a given course.
 * Used to show note badges on file rows without loading every note.
 */

import { useState, useEffect, useCallback } from 'react';
import { IndexedDBService } from '../../services/storage/IndexedDBService';

export function useDocumentNoteKeys(courseCode: string) {
    const [noteKeys, setNoteKeys] = useState<Set<string>>(new Set());

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
                console.warn('[useDocumentNoteKeys] Failed to load:', error);
            });
    }, [courseCode]);

    const updateKey = useCallback((fileLink: string, hasNote: boolean) => {
        setNoteKeys(prev => {
            const next = new Set(prev);
            if (hasNote) next.add(fileLink);
            else next.delete(fileLink);
            return next;
        });
    }, []);

    return { noteKeys, updateKey };
}

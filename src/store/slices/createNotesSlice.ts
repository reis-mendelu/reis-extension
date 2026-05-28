import type { NotesSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';

const MAX_NOTE_LENGTH = 100000;
const DEBOUNCE_MS = 800;

const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const pendingSaves: Record<string, string> = {};
const pendingNames: Record<string, string> = {};

export function getDocumentNoteKey(courseCode: string, fileLink: string): string {
    return `${courseCode}:${fileLink}`;
}

export const createNotesSlice: AppSlice<NotesSlice> = (set, get) => {
    const saveToStorage = (key: string, value: string, courseCode: string, fileLink: string, fileName: string) => {
        set((state) => {
            const nextSaving = { ...state.documentNotesSaving, [key]: true };
            const nextError = { ...state.documentNotesError };
            delete nextError[key];
            return { documentNotesSaving: nextSaving, documentNotesError: nextError };
        });

        const op = value.trim()
            ? IndexedDBService.set('document_notes', key, { note: value, updatedAt: Date.now(), fileName })
            : IndexedDBService.delete('document_notes', key);

        op.then(() => {
            if (pendingSaves[key] === value) {
                delete pendingSaves[key];
            }
            set((state) => {
                const nextSaving = { ...state.documentNotesSaving };
                delete nextSaving[key];
                return { documentNotesSaving: nextSaving };
            });
            window.dispatchEvent(new CustomEvent('document-note-changed', {
                detail: { courseCode, fileLink, hasNote: !!value.trim() }
            }));
            void get().pushNotesSnapshot();
        })
        .catch((error) => {
            logError('useDocumentNote.save', error);
            if (pendingSaves[key] === value) {
                delete pendingSaves[key];
            }
            set((state) => {
                const nextSaving = { ...state.documentNotesSaving };
                const nextError = { ...state.documentNotesError, [key]: true };
                delete nextSaving[key];
                return { documentNotesSaving: nextSaving, documentNotesError: nextError };
            });
        });
    };

    return {
        documentNotes: {},
        documentNotesLoading: {},
        documentNotesSaving: {},
        documentNotesError: {},

        fetchDocumentNote: async (courseCode, fileLink) => {
            const key = getDocumentNoteKey(courseCode, fileLink);
            const { documentNotes, documentNotesLoading } = get();

            if (documentNotes[key] !== undefined || documentNotesLoading[key]) return;

            set((state) => ({
                documentNotesLoading: { ...state.documentNotesLoading, [key]: true }
            }));

            try {
                const data = await IndexedDBService.get('document_notes', key);
                const loadedNote = data?.note ?? '';
                set((state) => {
                    const nextNotes = { ...state.documentNotes, [key]: loadedNote };
                    const nextLoading = { ...state.documentNotesLoading };
                    delete nextLoading[key];
                    return { documentNotes: nextNotes, documentNotesLoading: nextLoading };
                });
            } catch (error) {
                logError('useDocumentNote.load', error);
                set((state) => {
                    const nextNotes = { ...state.documentNotes, [key]: '' };
                    const nextLoading = { ...state.documentNotesLoading };
                    delete nextLoading[key];
                    return { documentNotes: nextNotes, documentNotesLoading: nextLoading };
                });
            }
        },

        setDocumentNote: (courseCode, fileLink, value, fileName) => {
            const key = getDocumentNoteKey(courseCode, fileLink);
            const truncated = value.slice(0, MAX_NOTE_LENGTH);

            set((state) => ({
                documentNotes: { ...state.documentNotes, [key]: truncated },
                documentNotesSaving: { ...state.documentNotesSaving, [key]: true }
            }));

            pendingSaves[key] = truncated;
            pendingNames[key] = fileName;

            if (debounceTimers[key]) clearTimeout(debounceTimers[key]);

            debounceTimers[key] = setTimeout(() => {
                delete debounceTimers[key];
                saveToStorage(key, truncated, courseCode, fileLink, fileName);
            }, DEBOUNCE_MS);
        },

        flushDocumentNotes: () => {
            Object.keys(debounceTimers).forEach(key => {
                clearTimeout(debounceTimers[key]);
                delete debounceTimers[key];
                const value = pendingSaves[key];
                if (value !== undefined) {
                    const idx = key.indexOf(':');
                    const courseCode = key.slice(0, idx);
                    const fileLink = key.slice(idx + 1);
                    saveToStorage(key, value, courseCode, fileLink, pendingNames[key] ?? '');
                }
            });
        },

        pushNotesSnapshot: async () => {
            try {
                const entries = await IndexedDBService.getAllWithKeys('document_notes');
                const snapshot: Record<string, Record<string, { note: string; fileName: string }>> = {};
                for (const { key, value } of entries) {
                    if (!value?.note?.trim()) continue; // never ship empty notes
                    const idx = key.indexOf(':');
                    if (idx < 0) continue;
                    const courseCode = key.slice(0, idx);
                    const fileLink = key.slice(idx + 1);
                    (snapshot[courseCode] ??= {})[fileLink] = {
                        note: value.note,
                        fileName: value.fileName ?? '',
                    };
                }
                window.parent.postMessage(
                    { type: 'REIS_ACTION', id: crypto.randomUUID(), action: 'push_notes', payload: snapshot },
                    '*',
                );
            } catch (error) {
                logError('Notes.pushSnapshot', error);
            }
        }
    };
};

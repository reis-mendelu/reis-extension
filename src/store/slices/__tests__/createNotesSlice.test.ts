import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotesSlice } from '../createNotesSlice';
import type { NotesSlice } from '../../types';
import { IndexedDBService } from '../../../services/storage/IndexedDBService';

vi.mock('../../../services/storage/IndexedDBService', () => ({
    IndexedDBService: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        getAllWithKeys: vi.fn().mockResolvedValue([])
    }
}));

describe('createNotesSlice', () => {
    let state: NotesSlice;
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        set = vi.fn((updater) => {
            const patch = typeof updater === 'function' ? updater(state) : updater;
            state = { ...state, ...patch };
        });
        get = vi.fn(() => state);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state = createNotesSlice(set, get, {} as any);
    });

    it('initializes with empty maps', () => {
        expect(state.documentNotes).toEqual({});
        expect(state.documentNotesLoading).toEqual({});
        expect(state.documentNotesSaving).toEqual({});
        expect(state.documentNotesError).toEqual({});
    });

    it('fetches a note successfully', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValueOnce({ note: 'My Test Note', updatedAt: 123 });
        
        const promise = state.fetchDocumentNote('FIT_INF', 'doc1.pdf');
        
        expect(state.documentNotesLoading['FIT_INF:doc1.pdf']).toBe(true);
        
        await promise;
        
        expect(state.documentNotes['FIT_INF:doc1.pdf']).toBe('My Test Note');
        expect(state.documentNotesLoading['FIT_INF:doc1.pdf']).toBeUndefined();
        expect(IndexedDBService.get).toHaveBeenCalledWith('document_notes', 'FIT_INF:doc1.pdf');
    });

    it('handles fetch failure gracefully', async () => {
        vi.mocked(IndexedDBService.get).mockRejectedValueOnce(new Error('DB Error'));
        
        await state.fetchDocumentNote('FIT_INF', 'doc1.pdf');
        
        expect(state.documentNotes['FIT_INF:doc1.pdf']).toBe('');
        expect(state.documentNotesLoading['FIT_INF:doc1.pdf']).toBeUndefined();
    });

    it('sets and saves note with debounce', async () => {
        vi.useFakeTimers();
        vi.mocked(IndexedDBService.set).mockResolvedValueOnce(undefined);

        state.setDocumentNote('FIT_INF', 'doc1.pdf', 'Updated Note', 'doc1.pdf');

        expect(state.documentNotes['FIT_INF:doc1.pdf']).toBe('Updated Note');
        expect(state.documentNotesSaving['FIT_INF:doc1.pdf']).toBe(true);

        vi.advanceTimersByTime(800);

        expect(IndexedDBService.set).toHaveBeenCalledWith('document_notes', 'FIT_INF:doc1.pdf', expect.objectContaining({
            note: 'Updated Note'
        }));

        await new Promise(process.nextTick);

        expect(state.documentNotesSaving['FIT_INF:doc1.pdf']).toBeUndefined();
        vi.useRealTimers();
    });

    it('persists fileName alongside the note', async () => {
        vi.useFakeTimers();
        vi.mocked(IndexedDBService.set).mockResolvedValueOnce(undefined);

        state.setDocumentNote('BIK-DBS', '/auth/dok/1', 'hello', 'Lecture 1.pdf');

        await vi.advanceTimersByTimeAsync(900); // past DEBOUNCE_MS

        expect(IndexedDBService.set).toHaveBeenCalledWith(
            'document_notes',
            'BIK-DBS:/auth/dok/1',
            expect.objectContaining({ note: 'hello', fileName: 'Lecture 1.pdf' }),
        );
        vi.useRealTimers();
    });

    it('pushNotesSnapshot posts a grouped REIS_ACTION:push_notes to the parent', async () => {
        vi.mocked(IndexedDBService.getAllWithKeys).mockResolvedValueOnce([
            { key: 'BIK-DBS:/auth/dok/1', value: { note: 'hi', updatedAt: 1, fileName: 'L1.pdf' } },
            { key: 'BIK-DBS:/auth/dok/2', value: { note: '   ', updatedAt: 1, fileName: 'L2.pdf' } }, // empty → skipped
            { key: 'EBC-AJ:/auth/dok/9', value: { note: 'ok', updatedAt: 1, fileName: 'U.pdf' } },
        ]);
        const postSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});

        await state.pushNotesSnapshot();

        expect(postSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'REIS_ACTION',
                action: 'push_notes',
                payload: {
                    'BIK-DBS': { '/auth/dok/1': { note: 'hi', fileName: 'L1.pdf' } },
                    'EBC-AJ': { '/auth/dok/9': { note: 'ok', fileName: 'U.pdf' } },
                },
            }),
            '*',
        );
    });
});

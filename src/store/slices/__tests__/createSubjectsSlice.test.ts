import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSubjectsSlice } from '../createSubjectsSlice';
import { IndexedDBService } from '../../../services/storage';

// Mock IndexedDB
vi.mock('../../../services/storage', () => ({
    IndexedDBService: {
        get: vi.fn(),
        set: vi.fn()
    }
}));

describe('createSubjectsSlice', () => {
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;
    let slice: ReturnType<typeof createSubjectsSlice>;

    beforeEach(() => {
        vi.clearAllMocks();
        set = vi.fn((fn) => {
            const result = typeof fn === 'function' ? fn({ subjects: null, subjectsLoading: false }) : fn;
            Object.assign(slice, result);
        });
        get = vi.fn(() => slice);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slice = createSubjectsSlice(set, get, {} as unknown as any);
    });

    it('should initialize with default state', () => {
        expect(slice.subjects).toBeNull();
        expect(slice.subjectsLoading).toBe(false);
    });

    it('should fetch subjects from IndexedDB', async () => {
        const mockSubjects = { version: 1, lastUpdated: 'now', data: {} };
        vi.mocked(IndexedDBService.get).mockResolvedValue(mockSubjects);

        await slice.fetchSubjects();

        expect(IndexedDBService.get).toHaveBeenCalledWith('subjects', 'current');
        expect(slice.subjects).toEqual(mockSubjects);
        expect(slice.subjectsLoading).toBe(false);
    });

    it('should handle fetch errors', async () => {
        vi.mocked(IndexedDBService.get).mockRejectedValue(new Error('DB Error'));

        await slice.fetchSubjects();

        expect(slice.subjectsLoading).toBe(false);
        expect(slice.subjects).toBeNull();
    });
});

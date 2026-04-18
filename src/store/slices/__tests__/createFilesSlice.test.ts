import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFilesSlice } from '../createFilesSlice';
import { IndexedDBService } from '../../../services/storage';

// Mock IndexedDB
vi.mock('../../../services/storage', () => ({
    IndexedDBService: {
        get: vi.fn(),
        set: vi.fn()
    }
}));

describe('createFilesSlice', () => {
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;
    let slice: ReturnType<typeof createFilesSlice>;

    beforeEach(() => {
        vi.clearAllMocks();
        set = vi.fn((fn) => {
            const result = typeof fn === 'function' ? fn({ files: {}, filesLoading: {} }) : fn;
            Object.assign(slice, result);
        });

        get = vi.fn(() => slice);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slice = createFilesSlice(set, get, {} as unknown as any);
    });

    it('should initialize with default state', () => {
        expect(slice.files).toEqual({});
        expect(slice.filesLoading).toEqual({});
    });

    it('should fetch files for a subject', async () => {
        const mockFiles = [{ file_name: 'test.pdf' }];
        vi.mocked(IndexedDBService.get).mockResolvedValue(mockFiles);

        await slice.fetchFiles('ALG');

        expect(IndexedDBService.get).toHaveBeenCalledWith('files', 'ALG');
        expect(slice.files['ALG']).toEqual(mockFiles);
        expect(slice.filesLoading['ALG']).toBe(false);
    });

    it('should set filesLoading to true synchronously before resolving', () => {
        vi.mocked(IndexedDBService.get).mockReturnValue(new Promise(() => {})); // never resolves

        slice.fetchFiles('ALG'); // intentionally not awaited

        expect(slice.filesLoading['ALG']).toBe(true);
    });

    it('should handle fetch errors', async () => {
        vi.mocked(IndexedDBService.get).mockRejectedValue(new Error('DB Error'));

        await slice.fetchFiles('ALG');

        expect(slice.filesLoading['ALG']).toBe(false);
        expect(slice.files['ALG']).toEqual([]);
    });

    it('should use filesLoading for priority fetch', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue(null);

        const promise = slice.fetchFilesPriority('ALG');

        // Loading flag set synchronously
        expect(slice.filesLoading['ALG']).toBe(true);

        await promise;
        // Loading cleared after completion
        expect(slice.filesLoading['ALG']).toBe(false);
    });
});



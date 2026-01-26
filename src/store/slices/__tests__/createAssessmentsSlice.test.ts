import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAssessmentsSlice } from '../createAssessmentsSlice';
import { IndexedDBService } from '../../../services/storage';

// Mock IndexedDB
vi.mock('../../../services/storage', () => ({
    IndexedDBService: {
        get: vi.fn(),
        set: vi.fn()
    }
}));

describe('createAssessmentsSlice', () => {
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;
    let slice: ReturnType<typeof createAssessmentsSlice>;

    beforeEach(() => {
        vi.clearAllMocks();
        set = vi.fn((fn) => {
            const result = typeof fn === 'function' ? fn({ assessments: {}, assessmentsLoading: {} }) : fn;
            Object.assign(slice, result);
        });
        get = vi.fn(() => slice);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slice = createAssessmentsSlice(set, get, {} as unknown as any);
    });

    it('should initialize with default state', () => {
        expect(slice.assessments).toEqual({});
        expect(slice.assessmentsLoading).toEqual({});
    });

    it('should fetch assessments for a subject', async () => {
        const mockAssessments = [{ name: 'Test', score: 10 }];
        vi.mocked(IndexedDBService.get).mockResolvedValue(mockAssessments);

        await slice.fetchAssessments('ALG');

        expect(IndexedDBService.get).toHaveBeenCalledWith('assessments', 'ALG');
        expect(slice.assessments['ALG']).toEqual(mockAssessments);
        expect(slice.assessmentsLoading['ALG']).toBe(false);
    });

    it('should handle fetch errors', async () => {
        vi.mocked(IndexedDBService.get).mockRejectedValue(new Error('DB Error'));

        await slice.fetchAssessments('ALG');

        expect(slice.assessmentsLoading['ALG']).toBe(false);
        expect(slice.assessments['ALG']).toBeUndefined();
    });
});

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

/**
 * The rates start coming down as soon as the SUBJECTS land, not when the plan
 * does.
 *
 * Reported as "clicking on subjects for the first time doesn't show the list of
 * subject success rates immediately". The batch was triggered from one place —
 * `fetchStudyPlan` — so on a first run the fetch could not start until a full
 * sync had written the study plan, and each subject is its own file on the CDN.
 * The subjects arrive earlier and are what the screen is listing, so they are
 * the honest trigger for the rates that go on their rows.
 *
 * Not awaited, rejection swallowed, exactly as the study-plan trigger is: the
 * rates are a chip on a row, and the subject list is the screen.
 */
describe('createSubjectsSlice prefetching the rates', () => {
    it('asks for the rates of every subject it just loaded', async () => {
        const fetchSuccessRateBatch = vi.fn().mockResolvedValue(undefined);
        const set2 = vi.fn();
        const slice2 = createSubjectsSlice(
            set2,
            (() => ({ subjects: null, fetchSuccessRateBatch })) as never,
            {} as never
        );
        vi.mocked(IndexedDBService.get).mockImplementation(async (store: string) =>
            store === 'subjects'
                ? { version: 1, lastUpdated: 'now', data: { ALG: {}, 'EBC-PS': {} } }
                : undefined
        );

        await slice2.fetchSubjects();

        expect(fetchSuccessRateBatch).toHaveBeenCalledWith(['ALG', 'EBC-PS']);
    });

    it('asks for nothing when there are no subjects', async () => {
        const fetchSuccessRateBatch = vi.fn().mockResolvedValue(undefined);
        const slice2 = createSubjectsSlice(
            vi.fn(),
            (() => ({ subjects: null, fetchSuccessRateBatch })) as never,
            {} as never
        );
        vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);

        await slice2.fetchSubjects();

        expect(fetchSuccessRateBatch).not.toHaveBeenCalled();
    });
});

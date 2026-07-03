import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFeedbackSlice } from '../createFeedbackSlice';
import { IndexedDBService } from '../../../services/storage';

vi.mock('../../../services/storage', () => ({
    IndexedDBService: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock('../../../api/feedback', () => ({
    submitFeedback: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../utils/userParams', () => ({
    getUserParams: vi.fn().mockResolvedValue({
        studentId: 'stu123',
        facultyId: 'fac1',
        obdobi: '2026S',
        studySemester: 4,
    }),
}));

describe('createFeedbackSlice', () => {
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;
    let slice: ReturnType<typeof createFeedbackSlice>;

    beforeEach(() => {
        vi.clearAllMocks();
        set = vi.fn((fn) => {
            const result = typeof fn === 'function'
                ? fn({ feedbackEligible: false, feedbackDismissed: false })
                : fn;
            Object.assign(slice, result);
        });
        get = vi.fn(() => slice);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slice = createFeedbackSlice(set, get, {} as unknown as any);
    });

    it('should initialize with default state', () => {
        expect(slice.feedbackEligible).toBe(false);
        expect(slice.feedbackDismissed).toBe(false);
    });

    it('should init sessionsUntilEligible on first load (no record)', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);

        await slice.loadFeedbackState();

        expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'reis_feedback', {
            sessionsUntilEligible: 2,
        });
        expect(slice.feedbackEligible).toBe(false);
    });

    it('should decrement sessionsUntilEligible on subsequent loads', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue({
            sessionsUntilEligible: 2,
        });

        await slice.loadFeedbackState();

        expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'reis_feedback', {
            sessionsUntilEligible: 1,
        });
        expect(slice.feedbackEligible).toBe(false);
    });

    it('should become eligible when sessionsUntilEligible reaches 0', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue({
            sessionsUntilEligible: 0,
        });

        await slice.loadFeedbackState();

        expect(slice.feedbackEligible).toBe(true);
    });

    it('should stay dismissed if NPS already submitted this semester', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue({
            npsSubmittedSemester: '2026S',
            sessionsUntilEligible: 0,
        });

        await slice.loadFeedbackState();

        expect(slice.feedbackEligible).toBe(false);
        expect(slice.feedbackDismissed).toBe(true);
    });

    it('should stay dismissed if dismissed this semester', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue({
            dismissedSemester: '2026S',
            sessionsUntilEligible: 0,
        });

        await slice.loadFeedbackState();

        expect(slice.feedbackEligible).toBe(false);
        expect(slice.feedbackDismissed).toBe(true);
    });

    it('submitNps should call API and persist to IndexedDB', async () => {
        const { submitFeedback } = await import('../../../api/feedback');
        vi.mocked(IndexedDBService.get).mockResolvedValue({ sessionsUntilEligible: 0 });

        await slice.submitNps(4);

        expect(submitFeedback).toHaveBeenCalledWith('stu123', 'nps', '4', '2026S');
        expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'reis_feedback', expect.objectContaining({
            npsSubmittedSemester: '2026S',
        }));
        expect(slice.feedbackEligible).toBe(false);
        expect(slice.feedbackDismissed).toBe(true);
    });

    it('dismissFeedback should persist dismissedSemester', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue({ sessionsUntilEligible: 0 });

        await slice.dismissFeedback();

        expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'reis_feedback', expect.objectContaining({
            dismissedSemester: '2026S',
        }));
        expect(slice.feedbackEligible).toBe(false);
        expect(slice.feedbackDismissed).toBe(true);
    });
});

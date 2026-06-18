import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStudyPlanSlice } from '../createStudyPlanSlice';
import type { DualLanguageStudyPlan, StudyStats } from '../../../types/studyPlan';

vi.mock('../../../services/storage', () => ({
    IndexedDBService: { get: vi.fn(), set: vi.fn() },
}));

const dualPlan = { cz: { semesters: [] }, en: { semesters: [] } } as unknown as DualLanguageStudyPlan;
const stats = { totalCredits: 42 } as unknown as StudyStats;

describe('createStudyPlanSlice setters', () => {
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;
    let slice: ReturnType<typeof createStudyPlanSlice>;

    beforeEach(() => {
        set = vi.fn((fn) => {
            const result = typeof fn === 'function' ? fn(slice) : fn;
            Object.assign(slice, result);
        });
        get = vi.fn(() => slice);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slice = createStudyPlanSlice(set, get, {} as unknown as any);
    });

    it('setStudyPlan stores the dual-language plan and marks it loaded', () => {
        slice.setStudyPlan(dualPlan);
        expect(slice.studyPlanDual).toBe(dualPlan);
        expect(slice.studyPlanLoaded).toBe(true);
    });

    it('setStudyStats stores the stats', () => {
        slice.setStudyStats(stats);
        expect(slice.studyStats).toBe(stats);
    });

    it('setStudyStats ignores a null/undefined push (keeps prior stats)', () => {
        slice.setStudyStats(stats);
        slice.setStudyStats(null as unknown as StudyStats);
        expect(slice.studyStats).toBe(stats);
    });
});

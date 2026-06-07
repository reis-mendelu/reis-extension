import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createScheduleSlice } from '../createScheduleSlice';
import type { BlockLesson } from '../../../types/calendarTypes';

vi.mock('../../../services/storage', () => ({
    IndexedDBService: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

const lesson = (id: string) => ({ id } as unknown as BlockLesson);

describe('createScheduleSlice.setSchedule', () => {
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;
    let slice: ReturnType<typeof createScheduleSlice>;

    beforeEach(() => {
        set = vi.fn((fn) => {
            const result = typeof fn === 'function' ? fn(slice) : fn;
            Object.assign(slice, result);
        });
        get = vi.fn(() => slice);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slice = createScheduleSlice(set, get, {} as unknown as any);
    });

    it('replaces schedule with incoming non-empty data', () => {
        slice.setSchedule([lesson('a')]);
        expect(slice.schedule.data).toEqual([lesson('a')]);
    });

    it('does NOT wipe populated schedule when incoming is empty (gap guard)', () => {
        slice.setSchedule([lesson('a'), lesson('b')]);
        slice.setSchedule([]);
        expect(slice.schedule.data).toHaveLength(2);
    });

    it('accepts an empty array when the store is already empty', () => {
        slice.setSchedule([]);
        expect(slice.schedule.data).toEqual([]);
    });
});

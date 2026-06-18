import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSubjectsSlice } from '../createSubjectsSlice';
import { IndexedDBService } from '../../../services/storage';

// Mock IndexedDB
vi.mock('../../../services/storage', () => ({
    IndexedDBService: {
        get: vi.fn(),
        set: vi.fn(() => Promise.resolve())
    }
}));

describe('createSubjectsSlice', () => {
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;
    let slice: ReturnType<typeof createSubjectsSlice>;

    beforeEach(() => {
        vi.clearAllMocks();
        set = vi.fn((fn) => {
            const result = typeof fn === 'function' ? fn(slice) : fn;
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

    describe('setSubjects', () => {
        const subjects = (codes: string[]) => ({
            version: 1,
            lastUpdated: 'now',
            data: Object.fromEntries(codes.map(c => [c, { code: c }])),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;

        it('replaces subjects with incoming populated data', () => {
            slice.setSubjects(subjects(['ABC']));
            expect(Object.keys(slice.subjects!.data)).toEqual(['ABC']);
        });

        it('does NOT wipe populated subjects when incoming is empty/null (gap guard)', () => {
            slice.setSubjects(subjects(['ABC', 'DEF']));
            slice.setSubjects(null);
            expect(Object.keys(slice.subjects!.data)).toHaveLength(2);
            slice.setSubjects(subjects([]));
            expect(Object.keys(slice.subjects!.data)).toHaveLength(2);
        });
    });

    describe('setAttendance', () => {
        const att = { ABC: [{ date: '1.1.' }] } as unknown as Parameters<typeof slice.setAttendance>[0];

        it('stores incoming attendance', () => {
            slice.setAttendance(att);
            expect(slice.attendance).toEqual(att);
        });

        it('does NOT wipe populated attendance when incoming is empty (gap guard)', () => {
            slice.setAttendance(att);
            slice.setAttendance({});
            expect(Object.keys(slice.attendance)).toHaveLength(1);
        });
    });

    describe('setPastAttendance', () => {
        const att = { ABC: [{ date: '1.1.' }] } as unknown as Parameters<typeof slice.setPastAttendance>[0];

        it('does NOT wipe populated past attendance when incoming is empty (gap guard)', () => {
            slice.setPastAttendance(att);
            slice.setPastAttendance({});
            expect(Object.keys(slice.pastAttendance)).toHaveLength(1);
        });
    });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarData } from '../useCalendarData';
import { useSchedule, useExams } from '../../../hooks/data';
import { useAppStore } from '../../../store/useAppStore';
import type { UseScheduleResult } from '../../../hooks/data/useSchedule';

// Mock the hooks
vi.mock('../../../hooks/data', () => ({
    useSchedule: vi.fn(),
    useExams: vi.fn(),
}));

vi.mock('../../../store/useAppStore', () => ({
    useAppStore: vi.fn(),
}));

describe('useCalendarData', () => {
    const mockInitialDate = new Date(2026, 1, 12); // Thursday, Feb 12, 2026

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock implementations
        vi.mocked(useSchedule).mockReturnValue({ schedule: [], isLoaded: true, weekStart: null, status: 'success', isSyncing: false } as UseScheduleResult);
        vi.mocked(useExams).mockReturnValue({ exams: [], isLoaded: true, error: null, lastSync: null, retry: () => {} });
        vi.mocked(useAppStore).mockImplementation((selector: any) => selector({
            language: 'cz',
            syncStatus: { handshakeDone: true, handshakeTimedOut: false, isSyncing: false },
            customEvents: [],
            hiddenItems: { events: [], courses: [] },
            teachingWeekData: null,
        }));
    });

    it('should show skeleton when no data is loaded and status is not success', () => {
        vi.mocked(useSchedule).mockReturnValue({ schedule: [], isLoaded: false, weekStart: null, status: 'loading', isSyncing: false } as UseScheduleResult);
        vi.mocked(useExams).mockReturnValue({ exams: [], isLoaded: false, error: null, lastSync: null, retry: () => {} });

        const { result } = renderHook(() => useCalendarData(mockInitialDate));
        expect(result.current.showSkeleton).toBe(true);
    });

    it('should NOT show skeleton when data is empty but already loaded successfully', () => {
        // This is the core of the fix: empty schedule + isLoaded should not show skeleton
        vi.mocked(useSchedule).mockReturnValue({ schedule: [], isLoaded: true, weekStart: null, status: 'success', isSyncing: false } as UseScheduleResult);
        vi.mocked(useExams).mockReturnValue({ exams: [], isLoaded: true, error: null, lastSync: null, retry: () => {} });

        const { result } = renderHook(() => useCalendarData(mockInitialDate));
        expect(result.current.showSkeleton).toBe(false);
    });

    it('should NOT show skeleton when data is empty but we are re-fetching (status loading, but schedule exists)', () => {
        // Data exists from previous fetch
        vi.mocked(useSchedule).mockReturnValue({ schedule: [{ id: '1', date: '20260212', startTime: '10:00', endTime: '11:00', courseName: 'Test' } as any], isLoaded: true, weekStart: null, status: 'loading', isSyncing: false } as UseScheduleResult);

        const { result } = renderHook(() => useCalendarData(mockInitialDate));
        expect(result.current.showSkeleton).toBe(false);
    });

    it('should properly group lessons by day', () => {
        const mockLessons = [
            { id: '1', date: '20260209', startTime: '08:00', endTime: '09:00', courseName: 'Monday Lesson' }, // Monday
            { id: '2', date: '20260212', startTime: '10:00', endTime: '11:00', courseName: 'Thursday Lesson' }, // Thursday
        ];
        vi.mocked(useSchedule).mockReturnValue({ schedule: mockLessons as any, isLoaded: true, weekStart: null, status: 'success', isSyncing: false } as UseScheduleResult);

        const { result } = renderHook(() => useCalendarData(mockInitialDate));

        expect(result.current.lessonsByDay[0]).toHaveLength(1); // Monday
        expect(result.current.lessonsByDay[3]).toHaveLength(1); // Thursday
        expect(result.current.lessonsByDay[0][0].courseName).toBe('Monday Lesson');
        expect(result.current.lessonsByDay[3][0].courseName).toBe('Thursday Lesson');
    });

    it('should update localization when language changes', () => {
        // Start with CZ
        vi.mocked(useAppStore).mockImplementation((selector: any) => selector({
            language: 'cz',
            syncStatus: { handshakeDone: true, handshakeTimedOut: false, isSyncing: false },
            customEvents: [],
            hiddenItems: { events: [], courses: [] },
            teachingWeekData: null,
        }));
        const { result, rerender } = renderHook(() => useCalendarData(mockInitialDate));
        expect(result.current.weekDates[0].weekday).toBe('po'); // Short for Pondělí

        // Switch to EN
        vi.mocked(useAppStore).mockImplementation((selector: any) => selector({
            language: 'en',
            syncStatus: { handshakeDone: true, handshakeTimedOut: false, isSyncing: false },
            customEvents: [],
            hiddenItems: { events: [], courses: [] },
            teachingWeekData: null,
        }));
        rerender();
        expect(result.current.weekDates[0].weekday).toBe('Mon');
    });
});

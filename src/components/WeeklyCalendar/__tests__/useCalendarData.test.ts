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
    vi.mocked(useSchedule).mockReturnValue({
      schedule: [],
      isLoaded: true,
      weekStart: null,
      status: 'success',
      isSyncing: false,
    } as UseScheduleResult);
    vi.mocked(useExams).mockReturnValue({
      exams: [],
      isLoaded: true,
      error: null,
      lastSync: null,
      retry: () => {},
    });
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector({
        language: 'cz',
        syncStatus: { handshakeDone: true, handshakeTimedOut: false, isSyncing: false },
        customEvents: [],
        hiddenItems: { events: [], courses: [] },
        teachingWeekData: null,
      })
    );
  });

  it('should show skeleton when no data is loaded and status is not success', () => {
    vi.mocked(useSchedule).mockReturnValue({
      schedule: [],
      isLoaded: false,
      weekStart: null,
      status: 'loading',
      isSyncing: false,
    } as UseScheduleResult);
    vi.mocked(useExams).mockReturnValue({
      exams: [],
      isLoaded: false,
      error: null,
      lastSync: null,
      retry: () => {},
    });

    const { result } = renderHook(() => useCalendarData(mockInitialDate));
    expect(result.current.showSkeleton).toBe(true);
  });

  it('should NOT show skeleton when data is empty but already loaded successfully', () => {
    // This is the core of the fix: empty schedule + isLoaded should not show skeleton
    vi.mocked(useSchedule).mockReturnValue({
      schedule: [],
      isLoaded: true,
      weekStart: null,
      status: 'success',
      isSyncing: false,
    } as UseScheduleResult);
    vi.mocked(useExams).mockReturnValue({
      exams: [],
      isLoaded: true,
      error: null,
      lastSync: null,
      retry: () => {},
    });

    const { result } = renderHook(() => useCalendarData(mockInitialDate));
    expect(result.current.showSkeleton).toBe(false);
  });

  it('should NOT show skeleton when data is empty but we are re-fetching (status loading, but schedule exists)', () => {
    // Data exists from previous fetch
    vi.mocked(useSchedule).mockReturnValue({
      schedule: [
        {
          id: '1',
          date: '20260212',
          startTime: '10:00',
          endTime: '11:00',
          courseName: 'Test',
        } as any,
      ],
      isLoaded: true,
      weekStart: null,
      status: 'loading',
      isSyncing: false,
    } as UseScheduleResult);

    const { result } = renderHook(() => useCalendarData(mockInitialDate));
    expect(result.current.showSkeleton).toBe(false);
  });

  it('should properly group lessons by day', () => {
    const mockLessons = [
      {
        id: '1',
        date: '20260209',
        startTime: '08:00',
        endTime: '09:00',
        courseName: 'Monday Lesson',
      }, // Monday
      {
        id: '2',
        date: '20260212',
        startTime: '10:00',
        endTime: '11:00',
        courseName: 'Thursday Lesson',
      }, // Thursday
      {
        id: '3',
        date: '20260214',
        startTime: '12:00',
        endTime: '13:00',
        courseName: 'Saturday Lesson',
      }, // Saturday
    ];
    vi.mocked(useSchedule).mockReturnValue({
      schedule: mockLessons as any,
      isLoaded: true,
      weekStart: null,
      status: 'success',
      isSyncing: false,
    } as UseScheduleResult);

    const { result } = renderHook(() => useCalendarData(mockInitialDate));

    expect(result.current.weekDates).toHaveLength(7);
    expect(result.current.lessonsByDay).toHaveLength(7);
    expect(result.current.lessonsByDay[0]).toHaveLength(1); // Monday
    expect(result.current.lessonsByDay[3]).toHaveLength(1); // Thursday
    expect(result.current.lessonsByDay[5]).toHaveLength(1); // Saturday
    expect(result.current.lessonsByDay[0][0].courseName).toBe('Monday Lesson');
    expect(result.current.lessonsByDay[3][0].courseName).toBe('Thursday Lesson');
    expect(result.current.lessonsByDay[5][0].courseName).toBe('Saturday Lesson');
  });

  it('should update localization when language changes', () => {
    // Start with CZ
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector({
        language: 'cz',
        syncStatus: { handshakeDone: true, handshakeTimedOut: false, isSyncing: false },
        customEvents: [],
        hiddenItems: { events: [], courses: [] },
        teachingWeekData: null,
      })
    );
    const { result, rerender } = renderHook(() => useCalendarData(mockInitialDate));
    expect(result.current.weekDates[0].weekday).toBe('po'); // Short for Pondělí

    // Switch to EN
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector({
        language: 'en',
        syncStatus: { handshakeDone: true, handshakeTimedOut: false, isSyncing: false },
        customEvents: [],
        hiddenItems: { events: [], courses: [] },
        teachingWeekData: null,
      })
    );
    rerender();
    expect(result.current.weekDates[0].weekday).toBe('Mon');
  });
});

describe('useCalendarData exam duration', () => {
  const thursdayFeb12 = new Date(2026, 1, 12);

  const examWith = (durationMinutes?: number) => [
    {
      version: 1 as const,
      id: 'SUB',
      name: 'Hospodářská politika',
      code: 'EBC-HP',
      sections: [
        {
          id: 'sec-1',
          name: 'zkouška',
          type: 'zkouška',
          status: 'registered' as const,
          registeredTerm: {
            id: '339715',
            date: '12.02.2026',
            time: '09:45',
            room: '5.28',
            teacher: 'Ing. Jan Novák, Ph.D.',
            ...(durationMinutes !== undefined ? { durationMinutes } : {}),
          },
          terms: [],
        },
      ],
    },
  ];

  const renderWithExam = (durationMinutes?: number) => {
    vi.clearAllMocks();
    vi.mocked(useSchedule).mockReturnValue({
      schedule: [],
      isLoaded: true,
      weekStart: null,
      status: 'success',
      isSyncing: false,
    } as UseScheduleResult);
    vi.mocked(useExams).mockReturnValue({
      exams: examWith(durationMinutes) as any,
      isLoaded: true,
      error: null,
      lastSync: null,
      retry: () => {},
    });
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector({
        language: 'cz',
        syncStatus: { handshakeDone: true, handshakeTimedOut: false, isSyncing: false },
        customEvents: [],
        hiddenItems: { events: [], courses: [] },
        teachingWeekData: null,
      })
    );
    const { result } = renderHook(() => useCalendarData(thursdayFeb12));
    return result.current.scheduleData.find((l: any) => l.isExam);
  };

  it('ends a 10-minute oral exam at 09:55, not 11:15', () => {
    const exam = renderWithExam(10);
    expect(exam?.startTime).toBe('09:45');
    expect(exam?.endTime).toBe('09:55');
  });

  it('honours a longer written exam', () => {
    expect(renderWithExam(180)?.endTime).toBe('12:45');
  });

  it('falls back to 90 minutes when IS published no duration', () => {
    expect(renderWithExam(undefined)?.endTime).toBe('11:15');
  });
});

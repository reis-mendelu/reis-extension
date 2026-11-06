import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LessonWithRow } from '../../types/calendarTypes';

vi.mock('../../hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('../../hooks/ui/useHintStatus', () => ({
  useHintStatus: () => ({ isSeen: true, markSeen: vi.fn() }),
}));
vi.mock('../../hooks/ui/useCourseName', () => ({ useCourseName: (_c?: string, n?: string) => n }));

import { CalendarEventCard } from '../CalendarEventCard';

const lesson = (extra: Partial<LessonWithRow> = {}): LessonWithRow =>
  ({
    id: 'l1',
    date: '20261029',
    startTime: '09:00',
    endTime: '10:50',
    courseName: 'Veřejné finance 1',
    courseCode: 'EBC-VF1',
    isSeminar: 'true',
    room: 'Q02',
    teachers: [],
    row: 1,
    maxColumns: 2,
    renderedMinutes: 110,
    ...extra,
  }) as unknown as LessonWithRow;

/**
 * Suggestion #43: a student retaking only the exam wants every seminar option
 * off the timetable — and seminar options are exactly the lessons that run at
 * the same time as each other. A lesson in a clash (`maxColumns > 1`) had no
 * hide menu, so it could never be hidden on the extension (2026-11-06).
 */
describe('CalendarEventCard in a clash', () => {
  it('still offers the hide menu', () => {
    render(<CalendarEventCard lesson={lesson()} />);
    expect(screen.getByText('Skrýt všechna cvičení')).toBeInTheDocument();
  });

  it('but not on an exam or an own event', () => {
    const { unmount } = render(<CalendarEventCard lesson={lesson({ isExam: true })} />);
    expect(screen.queryByText('Skrýt všechna cvičení')).toBeNull();
    unmount();
    render(<CalendarEventCard lesson={lesson({ isCustom: true })} />);
    expect(screen.queryByText('Skrýt všechna cvičení')).toBeNull();
  });
});

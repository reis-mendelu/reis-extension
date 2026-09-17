import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LessonWithRow } from '../../types/calendarTypes';

vi.mock('../../hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('../../hooks/ui/useHintStatus', () => ({ useHintStatus: () => ({ seen: true }) }));
vi.mock('../../hooks/ui/useCourseName', () => ({ useCourseName: (_c?: string, n?: string) => n }));

import { CalendarEventCard } from '../CalendarEventCard';

const lesson = (renderedMinutes: number): LessonWithRow =>
  ({
    id: 'l1',
    date: '20260918',
    startTime: '14:00',
    endTime: '14:50',
    courseName: 'Cvičení',
    courseCode: 'EBC-CV',
    room: 'Q01',
    teachers: [],
    row: 0,
    maxColumns: 1,
    renderedMinutes,
  }) as unknown as LessonWithRow;

/**
 * A block only draws what it has room for.
 *
 * Two stacked lines need about 56px — 20 for the title, 20 for the room-and-time
 * row, 16 of padding — and the grid is fourteen hours tall, so on a normal
 * desktop window 60 minutes is about 41px. The old gate was `>= 60` MINUTES,
 * which drew the second line anyway and let `overflow-hidden` slice it in half.
 * Measured on the real grid: content bottom 525 against a clip line at 516.
 *
 * It showed on any 60-to-89-minute lesson, and became the common case once a
 * short block started being capped at whatever follows it.
 */
describe('CalendarEventCard in a short block', () => {
  it('drops to one line with the time, and no room', () => {
    render(<CalendarEventCard lesson={lesson(60)} />);

    expect(screen.getByText('Cvičení')).toBeInTheDocument();
    expect(screen.getByText('14:00 - 14:50')).toBeInTheDocument();
    // The room is the part that goes: the tooltip and the subject drawer both
    // still carry it, and something has to give at 41 pixels.
    expect(screen.queryByText('Q01')).toBeNull();
  });

  it('keeps both lines once the block is tall enough to hold them', () => {
    render(<CalendarEventCard lesson={lesson(90)} />);

    // getAllBy: the hover menu that comes back with the second line repeats the
    // course name in its own header.
    expect(screen.getAllByText('Cvičení').length).toBeGreaterThan(0);
    expect(screen.getByText('Q01')).toBeInTheDocument();
    expect(screen.getByText('14:00 - 14:50')).toBeInTheDocument();
  });
});

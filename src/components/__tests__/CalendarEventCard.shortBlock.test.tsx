import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LessonWithRow } from '../../types/calendarTypes';

const timeline = vi.hoisted(() => ({ value: null as null | { weeksLeft: number; short: string } }));
vi.mock('../../hooks/useTimeline', () => ({ useTimeline: () => timeline.value }));
vi.mock('../../hooks/ui/useHintStatus', () => ({ useHintStatus: () => ({ seen: true }) }));
vi.mock('../../hooks/ui/useCourseName', () => ({ useCourseName: (_c?: string, n?: string) => n }));

import { CalendarEventCard } from '../CalendarEventCard';

const lesson = (renderedMinutes: number, extra: Partial<LessonWithRow> = {}): LessonWithRow =>
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
    ...extra,
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
 * It showed on any 60-to-89-minute lesson, and every 50-minute lesson is one
 * now that blocks are drawn for their real length.
 */
describe('CalendarEventCard in a short block', () => {
  afterEach(() => {
    timeline.value = null;
  });

  it('drops to one line with the time, and no room', () => {
    // A 50-minute lesson is now drawn for its 50 minutes, about 34px.
    render(<CalendarEventCard lesson={lesson(50)} />);

    // getAllBy: the quick-hide menu repeats the course name in its own header.
    expect(screen.getAllByText('Cvičení').length).toBeGreaterThan(0);
    expect(screen.getByText('14:00 - 14:50')).toBeInTheDocument();
    // The room is the part that goes: the tooltip and the subject drawer both
    // still carry it, and something has to give at 34 pixels.
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

  /**
   * Raised in review: the first version of this gated the quick-hide menu on
   * the same flag, so a 60-to-89-minute lesson — exactly the common case, since
   * a block is only that short when something follows it — lost the only UI
   * that calls `hideEvent` or `hideCourse`. Shortening a card must not take a
   * feature away from it.
   */
  it('keeps the quick-hide menu, which is the only way to hide a lesson', () => {
    render(<CalendarEventCard lesson={lesson(60)} />);

    expect(screen.getByRole('button', { name: 'Skrýt tuto hodinu' })).toBeInTheDocument();
  });

  /**
   * The day list (DailyView) gives every card the same 80px and no
   * `renderedMinutes`. A card's height there says nothing about its length, so
   * a 50-minute lesson keeps both lines rather than being read as a short block.
   */
  it('keeps both lines where no grid sized it', () => {
    render(<CalendarEventCard lesson={lesson(50, { renderedMinutes: undefined })} />);

    expect(screen.getByText('Q01')).toBeInTheDocument();
    expect(screen.getByText('14:00 - 14:50')).toBeInTheDocument();
  });

  /**
   * The deadline badge sits at the top-right and is always showing, so a
   * one-line block — every 50-minute lesson — would have it over the time.
   */
  it('keeps the time clear of the deadline badge', () => {
    timeline.value = { weeksLeft: 2, short: '2t' };
    render(<CalendarEventCard lesson={lesson(50)} />);

    expect(screen.getByText('2t')).toBeInTheDocument();
    expect(screen.getByText('14:00 - 14:50').parentElement?.className).toContain('pr-12');
  });

  /**
   * An exam slot keeps the two-line block (the grid draws it for 90 minutes,
   * however short): section, subject and room, which is what a student looks
   * for on the day. The tooltip names the subject too.
   */
  it('shows an exam slot with its section, subject and room', () => {
    render(
      <CalendarEventCard
        lesson={lesson(90, {
          isExam: true,
          courseName: 'Matematika - Ústní zkouška',
          startTime: '10:00',
          endTime: '10:10',
        })}
      />
    );

    expect(screen.getByText('Ústní zkouška')).toBeInTheDocument();
    expect(screen.getByText('Matematika')).toBeInTheDocument();
    expect(screen.getByText('Q01')).toBeInTheDocument();
    expect(screen.getByTitle(/^Matematika - Ústní zkouška\s/)).toBeInTheDocument();
  });
});

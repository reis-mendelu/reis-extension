import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekBlock } from '../WeekBlock';
import type { BlockLesson } from '../../../../../types/calendarTypes';

const lesson = {
  id: 'x',
  date: '20261007',
  startTime: '14:00',
  endTime: '14:50',
  courseCode: 'X',
  courseName: 'Statistika',
  room: 'Q15',
  roomStructured: { name: 'Q15', id: '' },
  teachers: [],
  isSeminar: 'false',
} as unknown as BlockLesson;

const block = (height: number) => ({
  lesson,
  top: 0,
  height,
  lane: 0,
  lanes: 1,
});

/**
 * Release review (cubic): on an iPad a block shows name, room and time, and a
 * 50-minute lesson can be shorter than all three — overflow then clipped the
 * room. The time goes first; the room is what the student looks for.
 */
describe('WeekBlock on an iPad', () => {
  it('drops the time row when the block is too short for it', () => {
    render(<WeekBlock block={block(10)} wide gridPx={600} onOpen={vi.fn()} />);
    expect(screen.getByText('Q15')).toBeTruthy();
    expect(screen.queryByText('14:00 – 14:50')).toBeNull();
  });

  it('keeps the time row when there is room', () => {
    render(<WeekBlock block={block(20)} wide gridPx={600} onOpen={vi.fn()} />);
    expect(screen.getByText('14:00 – 14:50')).toBeTruthy();
  });

  // 2026-11-06: a clash is side by side on a phone too, so nothing covers a
  // block any more and each lane keeps its room line.
  it('a phone block in a clash keeps its room and drops only the time', () => {
    const b = { ...block(20), lane: 1, lanes: 2 };
    render(<WeekBlock block={b} wide={false} gridPx={600} onOpen={vi.fn()} />);
    expect(screen.getByText('Q15')).toBeTruthy();
    expect(screen.queryByText('14:00 – 14:50')).toBeNull();
  });
});

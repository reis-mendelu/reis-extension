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
  visible: height,
  order: 0,
  onTop: false,
});

/**
 * Release review (cubic): on an iPad a block shows name, room and time, and a
 * 50-minute lesson can be shorter than all three — overflow then clipped the
 * room. The time goes first; the room is what the student looks for.
 */
describe('WeekBlock on an iPad', () => {
  it('drops the time row when the block is too short for it', () => {
    render(<WeekBlock block={block(10)} cascade={false} gridPx={600} onOpen={vi.fn()} />);
    expect(screen.getByText('Q15')).toBeTruthy();
    expect(screen.queryByText('14:00 – 14:50')).toBeNull();
  });

  it('keeps the time row when there is room', () => {
    render(<WeekBlock block={block(20)} cascade={false} gridPx={600} onOpen={vi.fn()} />);
    expect(screen.getByText('14:00 – 14:50')).toBeTruthy();
  });

  // #622 review: on an iPad a clash sits side by side, so a block "covered" on
  // paper (visible < height) is not; its full height decides.
  it('keeps the time row on a side-by-side block covered only on paper', () => {
    const b = { ...block(20), visible: 5 };
    render(<WeekBlock block={b} cascade={false} gridPx={600} onOpen={vi.fn()} />);
    expect(screen.getByText('14:00 – 14:50')).toBeTruthy();
  });
});

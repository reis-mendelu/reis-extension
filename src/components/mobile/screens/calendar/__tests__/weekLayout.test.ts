import { describe, it, expect } from 'vitest';
import type { BlockLesson } from '../../../../../types/calendarTypes';
import {
  weekHourRange,
  placeDay,
  blockBox,
  nowOffset,
  nameLines,
  dayLanes,
  dayMinWidth,
  MIN_LANE_PX,
} from '../weekLayout';

const lesson = (id: string, startTime: string, endTime: string, date = '20261005'): BlockLesson =>
  ({ id, date, startTime, endTime, courseCode: id, courseName: id }) as BlockLesson;

describe('weekHourRange', () => {
  it('fits whole hours around the week: 07:00 → 18:50 is 7–19', () => {
    expect(weekHourRange([lesson('a', '07:00', '08:50'), lesson('b', '17:00', '18:50')])).toEqual({
      start: 7,
      end: 19,
    });
  });

  it('an empty week still draws a working day', () => {
    expect(weekHourRange([])).toEqual({ start: 8, end: 16 });
  });

  it('never shrinks below eight hours — a lone lesson is not a full-height block', () => {
    expect(weekHourRange([lesson('a', '09:00', '10:30')])).toEqual({ start: 9, end: 17 });
  });

  it('grows upwards when there is no room below midnight', () => {
    expect(weekHourRange([lesson('a', '20:00', '23:30')])).toEqual({ start: 16, end: 24 });
  });

  it('ignores a lesson with no times rather than drawing NaN', () => {
    expect(weekHourRange([lesson('a', '', ''), lesson('b', '10:00', '11:00')])).toEqual({
      start: 10,
      end: 18,
    });
  });
});

describe('placeDay', () => {
  const range = { start: 7, end: 19 }; // 720 minutes

  it('positions a block as a share of the fitted range, not of 7–21', () => {
    const [b] = placeDay([lesson('a', '13:00', '14:48')], range);
    expect(b!.top).toBeCloseTo(50);
    expect(b!.height).toBeCloseTo(15);
  });

  it('gives a real clash two lanes and both blocks know there are two', () => {
    const placed = placeDay(
      [lesson('otii', '11:00', '12:50'), lesson('vol', '12:00', '13:50')],
      range
    );
    expect(placed.map((p) => [p.lesson.id, p.lane, p.lanes])).toEqual([
      ['otii', 0, 2],
      ['vol', 1, 2],
    ]);
  });

  it('back-to-back lessons share one lane', () => {
    const placed = placeDay([lesson('a', '15:00', '16:50'), lesson('b', '17:00', '18:50')], range);
    expect(placed.map((p) => p.lanes)).toEqual([1, 1]);
  });

  it('a block running past the end of the range is cut at the bottom edge', () => {
    const [b] = placeDay([lesson('a', '18:00', '20:00')], range);
    expect(b!.top + b!.height).toBeCloseTo(100);
  });
});

describe('blockBox', () => {
  // Side by side on every width, as the iPad and the desktop grid already were.
  // The 5.6.0 phone cascade drew the later lesson over the earlier one and
  // left a 12px sliver of it (Thursday in Dominik's screenshot, 2026-11-06).
  it('splits a clash side by side, every lane its own share of the column', () => {
    expect(blockBox(0, 2)).toEqual({ left: '0%', width: '50%' });
    expect(blockBox(1, 2)).toEqual({ left: '50%', width: '50%' });
    expect(blockBox(0, 1)).toEqual({ left: '0%', width: '100%' });
  });

  it('no two lanes of a deep clash share an edge', () => {
    const lefts = [0, 1, 2, 3].map((lane) => blockBox(lane, 4).left);
    expect(new Set(lefts).size).toBe(4);
  });
});

describe('dayLanes', () => {
  it('counts the widest clash of each day, one lane for a day without one', () => {
    const lanes = dayLanes(
      [
        lesson('a', '09:00', '10:50', '20261029'),
        lesson('b', '10:00', '11:50', '20261029'),
        lesson('c', '13:00', '14:50', '20261029'),
        lesson('d', '09:00', '10:50', '20261027'),
      ],
      ['2026-10-26', '2026-10-27', '2026-10-29']
    );
    expect(lanes).toEqual({ '2026-10-26': 1, '2026-10-27': 1, '2026-10-29': 2 });
  });
});

describe('dayMinWidth', () => {
  it('a day without a clash has no floor, so its text never pushes it wider', () => {
    // An explicit 0, not auto: a chip's label would otherwise set its own
    // minimum and drift out of line with the column under it.
    expect(dayMinWidth(1, [1, 1, 1, 1, 1])).toBe('0px');
  });

  it('a clashing day asks for a readable width per lane, capped at its share of the row', () => {
    // Two lanes of six in the week: never more than 2/6 of the row minus the
    // gaps between five days, so a 320px phone never overflows.
    expect(dayMinWidth(2, [1, 1, 1, 2, 1])).toBe(
      `min(${2 * MIN_LANE_PX}px, calc((100% - 24px) * 0.3333))`
    );
  });
});

describe('nowOffset', () => {
  const range = { start: 7, end: 19 };

  it('places the now-line on today inside the range', () => {
    expect(nowOffset(new Date('2026-10-07T13:00:00'), '2026-10-07', range)).toBeCloseTo(50);
  });

  it('draws nothing on another day', () => {
    expect(nowOffset(new Date('2026-10-07T13:00:00'), '2026-10-08', range)).toBeNull();
  });

  it('draws nothing outside the range', () => {
    expect(nowOffset(new Date('2026-10-07T06:30:00'), '2026-10-07', range)).toBeNull();
    expect(nowOffset(new Date('2026-10-07T19:30:00'), '2026-10-07', range)).toBeNull();
  });
});

describe('nameLines', () => {
  it('gives the name every whole line the room line leaves', () => {
    // 75px block, 4px padding, 12px room line, 13px name lines → 4 lines.
    expect(nameLines(75, 13, 16)).toBe(4);
  });

  it('never clamps to zero — a tiny block still shows the start of the name', () => {
    expect(nameLines(20, 13, 16)).toBe(1);
  });
});

// PR #618 review findings, 2026-10-30.
describe('weekLayout — review findings', () => {
  const exam = (id: string, startTime: string, endTime: string): BlockLesson =>
    ({ ...lesson(id, startTime, endTime), isExam: true }) as BlockLesson;

  it('a record with only a start does not stretch the range (CodeRabbit)', () => {
    expect(weekHourRange([lesson('a', '10:00', '11:00'), lesson('b', '00:00', '')])).toEqual({
      start: 10,
      end: 18,
    });
  });

  it('the range covers an exam drawn for its 90-minute floor (CodeRabbit)', () => {
    // 10-minute oral exam at 17:30: drawn to 19:00, so the range must reach 19.
    const range = weekHourRange([lesson('a', '09:00', '10:00'), exam('x', '17:30', '17:40')]);
    expect(range.end).toBe(19);
  });

  // Release review (cubic): percentages are floats, so a lesson ending exactly
  // where the next one starts read as an overlap and lost its room line.
  it('back-to-back lessons do not clash', () => {
    // 06:10–07:50 then 07:50–09:30 in a 6–14 grid: the float sum of the
    // first block's top and height lands a hair past the second's top.
    const range = { start: 6, end: 14 };
    const placed = placeDay([lesson('a', '06:10', '07:50'), lesson('b', '07:50', '09:30')], range);
    expect(placed.map((p) => p.lanes)).toEqual([1, 1]);
  });
});

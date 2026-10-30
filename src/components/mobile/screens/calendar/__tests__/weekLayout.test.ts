import { describe, it, expect } from 'vitest';
import type { BlockLesson } from '../../../../../types/calendarTypes';
import { weekHourRange, placeDay, blockBox, nowOffset, nameLines } from '../weekLayout';

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

  it('a block with a later clash drawn over it knows how much of it stays visible', () => {
    const [otii, vol] = placeDay(
      [lesson('otii', '11:00', '12:50'), lesson('vol', '12:00', '13:50')],
      range
    );
    // 11:00 → 12:00 of a 720-minute range.
    expect(otii!.visible).toBeCloseTo((60 / 720) * 100);
    expect(vol!.visible).toBeCloseTo(vol!.height);
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
  it('on a phone a clash cascades: the later block is indented, not halved', () => {
    expect(blockBox(0, 2, true)).toEqual({ left: '0px', width: '100%' });
    expect(blockBox(1, 2, true)).toEqual({ left: '12px', width: 'calc(100% - 12px)' });
  });

  it('on an iPad a clash splits the column, as the desktop grid does', () => {
    expect(blockBox(1, 2, false)).toEqual({ left: '50%', width: '50%' });
    expect(blockBox(0, 1, false)).toEqual({ left: '0%', width: '100%' });
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

  it('a block is covered by a later one that started before it ended, whatever lane (cubic)', () => {
    // A 8–10 (lane 0), B 9–11 (lane 1), C 10–12 reuses lane 0 and is drawn
    // after B, so B's lower half is under C, and C is on top.
    const range = { start: 8, end: 16 };
    const placed = placeDay(
      [lesson('a', '08:00', '10:00'), lesson('b', '09:00', '11:00'), lesson('c', '10:00', '12:00')],
      range
    );
    const b = placed.find((p) => p.lesson.id === 'b')!;
    const c = placed.find((p) => p.lesson.id === 'c')!;
    expect(b.visible).toBeCloseTo(c.top - b.top, 5);
    expect(c.visible).toBeCloseTo(c.height, 5);
    expect(c.order).toBeGreaterThan(b.order);
  });

  it('a phone cascade never indents a block out of its column (CodeRabbit)', () => {
    const deep = blockBox(5, 6, true);
    expect(deep.left).toBe('50.0%');
    expect(deep.width).toBe('calc(100% - 50.0%)');
  });

  // CodeRabbit, second round: a flat two-step cap gave lanes 2 and 3 the same
  // box, so four lessons starting together hid one completely.
  it('every lane of a deep clash gets its own indent', () => {
    const lefts = [0, 1, 2, 3].map((lane) => blockBox(lane, 4, true).left);
    expect(new Set(lefts).size).toBe(4);
  });
});

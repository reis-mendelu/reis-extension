import { describe, it, expect } from 'vitest';
import { findHintTarget } from '../hintTarget';
import type { BlockLesson } from '../../../types/calendarTypes';

/**
 * The hint points at a lesson by column index, so — like the "now" line — it has
 * to divide the grid by the number of columns actually drawn. It divided by a
 * literal 5 and searched only indices 0–4, which on a six-column dálkař week
 * pointed the hint at the wrong day and made a Saturday lesson unreachable as a
 * target.
 */
const lesson = (startTime: string, endTime = '12:00'): BlockLesson =>
  ({ id: startTime, startTime, endTime }) as BlockLesson;

const empty = (): BlockLesson[][] => [[], [], [], [], [], [], []];
const at = (h: number, m = 0) => new Date(2026, 8, 14, h, m);

describe('findHintTarget', () => {
  it('splits a five-column week into fifths', () => {
    const days = empty();
    days[2] = [lesson('10:00')];
    const t = findHintTarget(days, -1, 5, at(8));
    expect(t).not.toBeNull();
    expect(t!.width).toBe(100 / 5);
    expect(t!.left).toBe((100 / 5) * 2);
  });

  it('splits a six-column week into sixths, not fifths', () => {
    const days = empty();
    days[2] = [lesson('10:00')];
    const t = findHintTarget(days, -1, 6, at(8));
    expect(t!.width).toBe(100 / 6);
    expect(t!.left).toBe((100 / 6) * 2);
  });

  it('can target a Saturday lesson when Saturday is a drawn column', () => {
    const days = empty();
    days[5] = [lesson('09:00')];
    const t = findHintTarget(days, -1, 6, at(8));
    expect(t, 'a weekend-only week left the hint with no target at all').not.toBeNull();
    expect(t!.left).toBe((100 / 6) * 5);
  });

  it('ignores a Saturday lesson while Saturday is not drawn', () => {
    const days = empty();
    days[5] = [lesson('09:00')];
    expect(findHintTarget(days, -1, 5, at(8))).toBeNull();
  });

  it('prefers a lesson happening right now today', () => {
    const days = empty();
    days[1] = [lesson('09:00', '11:00'), lesson('14:00', '15:00')];
    const t = findHintTarget(days, 1, 5, at(10));
    expect(t!.top).toBeCloseTo((((9 - 7) * 60) / (14 * 60)) * 100, 5);
  });

  it('falls forward to the next day that has anything, wrapping within the drawn week', () => {
    const days = empty();
    days[0] = [lesson('08:00')];
    // Today is Friday (4) with nothing left; the search wraps to Monday.
    const t = findHintTarget(days, 4, 5, at(20));
    expect(t!.left).toBe(0);
  });

  it('returns null when the week holds nothing', () => {
    expect(findHintTarget(empty(), 2, 5, at(9))).toBeNull();
  });
});

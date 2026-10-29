import { describe, it, expect } from 'vitest';
import {
  organizeLessons,
  styleFromMinutes,
  renderedBlockMinutes,
  timeToPercent,
  MIN_BLOCK_MINUTES,
  EXAM_BLOCK_MINUTES,
  TWO_LINE_BLOCK_MINUTES,
} from '../utils';
import type { BlockLesson } from '../../../types/calendarTypes';

const block = (id: string, startTime: string, endTime: string, isExam = false): BlockLesson =>
  ({ id, date: '20260601', startTime, endTime, isExam }) as BlockLesson;

/** Where the week grid draws a lone block: the same path WeeklyCalendarDay takes. */
const drawn = (startTime: string, endTime: string, isExam = false) => {
  const lesson = organizeLessons([block('x', startTime, endTime, isExam)]).lessons[0]!;
  const { top, height } = styleFromMinutes(lesson.startTime, lesson.renderedMinutes);
  return { top: parseFloat(top), bottom: parseFloat(top) + parseFloat(height) };
};

/**
 * The reported bug: "Hodinové přednášky jsou zobrazované jako že mají hodinu
 * a půl".
 *
 * A 90-minute legibility floor, added for 10-minute oral exams, applied to
 * every block: a 14:00-14:50 lesson was drawn down to 15:30, and with a 15:00
 * lesson after it, down to 15:00. A lesson's block now ends on its end time.
 */
describe('a lesson is as tall as it is long', () => {
  it('ends a 50-minute lesson on its end time', () => {
    expect(drawn('14:00', '14:50').bottom).toBeCloseTo(timeToPercent('14:50'), 5);
  });

  it('ends a 110-minute lesson on its end time', () => {
    expect(drawn('11:00', '12:50').bottom).toBeCloseTo(timeToPercent('12:50'), 5);
  });

  it('starts the block on its start time', () => {
    expect(drawn('14:00', '14:50').top).toBeCloseTo(timeToPercent('14:00'), 5);
  });

  it('leaves a long block untouched', () => {
    expect(renderedBlockMinutes('09:00', '12:00')).toBe(180);
  });
});

/**
 * What is still floored, and why it never reaches a lesson.
 *
 * MIN_BLOCK_MINUTES sits under the shortest IS lesson (one 50-minute hour), so
 * it only ever raises something shorter — a custom event, which can be 15.
 * An exam is a slot, not a lesson: its block keeps the 90 it always had, the
 * room the card needs for the section, the subject and the room.
 */
describe('the floors', () => {
  it('never touch a 50-minute lesson', () => {
    expect(MIN_BLOCK_MINUTES).toBeLessThan(50);
    expect(renderedBlockMinutes('14:00', '14:50')).toBe(50);
  });

  it('raise a 15-minute custom event to one line', () => {
    expect(renderedBlockMinutes('10:00', '10:15')).toBe(MIN_BLOCK_MINUTES);
    // One line of the card's text: 25px at a 600px-tall window still shows it
    // whole; 30 minutes was 20px at 700 and cut it.
    expect(MIN_BLOCK_MINUTES).toBe(45);
  });

  it('give a 10-minute exam slot its full two-line block', () => {
    expect(renderedBlockMinutes('10:00', '10:10', true)).toBe(EXAM_BLOCK_MINUTES);
    // The card's two-line layout starts at the same number, by construction.
    expect(EXAM_BLOCK_MINUTES).toBe(TWO_LINE_BLOCK_MINUTES);
  });

  it('leave an exam longer than the floor at its real length', () => {
    expect(renderedBlockMinutes('08:00', '11:00', true)).toBe(180);
  });

  it('keep endTime truthful — the floor is layout only', () => {
    const { lessons } = organizeLessons([block('exam', '12:00', '12:10', true)]);
    expect(lessons[0]!.endTime).toBe('12:10');
  });

  it('give a short exam and a lesson under its floored block separate lanes', () => {
    const { totalRows } = organizeLessons([
      block('exam', '12:00', '12:10', true),
      block('lesson', '12:30', '14:00'),
    ]);
    expect(totalRows).toBe(2);
  });

  it('share a lane once the next block clears the floor', () => {
    const { totalRows } = organizeLessons([
      block('exam', '12:00', '12:10', true),
      block('lesson', '13:30', '14:50'),
    ]);
    expect(totalRows).toBe(1);
  });

  // Accepted: a slot starting after 19:30 gets less than its floor, and an exam
  // at 20:40 drops to one clipped line. Running off the grid would hide it
  // entirely, and moving its top would put it at the wrong time.
  it('shorten rather than overflow 21:00', () => {
    expect(renderedBlockMinutes('20:40', '20:50', true)).toBe(20);
    expect(drawn('20:40', '20:50', true).bottom).toBeCloseTo(100, 5);
  });

  it('never shorten a block below its real length', () => {
    expect(renderedBlockMinutes('20:00', '22:00')).toBe(120);
  });
});

/**
 * "fix překryv hodin když začíná 14:00-14:50 a 15:00-18:50" — the earlier
 * report about the same floor. Nothing overlaps in real time, so the two stay
 * in one full-width lane, one above the other.
 */
describe('back-to-back lessons', () => {
  it('leaves 14:00-14:50 and 15:00-18:50 in a single full-width lane', () => {
    const { lessons, totalRows } = organizeLessons([
      block('a', '14:00', '14:50'),
      block('b', '15:00', '18:50'),
    ]);
    expect(totalRows).toBe(1);
    expect(lessons.map((l) => l.maxColumns)).toEqual([1, 1]);
  });

  it('publishes each block’s real length, so lanes and heights cannot drift', () => {
    const { lessons } = organizeLessons([
      block('a', '14:00', '14:50'),
      block('b', '15:00', '18:50'),
    ]);
    expect(lessons.map((l) => l.renderedMinutes)).toEqual([50, 230]);
  });

  it('still splits a real clash into two lanes', () => {
    const { totalRows } = organizeLessons([
      block('a', '14:00', '16:00'),
      block('b', '14:30', '15:30'),
    ]);
    expect(totalRows).toBe(2);
  });
});

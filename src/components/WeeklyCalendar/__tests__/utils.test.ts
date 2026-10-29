import { describe, it, expect } from 'vitest';
import {
  organizeLessons,
  styleFromMinutes,
  renderedBlockMinutes,
  timeToPercent,
  MIN_BLOCK_MINUTES,
  EXAM_BLOCK_MINUTES,
} from '../utils';
import type { BlockLesson } from '../../../types/calendarTypes';

describe('organizeLessons', () => {
  const createLesson = (id: string, startTime: string, endTime: string): BlockLesson => ({
    id,
    startTime,
    endTime,
    date: '20251022',
    courseName: `Course ${id}`,
    courseCode: id,
    courseId: id,
    room: 'A01',
    roomStructured: { name: 'A01', id: '1' },
    teachers: [],
    periodId: '1',
    studyId: '1',
    campus: 'Brno',
    isDefaultCampus: 'true',
    facultyCode: 'AF',
    isSeminar: 'false',
    isConsultation: 'false',
  });

  it('should assign maxColumns: 1 to non-overlapping lessons', () => {
    const lessons = [createLesson('1', '08:00', '09:00'), createLesson('2', '10:00', '11:00')];

    const { lessons: organized } = organizeLessons(lessons);

    expect(organized).toHaveLength(2);
    expect(organized[0].maxColumns).toBe(1);
    expect(organized[1].maxColumns).toBe(1);
    expect(organized[0].row).toBe(0);
    expect(organized[1].row).toBe(0);
  });

  it('should assign maxColumns: 2 to overlapping lessons', () => {
    const lessons = [createLesson('1', '08:00', '10:00'), createLesson('2', '09:00', '11:00')];

    const { lessons: organized } = organizeLessons(lessons);

    expect(organized).toHaveLength(2);
    expect(organized[0].maxColumns).toBe(2);
    expect(organized[1].maxColumns).toBe(2);
    expect(organized[0].row).toBe(0);
    expect(organized[1].row).toBe(1);
  });

  it('should handle multiple clusters correctly', () => {
    const lessons = [
      // Cluster 1: One lesson
      createLesson('1', '08:00', '09:00'),
      // Cluster 2: Two overlapping lessons
      createLesson('2', '10:00', '12:00'),
      createLesson('3', '11:00', '13:00'),
      // Cluster 3: Three overlapping lessons
      createLesson('4', '14:00', '16:00'),
      createLesson('5', '14:30', '16:30'),
      createLesson('6', '15:00', '17:00'),
    ];

    const { lessons: organized } = organizeLessons(lessons);

    expect(organized).toHaveLength(6);

    // Cluster 1
    expect(organized.find((l) => l.id === '1')?.maxColumns).toBe(1);

    // Cluster 2
    expect(organized.find((l) => l.id === '2')?.maxColumns).toBe(2);
    expect(organized.find((l) => l.id === '3')?.maxColumns).toBe(2);

    // Cluster 3
    expect(organized.find((l) => l.id === '4')?.maxColumns).toBe(3);
    expect(organized.find((l) => l.id === '5')?.maxColumns).toBe(3);
    expect(organized.find((l) => l.id === '6')?.maxColumns).toBe(3);
  });

  it('should handle complex overlaps where maxColumns is based on simultaneous events', () => {
    // Example: A starts, B starts, A ends, C starts, B ends, C ends
    // A: 08:00 - 10:00
    // B: 09:00 - 12:00
    // C: 11:00 - 13:00
    // At any point, max 2 are overlapping (A&B or B&C), but they all form one cluster.
    // Wait, if A&B overlap and B&C overlap, they are one cluster.
    // Max simultaneous is 2.

    const lessons = [
      createLesson('A', '08:00', '10:00'),
      createLesson('B', '09:00', '12:00'),
      createLesson('C', '11:00', '13:00'),
    ];

    const { lessons: organized } = organizeLessons(lessons);

    // A overlaps B (row 0, row 1)
    // B is at row 1. C starts after A ends. C can take row 0.
    // Cluster max rows is 2 (row 0 and row 1 were used).
    expect(organized.every((l) => l.maxColumns === 2)).toBe(true);
  });

  it('should handle the user scenario from the screenshot', () => {
    const lessons = [
      createLesson('1', '09:00', '10:50'),
      createLesson('2', '13:00', '14:50'),
      createLesson('3', '15:00', '16:50'),
      createLesson('4', '17:00', '18:50'),
      createLesson('5', '17:00', '18:50'),
    ];

    const { lessons: organized } = organizeLessons(lessons);

    // First three should be 100% width
    expect(organized.find((l) => l.id === '1')?.maxColumns).toBe(1);
    expect(organized.find((l) => l.id === '2')?.maxColumns).toBe(1);
    expect(organized.find((l) => l.id === '3')?.maxColumns).toBe(1);

    // Last two should be 50% width
    expect(organized.find((l) => l.id === '4')?.maxColumns).toBe(2);
    expect(organized.find((l) => l.id === '5')?.maxColumns).toBe(2);
  });
});

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
    expect(MIN_BLOCK_MINUTES).toBe(30);
  });

  it('give a 10-minute exam slot its full two-line block', () => {
    expect(renderedBlockMinutes('10:00', '10:10', true)).toBe(EXAM_BLOCK_MINUTES);
    expect(EXAM_BLOCK_MINUTES).toBe(90);
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

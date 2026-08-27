import { describe, it, expect } from 'vitest';
import { organizeLessons, getEventStyle, renderedBlockMinutes } from '../utils';
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

describe('getEventStyle minimum visual height', () => {
  const pct = (s: string) => parseFloat(s);

  it('draws a 10-minute exam at the same size as a 90-minute one', () => {
    // 10 min of a 14h day is ~1.19% — an unlabelled sliver. The floor gives it
    // the full 1.5h box so the card renders exactly as it always has.
    expect(getEventStyle('09:45', '09:55').height).toBe(getEventStyle('09:45', '11:15').height);
  });

  it('gives a clamped short exam enough room to satisfy the card layout gate', () => {
    // CalendarEventCard hides subject + room below 60 rendered minutes; a real
    // 10-minute oral exam must still clear it or it renders as a blank sliver.
    expect(renderedBlockMinutes('09:45', '09:55')).toBeGreaterThanOrEqual(60);
  });

  it('reports true length for blocks already above the floor', () => {
    expect(renderedBlockMinutes('09:45', '11:15')).toBe(90);
    expect(renderedBlockMinutes('09:00', '12:00')).toBe(180);
  });

  it('does not move the block start when clamping', () => {
    expect(getEventStyle('09:45', '09:55').top).toBe(getEventStyle('09:45', '11:15').top);
  });

  it('leaves a normal 90-minute block untouched', () => {
    expect(pct(getEventStyle('09:45', '11:15').height)).toBeCloseTo((90 / (14 * 60)) * 100, 5);
  });

  it('leaves a long block untouched', () => {
    expect(pct(getEventStyle('09:00', '12:00').height)).toBeCloseTo((180 / (14 * 60)) * 100, 5);
  });
});

describe('organizeLessons and the visual block floor', () => {
  // The floor enlarges a short block for legibility, but lane assignment used
  // the true end time — so a 10-minute exam at 12:00 (drawn down to 13:30) and
  // a lesson at 12:30 landed in the SAME lane and the exam covered it. Layout
  // has to reason about the space a block actually occupies.
  const block = (id: string, startTime: string, endTime: string): BlockLesson =>
    ({ id, date: '20260601', startTime, endTime }) as BlockLesson;

  it('gives a short exam and the lesson under its floored height separate lanes', () => {
    const { lessons, totalRows } = organizeLessons([
      block('exam', '12:00', '12:10'),
      block('lesson', '12:30', '14:00'),
    ]);
    expect(totalRows).toBe(2);
    expect(lessons[0]!.row).not.toBe(lessons[1]!.row);
  });

  it('still shares a lane once the later block clears the floored height', () => {
    const { lessons, totalRows } = organizeLessons([
      block('exam', '12:00', '12:10'),
      block('lesson', '13:30', '15:00'),
    ]);
    expect(totalRows).toBe(1);
    expect(lessons[0]!.row).toBe(lessons[1]!.row);
  });

  it('leaves normal-length lessons laid out exactly as before', () => {
    const { lessons, totalRows } = organizeLessons([
      block('a', '08:00', '09:50'),
      block('b', '10:00', '11:50'),
    ]);
    expect(totalRows).toBe(1);
    expect(lessons[0]!.row).toBe(lessons[1]!.row);
  });

  it('keeps endTime truthful — the floor is layout only', () => {
    const { lessons } = organizeLessons([block('exam', '12:00', '12:10')]);
    expect(lessons[0]!.endTime).toBe('12:10');
  });
});

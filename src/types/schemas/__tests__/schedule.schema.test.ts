import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { BlockLessonSchema } from '../schedule.schema';
import type { BlockLesson } from '../../calendarTypes';

const ScheduleSchema = z.array(BlockLessonSchema);

// A representative real lesson (mirrors what syncSchedule writes).
const realLesson: BlockLesson = {
  id: 'L1',
  date: '20260612',
  startTime: '09:00',
  endTime: '10:50',
  courseName: 'Algebra',
  courseCode: 'EBC-ALG',
  courseId: 'c1',
  room: 'Q01',
  roomStructured: { name: 'Q01', id: 'r1' },
  teachers: [{ fullName: 'Jan Novák', shortName: 'Novák', id: 't1' }],
  periodId: 'p1',
  studyId: 's1',
  campus: 'Lednice',
  isDefaultCampus: 'true',
  facultyCode: 'PEF',
  isSeminar: 'false',
  isConsultation: 'false',
};

describe('BlockLessonSchema', () => {
  it('accepts a representative real lesson (never drops valid data)', () => {
    expect(ScheduleSchema.safeParse([realLesson]).success).toBe(true);
  });

  it('accepts unknown/future IS fields via passthrough', () => {
    const withExtra = { ...realLesson, futureField: 'x' };
    expect(BlockLessonSchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts an unexpected isSeminar value (widened to string, no drift-drop)', () => {
    const drift = { ...realLesson, isSeminar: 'unknown_flag' };
    expect(BlockLessonSchema.safeParse(drift).success).toBe(true);
  });

  it('accepts optional fields present (isExam, examEvent, dual-language)', () => {
    const withOptional = {
      ...realLesson,
      isExam: true,
      examEvent: { anything: 'goes' },
      isCustom: true,
      customEventId: 'ce1',
      courseNameCs: 'Algebra',
      courseNameEn: 'Algebra',
      roomCs: 'Q01',
      roomEn: 'Q01',
    };
    expect(BlockLessonSchema.safeParse(withOptional).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(BlockLessonSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: teachers is not an array', () => {
    expect(BlockLessonSchema.safeParse({ ...realLesson, teachers: 'nope' }).success).toBe(false);
  });

  it('rejects genuine corruption: missing id', () => {
    const { id: _id, ...noId } = realLesson;
    expect(BlockLessonSchema.safeParse(noId).success).toBe(false);
  });

  it('rejects genuine corruption: missing courseCode', () => {
    const { courseCode: _courseCode, ...noCourseCode } = realLesson;
    expect(BlockLessonSchema.safeParse(noCourseCode).success).toBe(false);
  });
});

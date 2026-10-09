import { describe, expect, it } from 'vitest';
import { normalizeCustom, normalizeExams, normalizeLessons } from '../normalize';
import type { BlockLesson, CalendarCustomEvent } from '../../../types/calendarTypes';
import type { ExamSubject } from '../../../types/exams';

const lesson = (o: Partial<BlockLesson> = {}): BlockLesson =>
  ({
    id: '123',
    date: '20261012',
    startTime: '09:00',
    endTime: '10:50',
    courseName: 'Ekonomie I',
    courseNameCs: 'Ekonomie I',
    courseNameEn: 'Economics I',
    room: 'Q01',
    roomCs: 'Q01',
    roomEn: 'Q01',
    isSeminar: 'false',
    isConsultation: 'false',
    teachers: [{ fullName: 'doc. Jan Novák', shortName: 'Novák', id: '1' }],
    roomStructured: { name: 'Q01', id: '' },
    courseCode: 'EBC-E1',
    courseId: '9',
    periodId: '',
    studyId: '',
    campus: '',
    isDefaultCampus: 'true',
    facultyCode: 'PEF',
    ...o,
  }) as BlockLesson;

describe('normalizeLessons', () => {
  it('maps a lecture in Czech', () => {
    expect(normalizeLessons([lesson()], 'cz')).toEqual([
      {
        kind: 'lesson',
        key: '123|20261012|09:00',
        date: '2026-10-12',
        start: '09:00',
        end: '10:50',
        title: 'Ekonomie I – přednáška',
        location: 'Q01',
        description: 'doc. Jan Novák\nreIS',
      },
    ]);
  });
  it('uses the English name and seminar label in English', () => {
    const [n] = normalizeLessons([lesson({ isSeminar: 'true' })], 'en');
    expect(n?.title).toBe('Economics I – seminar');
  });
  it('pads a one-digit hour, which Google would reject in a date-time', () => {
    const [n] = normalizeLessons([lesson({ startTime: '9:00', endTime: '9:50' })], 'cz');
    expect(n).toMatchObject({ start: '09:00', end: '09:50' });
  });
  it('drops exam and custom rows the calendar merges into lessons', () => {
    expect(normalizeLessons([lesson({ isExam: true }), lesson({ isCustom: true })], 'cz')).toEqual(
      []
    );
  });
});

describe('normalizeExams', () => {
  const subject: ExamSubject = {
    version: 1,
    id: 's1',
    name: 'Ekonomie I',
    nameCs: 'Ekonomie I',
    nameEn: 'Economics I',
    code: 'EBC-E1',
    sections: [
      {
        id: 'sec1',
        name: 'zkouška',
        nameCs: 'zkouška',
        nameEn: 'exam',
        type: 'z',
        status: 'registered',
        registeredTerm: {
          id: 't9',
          date: '20.01.2027',
          time: '09:00',
          room: 'Q02',
          roomCs: 'Q02',
          roomEn: 'Q02',
          durationMinutes: 120,
        },
        terms: [],
      },
      { id: 'sec2', name: 'zápočet', type: 'z', status: 'open', terms: [] },
    ],
  };
  it('maps registered terms only, with duration', () => {
    expect(normalizeExams([subject], 'cz')).toEqual([
      {
        kind: 'exam',
        key: 't9',
        date: '2027-01-20',
        start: '09:00',
        end: '11:00',
        title: 'Zkouška: Ekonomie I',
        location: 'Q02',
        description: 'zkouška\nreIS',
      },
    ]);
  });
  it('falls back to 90 minutes and a section-based key', () => {
    const s = structuredClone(subject);
    s.sections[0]!.registeredTerm = { date: '20.01.2027', time: '09:00' };
    const [n] = normalizeExams([s], 'en');
    expect(n).toMatchObject({
      key: 's1|sec1',
      end: '10:30',
      title: 'Exam: Economics I',
      location: '',
    });
  });
  it('lets a late term run past midnight instead of clipping it at 23:59', () => {
    const s = structuredClone(subject);
    s.sections[0]!.registeredTerm = { date: '20.01.2027', time: '23:30' };
    expect(normalizeExams([s], 'en')[0]).toMatchObject({ start: '23:30', end: '01:00' });
  });
});

describe('normalizeCustom', () => {
  it('maps a custom event', () => {
    const e: CalendarCustomEvent = {
      id: 'c7',
      title: 'Knihovna',
      date: '20261015',
      startTime: '14:00',
      endTime: '15:00',
      room: 'B',
    };
    expect(normalizeCustom([e])).toEqual([
      {
        kind: 'custom',
        key: 'c7',
        date: '2026-10-15',
        start: '14:00',
        end: '15:00',
        title: 'Knihovna',
        location: 'B',
        description: 'reIS',
      },
    ]);
  });
});

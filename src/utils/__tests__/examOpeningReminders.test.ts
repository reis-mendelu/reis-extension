import { describe, it, expect } from 'vitest';
import { examOpeningReminders, pragueToInstant } from '../examOpeningReminders';
import type { ExamSection, ExamSubject, ExamTerm } from '../../types/exams';

// Absolute instants throughout: 1. 12. 9:00 in Prague (CET, UTC+1), whatever
// time zone the test machine — or the student's phone — is in.
const NOW = new Date(Date.UTC(2026, 11, 1, 8, 0));

const term = (id: string, registrationStart?: string, extra: Partial<ExamTerm> = {}): ExamTerm => ({
  id,
  date: '20.01.2027',
  time: '10:00',
  registrationStart,
  ...extra,
});

const section = (id: string, terms: ExamTerm[], extra: Partial<ExamSection> = {}): ExamSection => ({
  id,
  name: 'zkouška',
  nameCs: 'Zkouška',
  nameEn: 'Exam',
  type: 'exam',
  status: 'available',
  terms,
  ...extra,
});

const subject = (sections: ExamSection[]): ExamSubject => ({
  version: 1,
  id: 'EBC-EKM',
  name: 'Ekonometrie 1',
  nameCs: 'Ekonometrie 1',
  nameEn: 'Econometrics 1',
  code: 'EBC-EKM',
  sections,
});

/**
 * "Za chvíli se otvírá zkouška": one reminder per exam the student is not on
 * yet, an hour before IS lets anyone register — spec 2026-10-20.
 */
describe('examOpeningReminders', () => {
  it('reminds an hour before the earliest future opening of a section', () => {
    const exams = [
      subject([section('s1', [term('t1', '03.12.2026 13:00'), term('t2', '02.12.2026 13:00')])]),
    ];
    const [r] = examOpeningReminders(exams, NOW, 'cz');
    expect(r).toMatchObject({
      key: 'EBC-EKM|s1|2026-12-02T13:00',
      subjectName: 'Ekonometrie 1',
      sectionName: 'Zkouška',
      opensAtClock: '13:00',
    });
    expect(r!.opensAt).toEqual(new Date(Date.UTC(2026, 11, 2, 12, 0)));
    expect(r!.fireAt).toEqual(new Date(Date.UTC(2026, 11, 2, 11, 0)));
  });

  it('gives terms opening together one reminder per section', () => {
    const exams = [
      subject([section('s1', [term('t1', '02.12.2026 13:00'), term('t2', '02.12.2026 13:00')])]),
    ];
    expect(examOpeningReminders(exams, NOW, 'cz')).toHaveLength(1);
  });

  it('skips a section the student is already registered in', () => {
    const exams = [
      subject([section('s1', [term('t1', '02.12.2026 13:00')], { status: 'registered' })]),
    ];
    expect(examOpeningReminders(exams, NOW, 'cz')).toEqual([]);
  });

  // "Kam se přihlásit nemohu?": IS's dates, but they never open for this student.
  it('ignores terms the student can never register for', () => {
    const exams = [
      subject([section('s1', [term('t1', '02.12.2026 13:00', { cannotRegister: true })])]),
    ];
    expect(examOpeningReminders(exams, NOW, 'cz')).toEqual([]);
  });

  it('drops an opening whose reminder time has already passed', () => {
    const exams = [subject([section('s1', [term('t1', '01.12.2026 09:30')])])];
    expect(examOpeningReminders(exams, NOW, 'cz')).toEqual([]);
  });

  it('ignores openings in the past and terms with no opening', () => {
    const exams = [subject([section('s1', [term('t1', '30.11.2026 13:00'), term('t2')])])];
    expect(examOpeningReminders(exams, NOW, 'cz')).toEqual([]);
  });

  it('names the subject and section in English for an English app', () => {
    const exams = [subject([section('s1', [term('t1', '02.12.2026 13:00')])])];
    expect(examOpeningReminders(exams, NOW, 'en')[0]).toMatchObject({
      subjectName: 'Econometrics 1',
      sectionName: 'Exam',
    });
  });

  // The scheduler tells "already scheduled" from "new" by this id alone.
  it('keeps the same 32-bit id for the same opening, and a new one when it moves', () => {
    const at = (start: string) =>
      examOpeningReminders([subject([section('s1', [term('t1', start)])])], NOW, 'cz')[0]!.id;
    expect(at('02.12.2026 13:00')).toBe(at('02.12.2026 13:00'));
    expect(at('02.12.2026 13:00')).not.toBe(at('02.12.2026 14:00'));
    expect(Number.isInteger(at('02.12.2026 13:00'))).toBe(true);
    // Below 10⁹: the záznamník's notifications take epoch seconds (above 10⁹ for
    // good) as their id, and a shared id would replace one with the other.
    expect(at('02.12.2026 13:00')).toBeGreaterThanOrEqual(0);
    expect(at('02.12.2026 13:00')).toBeLessThan(1_000_000_000);
  });
});

/**
 * IS writes Prague wall-clock times. A phone in London read "13:00" as 13:00
 * London, an hour late — the reminder then fired as registration opened.
 */
describe('pragueToInstant', () => {
  it('reads an IS time as Prague time in winter (UTC+1)', () => {
    expect(pragueToInstant(new Date(2026, 11, 2, 13, 0))).toEqual(
      new Date(Date.UTC(2026, 11, 2, 12, 0))
    );
  });

  it('and in summer (UTC+2)', () => {
    expect(pragueToInstant(new Date(2026, 5, 2, 13, 0))).toEqual(
      new Date(Date.UTC(2026, 5, 2, 11, 0))
    );
  });
});

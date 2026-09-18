import { describe, it, expect } from 'vitest';
import { buildOpenExams, buildRegisteredExams } from '../examRows';
import type { ExamSubject, ExamSection, ExamTerm } from '../../../types/exams';

const term = (over: Partial<ExamTerm> = {}): ExamTerm => ({
  id: 't1',
  date: '21.09.2026',
  time: '11:00',
  canRegisterNow: true,
  ...over,
});

const section = (over: Partial<ExamSection>): ExamSection =>
  ({ id: 's1', name: 'Zkouška', status: 'open', type: 'exam', terms: [term()], ...over }) as ExamSection;

const subject = (sections: ExamSection[]): ExamSubject =>
  ({ version: 1, id: 'ALG', code: 'ALG', name: 'Algoritmizace', sections }) as ExamSubject;

describe('the rows the Zkoušky screen is built from', () => {
  it('keeps ordinary exam sections in the open group', () => {
    const rows = buildOpenExams([subject([section({ name: 'Zkouška' })])], 'cz');
    expect(rows.map((r) => r.sectionName)).toEqual(['Zkouška']);
  });

  // The reported bug: "Zápis na cvičení – Algoritmizace", 12 bookable slots,
  // shown to a student already sitting in that cvičení. IS serves the row; it
  // is simply not an exam and Zkoušky is not where it belongs.
  it('drops a seminar-group signup from the open group', () => {
    const rows = buildOpenExams(
      [subject([section({ id: 'a', name: 'Zápis na cvičení' }), section({ id: 'b', name: 'Zkouška' })])],
      'cz'
    );
    expect(rows.map((r) => r.sectionName)).toEqual(['Zkouška']);
  });

  it('drops it in English too, where the display name is not Czech', () => {
    const rows = buildOpenExams(
      [
        subject([
          section({ name: 'Zápis na cvičení', nameCs: 'Zápis na cvičení', nameEn: 'Seminar signup' }),
        ]),
      ],
      'en'
    );
    expect(rows).toHaveLength(0);
  });

  // A student who DID self-register for a group lands in IS's #table_1 and
  // would otherwise surface here as a registered exam — and from there into
  // "this week" and the next-up strip, announced as their next exam.
  it('drops a registered seminar-group signup from the registered group', () => {
    const registeredSignup = section({
      id: 'a',
      name: 'Zápis na cvičení',
      status: 'registered',
      registeredTerm: { id: 't9', date: '21.09.2026', time: '11:00' },
    });
    const registeredExam = section({
      id: 'b',
      name: 'Zkouška',
      status: 'registered',
      registeredTerm: { id: 't8', date: '15.01.2027', time: '09:00' },
    });
    const rows = buildRegisteredExams([subject([registeredSignup, registeredExam])], 'cz');
    expect(rows.map((r) => r.sectionName)).toEqual(['Zkouška']);
  });

  it('does not drop a zápočet, which is a real thing to turn up for', () => {
    const rows = buildOpenExams([subject([section({ name: 'Zápočet' })])], 'cz');
    expect(rows.map((r) => r.sectionName)).toEqual(['Zápočet']);
  });
});

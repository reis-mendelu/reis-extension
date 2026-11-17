import { describe, it, expect } from 'vitest';
import { buildOpenExams, buildRegisteredExams, buildSignupExams } from '../examRows';
import type { ExamSubject, ExamSection, ExamTerm } from '../../../types/exams';

const term = (over: Partial<ExamTerm> = {}): ExamTerm => ({
  id: 't1',
  date: '21.09.2026',
  time: '11:00',
  canRegisterNow: true,
  ...over,
});

const section = (over: Partial<ExamSection>): ExamSection =>
  ({
    id: 's1',
    name: 'Zkouška',
    status: 'open',
    type: 'exam',
    terms: [term()],
    ...over,
  }) as ExamSection;

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
      [
        subject([
          section({ id: 'a', name: 'Zápis na cvičení' }),
          section({ id: 'b', name: 'Zkouška' }),
        ]),
      ],
      'cz'
    );
    expect(rows.map((r) => r.sectionName)).toEqual(['Zkouška']);
  });

  it('drops it in English too, where the display name is not Czech', () => {
    const rows = buildOpenExams(
      [
        subject([
          section({
            name: 'Zápis na cvičení',
            nameCs: 'Zápis na cvičení',
            nameEn: 'Seminar signup',
          }),
        ]),
      ],
      'en'
    );
    expect(rows).toHaveLength(0);
  });

  // Report #37: a student DID self-register for a "zápis na" term (or will,
  // for an excursion). Registered, it is a dated commitment like an exam, so it
  // shows as registered — Dominik, 2026-11-07. It still never badges
  // (useMenuItems).
  it('keeps a registered seminar-group signup in the registered group', () => {
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
    expect(rows.map((r) => r.sectionName)).toEqual(['Zápis na cvičení', 'Zkouška']);
  });

  it('does not drop a zápočet, which is a real thing to turn up for', () => {
    const rows = buildOpenExams([subject([section({ name: 'Zápočet' })])], 'cz');
    expect(rows.map((r) => r.sectionName)).toEqual(['Zápočet']);
  });
});

/**
 * The collapsed "Zápisy na cvičení" group at the bottom of Zkoušky (report #37).
 * #344's student saw his already-assigned group there as bookable slots under
 * Otevřené termíny; report #37's student lost her ZOO Vyškov excursion
 * entirely. Both now land here, and only here.
 */
describe('the signup group', () => {
  it('holds the unregistered signup sections and nothing else', () => {
    const rows = buildSignupExams(
      [
        subject([
          section({ id: 'a', name: 'Zápis na cvičení' }),
          section({ id: 'b', name: 'Zkouška' }),
          section({
            id: 'c',
            name: 'Zápis na seminář',
            status: 'registered',
            registeredTerm: { id: 't9', date: '21.09.2026', time: '11:00' },
          }),
        ]),
      ],
      'cz'
    );
    expect(rows.map((r) => r.section.id)).toEqual(['a']);
  });

  it('shows the English druh when the UI is English', () => {
    const rows = buildSignupExams(
      [
        subject([
          section({
            name: 'Zápis na cvičení',
            nameCs: 'Zápis na cvičení',
            nameEn: 'Seminar signup',
          }),
        ]),
      ],
      'en'
    );
    expect(rows.map((r) => r.sectionName)).toEqual(['Seminar signup']);
  });
});

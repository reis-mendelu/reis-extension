import { describe, it, expect } from 'vitest';
import { newTermAlerts } from '../newTermAlerts';
import { examTermKey } from '../../newExamTerms';
import type { ExamSection, ExamSubject, ExamTerm } from '../../../types/exams';

const NOW = new Date(2026, 11, 1, 12, 0).getTime();

const term = (id: string, date: string, extra: Partial<ExamTerm> = {}): ExamTerm => ({
  id,
  date,
  time: '11:00',
  ...extra,
});

const vwa = (section: Partial<ExamSection>): ExamSubject => ({
  version: 1,
  id: 'EBC-VWA',
  name: 'Vývoj webových aplikací',
  code: 'EBC-VWA',
  sections: [{ id: 'zk', name: 'zkouška', type: 'exam', status: 'open', terms: [], ...section }],
});

const key = (termId: string) => examTermKey('EBC-VWA', termId);
const names = { subject: (s: ExamSubject) => s.name, section: (s: ExamSection) => s.name };

describe('newTermAlerts', () => {
  it('gives a section one row naming its new dates, soonest first', () => {
    const subjects = [
      vwa({ terms: [term('2', '17.12.2026'), term('1', '14.12.2026'), term('3', '20.12.2026')] }),
    ];
    const rows = newTermAlerts(subjects, [key('2'), key('1')], NOW, names);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'exam-new-term',
      title: 'Vývoj webových aplikací',
      courseCode: 'EBC-VWA',
    });
    expect(rows[0]?.body).toBe('zkouška · 14. 12., 17. 12.');
    // The id carries the terms, so a third new date is counted by the bell again.
    expect(rows[0]?.id).toBe(`exam-new-${key('1')}|${key('2')}`);
  });

  it('drops a new term the student can no longer use', () => {
    const subjects = [
      vwa({
        terms: [
          term('past', '30.11.2026'),
          term('nemohu', '14.12.2026', { cannotRegister: true }),
          term('closed', '15.12.2026', { registrationEnd: '01.12.2026 08:00' }),
        ],
      }),
    ];
    expect(
      newTermAlerts(subjects, [key('past'), key('nemohu'), key('closed')], NOW, names)
    ).toEqual([]);
  });

  it('says nothing once the student is registered in that section', () => {
    const subjects = [vwa({ status: 'registered', terms: [term('1', '14.12.2026')] })];
    expect(newTermAlerts(subjects, [key('1')], NOW, names)).toEqual([]);
  });

  it('keeps a full term: a place can free up, and the date is still news', () => {
    const subjects = [vwa({ terms: [term('1', '14.12.2026', { full: true })] })];
    expect(newTermAlerts(subjects, [key('1')], NOW, names)).toHaveLength(1);
  });

  // Seminar-group signups share the exam list but are not exams: no row, like
  // the other exam alerts (isGroupSignupSection).
  it('says nothing about a new seminar-group signup', () => {
    const subjects = [vwa({ name: 'Zápis na cvičení', terms: [term('1', '14.12.2026')] })];
    expect(newTermAlerts(subjects, [key('1')], NOW, names)).toEqual([]);
  });

  // A placeholder end ("-") is no end; a malformed date is no date.
  it('keeps a term whose end IS left as a placeholder, and drops one with no real date', () => {
    const subjects = [
      vwa({
        terms: [term('1', '14.12.2026', { registrationEnd: '-' }), term('2', 'n/a')],
      }),
    ];
    expect(newTermAlerts(subjects, [key('1'), key('2')], NOW, names).map((r) => r.body)).toEqual([
      'zkouška · 14. 12.',
    ]);
  });
});

import { describe, it, expect } from 'vitest';
import { hasRegisterableTerms } from '../examRegistration';
import type { ExamSubject } from '../../types/exams';

function subject(sections: ExamSubject['sections']): ExamSubject {
  return { version: 1, id: 's', name: 'Test', code: 'TST', sections };
}

describe('hasRegisterableTerms', () => {
  it('is false for empty data', () => {
    expect(hasRegisterableTerms([])).toBe(false);
  });

  it('is true when an available section has a non-full, registerable term', () => {
    const data = [subject([
      { id: 'sec1', name: 'zkouška', type: 'exam', status: 'available',
        terms: [{ id: 't1', date: '20.06.2026', time: '09:00', full: false, canRegisterNow: true }] },
    ])];
    expect(hasRegisterableTerms(data)).toBe(true);
  });

  it('is false when the only registerable term is full', () => {
    const data = [subject([
      { id: 'sec1', name: 'zkouška', type: 'exam', status: 'available',
        terms: [{ id: 't1', date: '20.06.2026', time: '09:00', full: true, canRegisterNow: true }] },
    ])];
    expect(hasRegisterableTerms(data)).toBe(false);
  });

  it('is false when the section is already registered', () => {
    const data = [subject([
      { id: 'sec1', name: 'zkouška', type: 'exam', status: 'registered',
        terms: [{ id: 't1', date: '20.06.2026', time: '09:00', full: false, canRegisterNow: true }] },
    ])];
    expect(hasRegisterableTerms(data)).toBe(false);
  });

  it('is false when canRegisterNow is not true', () => {
    const data = [subject([
      { id: 'sec1', name: 'zkouška', type: 'exam', status: 'available',
        terms: [{ id: 't1', date: '20.06.2026', time: '09:00', full: false, canRegisterNow: false }] },
    ])];
    expect(hasRegisterableTerms(data)).toBe(false);
  });
});

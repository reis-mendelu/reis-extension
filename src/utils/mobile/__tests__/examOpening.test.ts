import { describe, it, expect } from 'vitest';
import { splitByRegistrationOpen, formatOpensAt } from '../examOpening';
import type { ExamSection, ExamTerm } from '../../../types/exams';

const term = (over: Partial<ExamTerm>): ExamTerm => ({
  id: 't1',
  date: '15.12.2026',
  time: '09:00',
  ...over,
});

const section = (id: string, terms: ExamTerm[]): ExamSection =>
  ({ id, name: 'Zkouška', status: 'open', terms }) as ExamSection;

const now = new Date(2026, 10, 1); // 1 Nov 2026

describe('splitting the open exams by whether registration has started', () => {
  it('moves a section whose registration opens later out of the open group', () => {
    const rows = [
      { section: section('a', [term({ canRegisterNow: false, registrationStart: '01.12.2026 08:00' })]) },
    ];
    const { notYetOpen, open } = splitByRegistrationOpen(rows, now);
    expect(open).toHaveLength(0);
    expect(notYetOpen).toHaveLength(1);
    expect(notYetOpen[0]!.earliest).toEqual(new Date(2026, 11, 1, 8, 0));
  });

  it('leaves a bookable section alone', () => {
    const rows = [{ section: section('b', [term({ canRegisterNow: true })]) }];
    const { notYetOpen, open } = splitByRegistrationOpen(rows, now);
    expect(notYetOpen).toHaveLength(0);
    expect(open).toHaveLength(1);
  });

  it('does not claim "opens later" when IS said nothing at all', () => {
    // No canRegisterNow, no registrationStart: the panel calls this 'noInfo',
    // and an invented opening date would be worse than no group.
    const rows = [{ section: section('c', [term({})]) }];
    const { notYetOpen, open } = splitByRegistrationOpen(rows, now);
    expect(notYetOpen).toHaveLength(0);
    expect(open).toHaveLength(1);
  });

  it('orders the not-yet-open by which opens first', () => {
    const rows = [
      { section: section('late', [term({ canRegisterNow: false, registrationStart: '20.12.2026 08:00' })]) },
      { section: section('soon', [term({ canRegisterNow: false, registrationStart: '02.12.2026 08:00' })]) },
    ];
    const { notYetOpen } = splitByRegistrationOpen(rows, now);
    expect(notYetOpen.map((r) => r.row.section.id)).toEqual(['soon', 'late']);
  });

  it('formats the opening moment the way a registered row shows its date', () => {
    expect(formatOpensAt(new Date(2026, 11, 1, 8, 0), 'cs-CZ')).toMatch(/1\. 12\. 8:00$/);
  });

  it('says only the day when IS gave a date and no clock', () => {
    // parseRegistrationStart defaults a bare "30.09.2026" to midnight. Printing
    // "0:00" there invents a precision the source never had.
    expect(formatOpensAt(new Date(2026, 8, 30, 0, 0), 'cs-CZ')).toMatch(/30\. 9\.$/);
  });
});

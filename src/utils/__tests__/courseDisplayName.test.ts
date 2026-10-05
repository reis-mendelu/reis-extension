import { describe, it, expect } from 'vitest';
import { courseDisplayName, lessonDisplayName } from '../courseDisplayName';

describe('courseDisplayName', () => {
  const nicknames = { 'EBC-ALG': 'Algo' };

  it("prefers the student's nickname", () => {
    expect(courseDisplayName(nicknames, 'EBC-ALG', 'Algoritmizace')).toBe('Algo');
  });

  it('falls back to the IS name, then the code', () => {
    expect(courseDisplayName(nicknames, 'EBC-MAN', 'Management')).toBe('Management');
    expect(courseDisplayName(nicknames, 'EBC-MAN', '')).toBe('EBC-MAN');
    expect(courseDisplayName(undefined, undefined, 'Management')).toBe('Management');
  });
});

describe('lessonDisplayName', () => {
  const nicknames = { 'EBC-ALG': 'Algo' };

  it('replaces the whole name of a lesson', () => {
    expect(lessonDisplayName(nicknames, { courseCode: 'EBC-ALG' }, 'Algoritmizace')).toBe('Algo');
  });

  // An exam's title is "<subject> - <section>"; a nickname names the subject,
  // so the section half stays — the same rule as the extension's calendar card.
  it("keeps an exam's section after the nickname", () => {
    expect(
      lessonDisplayName(
        nicknames,
        { courseCode: 'EBC-ALG', isExam: true },
        'Algoritmizace - Zkouška - písemná'
      )
    ).toBe('Algo - Zkouška - písemná');
  });

  it('leaves a lesson without a nickname alone', () => {
    expect(
      lessonDisplayName(nicknames, { courseCode: 'EBC-MAN', isExam: true }, 'Management - Zápočet')
    ).toBe('Management - Zápočet');
  });
});

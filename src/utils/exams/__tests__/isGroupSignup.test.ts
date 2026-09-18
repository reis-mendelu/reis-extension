import { describe, it, expect } from 'vitest';
import { isGroupSignupSection, stripGroupSignupSections } from '../isGroupSignup';
import type { ExamSection, ExamSubject } from '../../../types/exams';

const section = (over: Partial<ExamSection>): ExamSection =>
  ({ id: 's1', name: 'Zkouška', status: 'open', terms: [], type: 'exam', ...over }) as ExamSection;

describe('telling a seminar-group signup apart from an exam term', () => {
  // The case that reached us: a first-year saw "Zápis na cvičení – Algoritmizace"
  // offering 12 bookable slots under "Otevřené termíny", while already sitting in
  // that cvičení in his rozvrh. IS really does serve those rows, so the parser is
  // right; they simply are not exams and do not belong on the Zkoušky screen.
  it('recognises the druh IS emits for seminar signup', () => {
    expect(isGroupSignupSection(section({ name: 'Zápis na cvičení' }))).toBe(true);
  });

  it('recognises it without diacritics, as IS occasionally emits', () => {
    expect(isGroupSignupSection(section({ name: 'Zapis na cviceni' }))).toBe(true);
  });

  it('matches on the Czech name even while the UI is in English', () => {
    // Sections are merged across both language fetches into one object, so the
    // Czech druh is always present. We never have to guess IS's English wording.
    expect(
      isGroupSignupSection(
        section({ name: 'Zápis na cvičení', nameCs: 'Zápis na cvičení', nameEn: 'Seminar signup' })
      )
    ).toBe(true);
  });

  it('leaves real exam sections alone', () => {
    expect(isGroupSignupSection(section({ name: 'Zkouška' }))).toBe(false);
    expect(isGroupSignupSection(section({ name: 'Průběžný test' }))).toBe(false);
    expect(isGroupSignupSection(section({ name: 'Zápočet' }))).toBe(false);
  });

  // "Zápočet" starts with the same four letters as "Zápis" and is a real,
  // gradeable thing a student must attend. A prefix match on "zap" would eat it.
  it('does not mistake zápočet for a signup', () => {
    expect(isGroupSignupSection(section({ name: 'Zápočet' }))).toBe(false);
    expect(isGroupSignupSection(section({ name: 'Zapocet' }))).toBe(false);
  });

  it('survives a section with no name at all', () => {
    expect(isGroupSignupSection(section({ name: '' }))).toBe(false);
  });

  it('also covers a seminar variant of the same druh', () => {
    expect(isGroupSignupSection(section({ name: 'Zápis na seminář' }))).toBe(true);
  });

  it('tolerates doubled whitespace in the druh cell', () => {
    expect(isGroupSignupSection(section({ name: 'Zápis  na cvičení' }))).toBe(true);
  });

  // We have one observed druh string and no list of the rest, so the filter is
  // built to under-match. A one-word druh starting with the same letters is
  // left alone: an unrecognised signup is a visible row someone reports, while
  // a wrongly eaten druh vanishes app-wide with nothing to notice.
  it('leaves a one-word druh we have never seen alone', () => {
    expect(isGroupSignupSection(section({ name: 'Zápis' }))).toBe(false);
    expect(isGroupSignupSection(section({ name: 'Zápisový test' }))).toBe(false);
  });
});

describe('stripping seminar-group signup out of synced exam data', () => {
  const subject = (code: string, sections: ExamSection[]) =>
    ({ version: 1, id: code, code, name: code, sections }) as ExamSubject;

  it('removes the signup section and keeps the rest of the subject', () => {
    const input = [
      subject('ALG', [
        section({ id: 'a', name: 'Zápis na cvičení' }),
        section({ id: 'b', name: 'Zkouška' }),
      ]),
    ];
    const out = stripGroupSignupSections(input);
    expect(out[0]!.sections.map((s) => s.name)).toEqual(['Zkouška']);
  });

  it('keeps a subject that had nothing but a signup, just with no sections', () => {
    const out = stripGroupSignupSections([subject('ALG', [section({ name: 'Zápis na cvičení' })])]);
    expect(out).toHaveLength(1);
    expect(out[0]!.sections).toEqual([]);
  });

  it('does not mutate the input', () => {
    const input = [subject('ALG', [section({ name: 'Zápis na cvičení' })])];
    stripGroupSignupSections(input);
    expect(input[0]!.sections).toHaveLength(1);
  });

  it('leaves clean data untouched', () => {
    const input = [subject('ALG', [section({ name: 'Zkouška' })])];
    expect(stripGroupSignupSections(input)[0]!.sections.map((s) => s.name)).toEqual(['Zkouška']);
  });
});

describe('stripping survives junk from the IndexedDB cache', () => {
  // fetchExams catches a throw here and lands the student on an error screen
  // with NO exams. A malformed cache entry must never cost more than the one
  // row this filter removes.
  it('passes through a subject with no sections array', () => {
    const junk = [{ id: 'e1', name: 'Exam 1' }] as unknown as ExamSubject[];
    expect(() => stripGroupSignupSections(junk)).not.toThrow();
    expect(stripGroupSignupSections(junk)).toEqual(junk);
  });

  it('tolerates a null subject and a non-array payload', () => {
    expect(() => stripGroupSignupSections([null] as unknown as ExamSubject[])).not.toThrow();
    expect(stripGroupSignupSections(undefined as unknown as ExamSubject[])).toEqual([]);
  });
});

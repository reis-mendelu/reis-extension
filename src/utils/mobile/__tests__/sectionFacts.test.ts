import { describe, it, expect } from 'vitest';
import { sectionFacts, type SectionFactsInput } from '../sectionFacts';
import type { ExamTerm } from '../../../types/exams';

const term = (id: string, extra: Partial<ExamTerm> = {}): ExamTerm =>
  ({
    id,
    date: '10.12.2026',
    time: '08:00',
    room: 'Q01',
    sectionFormCs: 'písemná',
    durationMinutes: 90,
    ...extra,
  }) as ExamTerm;

const note = { text: 'S sebou kalkulačku.', isEmphasized: false };

function input(terms: ExamTerm[], over: Partial<SectionFactsInput> = {}): SectionFactsInput {
  return {
    terms,
    language: 'cz',
    durations: {},
    notes: Object.fromEntries(terms.map((t) => [t.id, note])),
    loading: {},
    errors: {},
    ...over,
  };
}

/**
 * The card's one "Více" may only say what is true of every term in it: a
 * fact read off the first term and shown for the card is wrong for any term
 * that differs. So each fact shows when all terms agree, and not otherwise.
 */
describe('sectionFacts', () => {
  it('shows room, form, length and note when every term agrees', () => {
    expect(sectionFacts(input([term('a'), term('b')]))).toEqual({
      room: 'Q01',
      form: 'písemná',
      minutes: 90,
      note,
      waiting: false,
      allRead: true,
      failed: false,
    });
  });

  it('leaves out each fact the terms disagree on', () => {
    const facts = sectionFacts(
      input([term('a'), term('b', { room: 'Q02', sectionFormCs: 'ústní', durationMinutes: 60 })], {
        notes: { a: note, b: { text: 'Bez kalkulačky.', isEmphasized: false } },
      })
    );
    expect(facts).toMatchObject({ room: undefined, form: undefined, minutes: undefined });
    expect(facts.note).toBeUndefined();
  });

  it('counts a term with no value as disagreeing, not as agreeing', () => {
    const facts = sectionFacts(
      input([term('a'), term('b', { sectionFormCs: undefined, durationMinutes: undefined })], {
        notes: { a: note, b: null },
        durations: { b: null },
      })
    );
    expect(facts).toMatchObject({ form: undefined, minutes: undefined, note: undefined });
  });

  it('reads a length the note request fetched when the sync attached none', () => {
    const terms = [term('a', { durationMinutes: undefined }), term('b')];
    expect(sectionFacts(input(terms, { durations: { a: 90 } })).minutes).toBe(90);
  });

  it('waits while a term is still being read, and claims no note until all are in', () => {
    const facts = sectionFacts(
      input([term('a'), term('b')], { notes: { a: note }, loading: { b: true } })
    );
    expect(facts.waiting).toBe(true);
    expect(facts.note).toBeUndefined();
  });

  // Review (cubic): a page that failed to load is not IS saying "nothing".
  it('tells a failed read apart from one that found nothing', () => {
    const terms = [term('a'), term('b')];
    expect(sectionFacts(input(terms, { notes: { a: null, b: null } }))).toMatchObject({
      allRead: true,
      failed: false,
    });
    expect(
      sectionFacts(input(terms, { notes: { a: null }, errors: { b: 'HTTP 500' } }))
    ).toMatchObject({ allRead: false, failed: true });
  });

  it('uses the English room and form in English', () => {
    const terms = [
      term('a', { roomEn: 'Q01 EN', sectionFormEn: 'written' }),
      term('b', { roomEn: 'Q01 EN', sectionFormEn: 'written' }),
    ];
    expect(sectionFacts(input(terms, { language: 'en' }))).toMatchObject({
      room: 'Q01 EN',
      form: 'written',
    });
  });
});

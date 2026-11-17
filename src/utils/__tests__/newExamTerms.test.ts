import { describe, it, expect } from 'vitest';
import { examTermKey, findNewTerms, allTermKeys } from '../newExamTerms';
import type { ExamSubject, ExamTerm } from '../../types/exams';

function term(id: string, over: Partial<ExamTerm> = {}): ExamTerm {
  return { id, date: '12.01.2027', time: '08:00', ...over };
}

function subject(
  code: string,
  terms: ExamTerm[],
  status: 'registered' | 'available' | 'open' = 'available'
): ExamSubject {
  return {
    version: 1,
    id: code,
    name: `Name ${code}`,
    nameCs: `Název ${code}`,
    nameEn: `Name ${code}`,
    code,
    sections: [{ id: 's1', name: 'zkouška', type: 'exam', status, terms }],
  };
}

describe('findNewTerms', () => {
  it('announces nothing without a known record', () => {
    expect(findNewTerms(undefined, [subject('EBC-A', [term('1')])])).toEqual([]);
  });

  it('announces a term whose id was not known, with where it belongs', () => {
    const known = new Set(allTermKeys([subject('EBC-A', [term('1')])]));
    const fresh = [subject('EBC-A', [term('1'), term('2', { date: '20.01.2027', time: '10:00' })])];
    expect(findNewTerms(known, fresh)).toEqual([
      {
        key: examTermKey('EBC-A', 's1', '2'),
        courseCode: 'EBC-A',
        subjectCs: 'Název EBC-A',
        subjectEn: 'Name EBC-A',
        date: '20.01.2027',
        time: '10:00',
      },
    ]);
  });

  it('does not announce a term again once it is known', () => {
    const fresh = [subject('EBC-A', [term('1'), term('2')])];
    const known = new Set(allTermKeys(fresh));
    expect(findNewTerms(known, fresh)).toEqual([]);
  });

  it('skips sections the student is already registered in, and terms they cannot register for', () => {
    const known = new Set<string>();
    const fresh = [
      subject('EBC-A', [term('1')], 'registered'),
      subject('EBC-B', [term('2', { cannotRegister: true }), term('3')]),
    ];
    expect(findNewTerms(known, fresh).map((t) => t.key)).toEqual([examTermKey('EBC-B', 's1', '3')]);
  });

  it('a known empty record still announces the first term', () => {
    expect(findNewTerms(new Set(), [subject('EBC-A', [term('1')])])).toHaveLength(1);
  });
});

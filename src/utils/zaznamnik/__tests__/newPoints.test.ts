import { describe, it, expect } from 'vitest';
import { diffZaznamnik } from '../newPoints';
import type { PhArch, SubjectZaznamnik, VtTestAttempt } from '../../../types/zaznamnik';

// Shapes taken from a real scrape (EBC-PS and EBC-VWA, October 2026).
const PS_SECTION = 'Archy ze cvičení - EBC-PS Př Čt 13.00-14.50 Q03 Každý týden';
const PS_COLUMNS = [
  'IPv4-subnt-NAOPAK',
  'IPv4-subnt',
  'HexaGuláš',
  'HW-Skill 15b',
  'Netacad-Final 5b',
  'Netacad-PTSA 10b',
  'Součet',
];

function arch(name: string, columns: string[], values: string[]): PhArch {
  return { name, empty: columns.length === 0, columns, values };
}

function z(
  arches: { section?: string; arch: PhArch }[],
  tests: VtTestAttempt[] = []
): SubjectZaznamnik {
  const sections = new Map<string, PhArch[]>();
  for (const { section = PS_SECTION, arch: a } of arches) {
    sections.set(section, [...(sections.get(section) ?? []), a]);
  }
  return {
    ph: {
      sections: [...sections].map(([label, list]) => ({ label, arches: list })),
      fetchedAt: 0,
    },
    vt: { tests, fetchedAt: 0 },
  };
}

const ps = (values: string[]) => z([{ arch: arch('Priebezne hodnotenie', PS_COLUMNS, values) }]);
const EMPTY_PS = ['', '', '', '', '', '', ''];

function attempt(name: string, score: number, submittedAt: string): VtTestAttempt {
  return {
    name,
    score,
    maxScore: 10,
    successPct: score * 10,
    submittedAt,
    teacher: 'T',
    hasDetail: false,
  };
}

describe('diffZaznamnik', () => {
  it('reports a cell that went from empty to filled, without the Součet column', () => {
    const prev = ps(EMPTY_PS);
    const fresh = ps(['9', '', '', '', '', '', '9']);
    expect(diffZaznamnik(prev, fresh)).toEqual([{ label: 'IPv4-subnt-NAOPAK', value: '9' }]);
  });

  it('reports a cell whose value changed', () => {
    const prev = ps(['9', '', '', '', '', '', '9']);
    const fresh = ps(['9', '4,5', '', '', '', '', '13,5']);
    expect(diffZaznamnik(prev, fresh)).toEqual([{ label: 'IPv4-subnt', value: '4,5' }]);
  });

  it('reports the sum when it is the only thing that changed', () => {
    const prev = ps(['9', '', '', '', '', '', '9']);
    const fresh = ps(['9', '', '', '', '', '', '12']);
    expect(diffZaznamnik(prev, fresh)).toEqual([{ label: 'Součet', value: '12' }]);
  });

  it('reports nothing on the first fetch of a subject', () => {
    expect(diffZaznamnik(undefined, ps(['9', '', '', '', '', '', '9']))).toEqual([]);
    expect(diffZaznamnik(null, ps(['9', '', '', '', '', '', '9']))).toEqual([]);
  });

  it('reports nothing when the fetch failed or came back empty', () => {
    const prev = ps(['9', '', '', '', '', '', '9']);
    expect(diffZaznamnik(prev, null)).toEqual([]);
    expect(diffZaznamnik(prev, undefined)).toEqual([]);
    expect(diffZaznamnik(prev, z([]))).toEqual([]);
  });

  it('ignores a value that was removed', () => {
    const prev = ps(['9', '', '', '', '', '', '9']);
    expect(diffZaznamnik(prev, ps(EMPTY_PS))).toEqual([]);
  });

  it('ignores columns that only moved', () => {
    const prev = z([{ arch: arch('A', ['1', '2', 'Součet'], ['3', '', '3']) }]);
    const fresh = z([{ arch: arch('A', ['2', '1', 'Součet'], ['', '3', '3']) }]);
    expect(diffZaznamnik(prev, fresh)).toEqual([]);
  });

  it('ignores whitespace and non-breaking spaces', () => {
    const prev = z([{ arch: arch('A', ['Test 1'], ['9 b.']) }]);
    const fresh = z([{ arch: arch('A', [' Test 1 '], [' 9  b. ']) }]);
    expect(diffZaznamnik(prev, fresh)).toEqual([]);
  });

  it('matches arches by name when the section label changed', () => {
    const prev = z([
      { arch: arch('Priebezne hodnotenie', PS_COLUMNS, ['9', '', '', '', '', '', '9']) },
    ]);
    const fresh = z([
      {
        section: 'Archy ze cvičení - EBC-PS Př Út 9.00-10.50 Q03 Každý týden',
        arch: arch('Priebezne hodnotenie', PS_COLUMNS, ['9', '', '', '', '', '', '9']),
      },
    ]);
    expect(diffZaznamnik(prev, fresh)).toEqual([]);
  });

  it('reports a once-empty arch that now has a value', () => {
    const prev = z([{ arch: arch('Zápočet', [], []) }]);
    const fresh = z([{ arch: arch('Zápočet', ['Zápočet'], ['započteno']) }]);
    expect(diffZaznamnik(prev, fresh)).toEqual([{ label: 'Zápočet', value: 'započteno' }]);
  });

  it('reports a brand-new arch with filled cells, but not an empty new one', () => {
    const prev = ps(EMPTY_PS);
    const fresh = z([
      { arch: arch('Priebezne hodnotenie', PS_COLUMNS, EMPTY_PS) },
      { arch: arch('Průběžné body', ['1', '2', 'Součet'], ['', '1', '1']) },
      { arch: arch('Bonus', ['B'], ['']) },
    ]);
    expect(diffZaznamnik(prev, fresh)).toEqual([{ label: '2', value: '1' }]);
  });

  it('reports a new test attempt and a changed score, not an unchanged one', () => {
    const prev = z([], [attempt('Test 1', 7, '1. 10. 2026 10:00')]);
    const fresh = z(
      [],
      [attempt('Test 1', 7, '1. 10. 2026 10:00'), attempt('Test 1', 9, '8. 10. 2026 10:00')]
    );
    expect(diffZaznamnik(prev, fresh)).toEqual([{ label: 'Test 1', value: '9/10' }]);

    const regraded = z([], [attempt('Test 1', 8, '1. 10. 2026 10:00')]);
    expect(diffZaznamnik(prev, regraded)).toEqual([{ label: 'Test 1', value: '8/10' }]);
  });

  it('reports nothing for unchanged attempts that share a name and a time', () => {
    // A real subject lists 25 attempts under 12 distinct name+time pairs.
    const same = () =>
      z(
        [],
        [
          attempt('Průběžný test', 4, '8. 10. 2026 10:00'),
          attempt('Průběžný test', 9, '8. 10. 2026 10:00'),
          attempt('Průběžný test', 6, '8. 10. 2026 10:00'),
        ]
      );
    expect(diffZaznamnik(same(), same())).toEqual([]);
  });

  it('still reports a changed score among attempts that share a name and a time', () => {
    const prev = z(
      [],
      [attempt('Test', 4, '8. 10. 2026 10:00'), attempt('Test', 9, '8. 10. 2026 10:00')]
    );
    const fresh = z(
      [],
      [attempt('Test', 4, '8. 10. 2026 10:00'), attempt('Test', 10, '8. 10. 2026 10:00')]
    );
    expect(diffZaznamnik(prev, fresh)).toEqual([{ label: 'Test', value: '10/10' }]);
  });

  it('ignores attempts that share a name and a time when IS lists them in another order', () => {
    const at = '8. 10. 2026 10:00';
    const prev = z([], [attempt('Test', 4, at), attempt('Test', 9, at), attempt('Test', 6, at)]);
    const fresh = z([], [attempt('Test', 6, at), attempt('Test', 4, at), attempt('Test', 9, at)]);
    expect(diffZaznamnik(prev, fresh)).toEqual([]);
  });

  it('reports only the new one when an attempt is added among tied attempts', () => {
    const at = '8. 10. 2026 10:00';
    const prev = z([], [attempt('Test', 4, at), attempt('Test', 9, at)]);
    const fresh = z([], [attempt('Test', 9, at), attempt('Test', 7, at), attempt('Test', 4, at)]);
    expect(diffZaznamnik(prev, fresh)).toEqual([{ label: 'Test', value: '7/10' }]);
  });
});

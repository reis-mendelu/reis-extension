import { describe, expect, it } from 'vitest';
import type { SemesterStats } from '../../../types/documents';
import { garantBoundaries, garantChange, plainName } from '../garantChange';

const sem = (semesterName: string, year: number, garant?: string): SemesterStats => ({
  semesterName,
  semesterId: `${semesterName}-${year}`,
  year,
  totalPass: 5,
  totalFail: 5,
  type: 'exam',
  terms: [],
  ...(garant ? { garant } : {}),
});

describe('plainName', () => {
  it('drops academic titles before and after the name', () => {
    expect(plainName('doc. Ing. Oldřich Trenz, Ph.D.')).toBe('Oldřich Trenz');
    expect(plainName('prof. RNDr. Ing. Jan Novák, CSc., MBA')).toBe('Jan Novák');
    expect(plainName('Mgr. Lenka Zouhar Ludvíková, Ph.D.')).toBe('Lenka Zouhar Ludvíková');
    expect(plainName('Eva Malá')).toBe('Eva Malá');
  });
});

describe('garantChange (newest first)', () => {
  it('is null when every shown semester had the same garant', () => {
    expect(garantChange([sem('ZS', 2025, 'A'), sem('ZS', 2024, 'A')])).toBeNull();
  });

  it('is null when no semester knows its garant', () => {
    expect(garantChange([sem('ZS', 2025), sem('ZS', 2024)])).toBeNull();
  });

  it('names the semester the current garant took over, and who was before', () => {
    const stats = [
      sem('LS', 2025, 'Y'),
      sem('ZS', 2025, 'Y'),
      sem('LS', 2024, 'X'),
      sem('ZS', 2024, 'X'),
    ];
    expect(garantChange(stats)).toEqual({ since: stats[1], before: 'X', now: 'Y' });
  });

  it('reports the most recent change when there were several', () => {
    const stats = [sem('ZS', 2025, 'Z'), sem('ZS', 2024, 'Y'), sem('ZS', 2023, 'X')];
    expect(garantChange(stats)).toEqual({ since: stats[0], before: 'Y', now: 'Z' });
  });

  it('looks past semesters whose garant is unknown', () => {
    const stats = [sem('ZS', 2025, 'Y'), sem('ZS', 2024), sem('ZS', 2023, 'X')];
    expect(garantChange(stats)).toEqual({ since: stats[0], before: 'X', now: 'Y' });
  });

  it('compares without titles, so a new degree is not a new garant', () => {
    expect(
      garantChange([
        sem('ZS', 2025, 'doc. Ing. Jan Novák, Ph.D.'),
        sem('ZS', 2024, 'Ing. Jan Novák'),
      ])
    ).toBeNull();
  });
});

describe('garantBoundaries', () => {
  it('marks the index of each chip that starts a different garant than the one before it', () => {
    const stats = [
      sem('ZS', 2025, 'Y'),
      sem('ZS', 2024, 'Y'),
      sem('ZS', 2023),
      sem('ZS', 2022, 'X'),
    ];
    expect([...garantBoundaries(stats)]).toEqual([3]);
  });

  it('is empty when the garant never changed', () => {
    expect(garantBoundaries([sem('ZS', 2025, 'A'), sem('ZS', 2024, 'A')]).size).toBe(0);
  });
});

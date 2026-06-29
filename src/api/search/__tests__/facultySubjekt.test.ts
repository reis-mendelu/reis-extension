import { describe, it, expect } from 'vitest';
import { FACULTY_SUBJEKT_ID, facultySubjektId } from '../facultySubjekt';

describe('facultySubjektId', () => {
  it('maps every known student faculty acronym to its IS workplace (subjekt) id', () => {
    expect(facultySubjektId('PEF')).toBe('43110');
    expect(facultySubjektId('AF')).toBe('43210');
    expect(facultySubjektId('LDF')).toBe('43410');
    expect(facultySubjektId('ZF')).toBe('43510');
    expect(facultySubjektId('FRRMS')).toBe('43310');
    expect(facultySubjektId('ICV')).toBe('43710');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(facultySubjektId('  pef ')).toBe('43110');
    expect(facultySubjektId('Af')).toBe('43210');
  });

  it('returns undefined for unknown / empty faculty so search falls back to university-wide', () => {
    expect(facultySubjektId(null)).toBeUndefined();
    expect(facultySubjektId(undefined)).toBeUndefined();
    expect(facultySubjektId('')).toBeUndefined();
    expect(facultySubjektId('XYZ')).toBeUndefined();
  });

  it('exposes the raw map for the six student faculties', () => {
    expect(Object.keys(FACULTY_SUBJEKT_ID).sort()).toEqual(['AF', 'FRRMS', 'ICV', 'LDF', 'PEF', 'ZF']);
  });
});

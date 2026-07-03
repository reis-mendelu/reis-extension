import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanGroupName, shortenStatusText, isThisSemester } from '../utils';

describe('SubjectsPanel utils', () => {
  describe('cleanGroupName', () => {
    it('strips Czech prefixes with colon/dash/space correctly', () => {
      expect(cleanGroupName('Skupina předmětů: Povinné předměty')).toBe('Povinné předměty');
      expect(cleanGroupName('Skupiny předmětů: Volitelné')).toBe('Volitelné');
      expect(cleanGroupName('Skupina: Oborové')).toBe('Oborové');
      // IS serves the genitive ("…povinně volitelných"); we normalize to the
      // clean nominative display form (group-rename feature, commit d853ccc).
      expect(cleanGroupName('Skupina předmětů povinně volitelných')).toBe('Povinně volitelné');
      expect(cleanGroupName('Skupina předmětů - Volitelné')).toBe('Volitelné');
    });

    it('strips English prefixes with colon/dash/space correctly', () => {
      expect(cleanGroupName('A group of courses: Compulsory')).toBe('Compulsory');
      expect(cleanGroupName('Groups of courses: Electives')).toBe('Electives');
      expect(cleanGroupName('Group: Core')).toBe('Core');
      expect(cleanGroupName('A group of elective courses')).toBe('Elective courses');
    });

    it('strips trailing min constraints correctly', () => {
      expect(cleanGroupName('Skupina předmětů povinně volitelných (min. 2 př.)')).toBe('Povinně volitelné');
      expect(cleanGroupName('Skupina: Oborové (min. 12 kr.)')).toBe('Oborové');
      expect(cleanGroupName('Group: Core (min 3 courses)')).toBe('Core');
    });

    it('keeps other names intact and capitalizes them', () => {
      expect(cleanGroupName('obecné předměty')).toBe('Obecné předměty');
    });
  });

  describe('shortenStatusText', () => {
    it('handles Czech statuses', () => {
      expect(shortenStatusText('splněna')).toBe('Splněno');
      expect(shortenStatusText('nesplněna, chybí 5 předmětů')).toBe('Chybí 5 pr.');
      expect(shortenStatusText('nesplněna, chybí 12 kreditů')).toBe('Chybí 12 kr.');
      expect(shortenStatusText('nesplněna, chybí 1 předmět')).toBe('Chybí 1 pr.');
      expect(shortenStatusText('nesplněna, chybí něco jiného')).toBe('Chybí něco jiného');
    });

    it('handles English statuses', () => {
      expect(shortenStatusText('fulfilled')).toBe('Fulfilled');
      expect(shortenStatusText('not fulfilled, 5 courses missing')).toBe('5 missing');
      expect(shortenStatusText('not fulfilled, 12 credits missing')).toBe('12 cr. missing');
      expect(shortenStatusText('not fulfilled, 1 course missing')).toBe('1 missing');
      expect(shortenStatusText('not fulfilled, something else')).toBe('Missing something else');
    });

    it('returns empty string for empty input', () => {
      expect(shortenStatusText('')).toBe('');
    });
  });

  describe('isThisSemester', () => {
    beforeEach(() => {
      // Pin "now" inside the winter semester (Sep 1 – Jan 31) for deterministic ranges.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15)); // 15 Jan 2026
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('accepts Czech dot-separated dates (DD.MM.YYYY)', () => {
      expect(isThisSemester('04.06.2025')).toBe(false); // outside winter semester range
      expect(isThisSemester('15.11.2025')).toBe(true); // inside winter semester
    });

    it('accepts English slash-separated dates in MM/DD/YYYY (US) order', () => {
      // Verified against a real IS Mendelu record for the same subject: the
      // Czech page shows "14.01.2026", the English page shows "01/14/2026" —
      // day 14 can't be a month, confirming month-first order in English.
      expect(isThisSemester('06/04/2025')).toBe(false); // 4 Jun 2025, outside winter semester
      expect(isThisSemester('11/15/2025')).toBe(true); // 15 Nov 2025, inside winter semester
    });

    it('returns false for missing or malformed dates', () => {
      expect(isThisSemester(undefined)).toBe(false);
      expect(isThisSemester('')).toBe(false);
      expect(isThisSemester('not-a-date')).toBe(false);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { cleanGroupName, shortenStatusText } from '../utils';

describe('SubjectsPanel utils', () => {
  describe('cleanGroupName', () => {
    it('strips Czech prefixes correctly', () => {
      expect(cleanGroupName('Skupina předmětů: Povinné předměty')).toBe('Povinné předměty');
      expect(cleanGroupName('Skupiny předmětů: Volitelné')).toBe('Volitelné');
      expect(cleanGroupName('Skupina: Oborové')).toBe('Oborové');
    });

    it('strips English prefixes correctly', () => {
      expect(cleanGroupName('A group of courses: Compulsory')).toBe('Compulsory');
      expect(cleanGroupName('Groups of courses: Electives')).toBe('Electives');
      expect(cleanGroupName('Group: Core')).toBe('Core');
    });

    it('keeps other names intact', () => {
      expect(cleanGroupName('Obecné předměty')).toBe('Obecné předměty');
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
});

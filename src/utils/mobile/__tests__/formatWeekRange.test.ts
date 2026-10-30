import { describe, it, expect } from 'vitest';
import { formatWeekRange } from '../formatWeekRange';

describe('formatWeekRange', () => {
  const mon = new Date(2026, 9, 12);
  const fri = new Date(2026, 9, 16);
  // A week across a month boundary.
  const monSep = new Date(2026, 8, 28);
  const friOct = new Date(2026, 9, 2);

  // The Týden title. Numeric, because it sits beside four header actions.
  it('writes the calendar title numerically', () => {
    expect(formatWeekRange(mon, fri, 'cz', 'numeric')).toBe('12.–16. 10.');
    expect(formatWeekRange(monSep, friOct, 'cz', 'numeric')).toBe('28. 9. – 2. 10.');
  });

  // The menu sheet's subtitle has the room for the month's name.
  it('names the month where there is room', () => {
    expect(formatWeekRange(mon, fri, 'cz', 'long')).toBe('12.–16. října');
    expect(formatWeekRange(monSep, friOct, 'cz', 'long')).toBe('28. září – 2. října');
  });

  // Day first in English: en-US's "10/12" reads as 10 December in Europe.
  it('puts the day first in English', () => {
    // Intl spaces the dash with thin spaces, and engines differ; compare words.
    const plain = (s: string) => s.replace(/\s+/gu, ' ');
    expect(plain(formatWeekRange(mon, fri, 'en', 'numeric'))).toBe('12 – 16 Oct');
    expect(plain(formatWeekRange(mon, fri, 'en', 'long'))).toBe('12 – 16 October');
  });
});

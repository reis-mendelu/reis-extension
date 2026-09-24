import { describe, it, expect } from 'vitest';
import { withoutLang } from '../folderUrl';

// Both shapes are real, from the subjects list (dev snapshot, 2026-09-24).
describe('withoutLang', () => {
  it.each([
    [
      'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=2;lang=cz',
      'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=2',
    ],
    [
      'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=2',
      'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=2',
    ],
    ['https://is.mendelu.cz/x.pl?lang=cz;id=2', 'https://is.mendelu.cz/x.pl?id=2'],
  ])('%s → %s', (input, expected) => {
    expect(withoutLang(input)).toBe(expected);
  });
});

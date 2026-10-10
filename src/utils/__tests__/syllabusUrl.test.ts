import { describe, it, expect } from 'vitest';
import { syllabusUrl } from '../syllabusUrl';

describe('syllabusUrl', () => {
  it("addresses the subject's syllabus page in IS, in the app's language", () => {
    expect(syllabusUrl('159410', 'cz')).toBe(
      'https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=159410;lang=cz'
    );
    expect(syllabusUrl('159410', 'en')).toBe(
      'https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=159410;lang=en'
    );
  });

  // IS takes the app's own codes; 'cs' is a BCP-47 locale and IS does not
  // know it. Anything that is not Czech gets the English page.
  it('never hands IS a locale code', () => {
    expect(syllabusUrl('1', 'cs')).toBe(
      'https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=1;lang=en'
    );
  });
});

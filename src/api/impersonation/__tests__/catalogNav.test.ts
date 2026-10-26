import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { findPeriodPoc, findLeafUrl, programmeUrl, typStudiaFor } from '../catalogNav';
import { parseDoc } from '../text';

const fx = (n: string) =>
  parseDoc(
    readFileSync(resolve(process.cwd(), 'src/api/impersonation/__tests__/fixtures', n), 'utf8')
  );

describe('catalogue navigation (real PEF catalogue pages, 2026-09-26)', () => {
  it('finds the intake period id by its exact label', () => {
    const d = fx('catalog-periods-pef.html');
    expect(findPeriodPoc(d, 'ZS 2026/2027')).toBe('829');
    expect(findPeriodPoc(d, 'ZS 2025/2026')).toBe('801');
    // "ZS 2012/2013 - CV" must not satisfy "ZS 2012/2013".
    expect(findPeriodPoc(d, 'ZS 2012/2013')).toBe('313');
    expect(findPeriodPoc(d, 'ZS 1987/1988')).toBeNull();
  });
  it('finds the prezenční plan leaf on the programme page', () => {
    const url = findLeafUrl(fx('catalog-programme-bf-801.html'));
    expect(url).toContain('stud_plan=12490');
    expect(url).toMatch(/^https:\/\/is\.mendelu\.cz\/katalog\/plany\.pl\?/);
    expect(url).not.toContain('predmety_sz');
  });
  it('keeps the /auth/ path the authenticated programme page links to', () => {
    const url = findLeafUrl(fx('catalog-programme-bf-801.auth.html'));
    expect(url).toMatch(/^https:\/\/is\.mendelu\.cz\/auth\/katalog\/plany\.pl\?.*stud_plan=12490/);
  });
  it('builds the programme URL IS expects', () => {
    expect(programmeUrl('2', '801', '1', '1889')).toBe(
      'https://is.mendelu.cz/auth/katalog/plany.pl?fakulta=2;poc_obdobi=801;typ_ss=;typ_studia=1;program=1889;misto_vyuky=;lang=cz'
    );
  });
  it('maps short codes to study types (v1: B- and N- only)', () => {
    expect(typStudiaFor('B-F')).toBe('1');
    expect(typStudiaFor('N-F')).toBe('4');
    expect(typStudiaFor('Z-EXC')).toBeNull();
  });
});

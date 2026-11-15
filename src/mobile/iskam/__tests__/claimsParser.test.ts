import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseClaims } from '../claimsParser';

const fixture = readFileSync(resolve(__dirname, 'fixtures/pohledavky.html'), 'utf8');
const fixtureEn = readFileSync(resolve(__dirname, 'fixtures/pohledavky-en.html'), 'utf8');

describe('parseClaims', () => {
  it('reads the open claim from the live page (2026-11-15)', () => {
    expect(parseClaims(fixture)).toEqual([
      {
        id: '00000000-0000-0000-0000-000000000001',
        due: '2026-11-20',
        description: 'Ubytování 31.10.2026 - 30.11.2026',
        remaining: 4815,
      },
    ]);
  });

  it('skips the Celkem row, which has no pay button', () => {
    expect(parseClaims(fixture)).toHaveLength(1);
  });

  it('reads the page with nothing owed (just after paying) as no claims', () => {
    const empty = readFileSync(resolve(__dirname, 'fixtures/pohledavky-empty.html'), 'utf8');
    expect(parseClaims(empty)).toEqual([]);
  });

  // Neither the table nor the signed-in page's pay dialog: "cannot tell".
  it('returns null when it is not the signed-in claims page', () => {
    expect(parseClaims('<html lang="cs"><body><p>Základní údaje</p></body></html>')).toBeNull();
  });

  it('leaves out a row whose amount or id cannot be read', () => {
    const broken = fixture
      .replace(
        '4 815 Kč</td>\n <td class="tdRight moneyCol">0 Kč</td>\n <td class="tdRight bold moneyCol">4 815 Kč',
        '4 815 Kč</td>\n <td class="tdRight moneyCol">0 Kč</td>\n <td class="tdRight bold moneyCol">??'
      )
      .replace('data-id="00000000-0000-0000-0000-000000000001"', 'data-id="x"');
    expect(parseClaims(broken)).toEqual([]);
  });

  it('reads an English page, where the comma groups thousands', () => {
    const en = fixture
      .replace('<html lang="cs">', '<html lang="en">')
      .replaceAll('4 815 Kč', '4,815 Kč');
    expect(parseClaims(en)?.[0]?.remaining).toBe(4815);
  });

  it('never returns a GUID that could break out of the injected script', () => {
    const evil = fixture.replace(
      'data-id="00000000-0000-0000-0000-000000000001"',
      `data-id="1'];alert(1);//"`
    );
    expect(parseClaims(evil)).toEqual([]);
  });

  // A phone in English gets WebISKAM in English: month-first date, comma
  // thousands. The first device test found nothing because of the date.
  it('reads the English page (phone set to English)', () => {
    expect(parseClaims(fixtureEn)).toEqual([
      {
        id: '00000000-0000-0000-0000-000000000001',
        due: '2026-11-20',
        description: 'Accomodation 31.10.2026 - 30.11.2026',
        remaining: 4815,
      },
    ]);
  });

  it('rejects a date that is neither format, or out of range', () => {
    for (const bad of ['2026-11-20', '13/20/2026', '20.13.2026', '']) {
      const page = fixture.replace(
        '<td class="dateCol">20.11.2026</td>',
        `<td class="dateCol">${bad}</td>`
      );
      expect(parseClaims(page)).toEqual([]);
    }
  });
});

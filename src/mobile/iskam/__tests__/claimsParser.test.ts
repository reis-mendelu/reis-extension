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

  // One malformed field at a time, and each replacement must really change
  // the fixture (an earlier version's amount replace silently matched nothing).
  const changed = (from: string, to: string) => {
    expect(fixture).toContain(from);
    return fixture.replace(from, to);
  };

  it('an unreadable amount makes it "cannot tell" (null), never a shorter list', () => {
    const page = changed(
      '<td class="tdRight bold moneyCol">4 815 Kč</td>',
      '<td class="tdRight bold moneyCol">??</td>'
    );
    expect(parseClaims(page)).toBeNull();
  });

  it('an unreadable id makes it "cannot tell" (null)', () => {
    const page = changed('data-id="00000000-0000-0000-0000-000000000001"', 'data-id="x"');
    expect(parseClaims(page)).toBeNull();
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
    expect(parseClaims(evil)).toBeNull();
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

  it('a date that is neither format, or out of range, is "cannot tell"', () => {
    for (const bad of ['2026-11-20', '13/20/2026', '20.13.2026', '31.02.2026', '2/30/2026', '']) {
      const page = fixture.replace(
        '<td class="dateCol">20.11.2026</td>',
        `<td class="dateCol">${bad}</td>`
      );
      expect(parseClaims(page)).toBeNull();
    }
  });
});

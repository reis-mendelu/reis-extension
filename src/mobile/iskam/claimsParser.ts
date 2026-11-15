/**
 * Open payments (pohledávky) from WebISKAM's /InformaceOKlientovi.
 *
 * A PARSER of IS-shaped HTML: see CLAUDE.md > Parser Rules. Evidence: the live
 * page on 2026-11-15 with one claim open (__tests__/fixtures/pohledavky.html).
 * The table is `#omezeniPohledavkyTable`; a claim is a row with WebISKAM's own
 * pay button `.payfrommainaccount[data-id]`, and the "Celkem" row has none.
 * Cells: 0 due date, 1 description, 4 "Zbývá uhradit".
 *
 * null when the table is missing: the page with nothing owed has not been
 * seen yet, so a missing table means "cannot tell", and the app shows nothing.
 *
 * reIS never pays a claim. The id is only used to open WebISKAM's own
 * "Uhradit" dialog for it, where the student taps WebISKAM's button
 * (iskamPayClaim.ts; src/test/guards/iskamNeverPays.test.ts).
 */
export interface Claim {
  /** WebISKAM's id for the claim, a GUID, checked here. */
  id: string;
  /** ISO date, YYYY-MM-DD. */
  due: string;
  /** WebISKAM's own text, in the page's language. */
  description: string;
  /** "Zbývá uhradit", in Kč. */
  remaining: number;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
// The same strict shapes as kontaParser (not imported: that parser stays as verified).
const AMOUNT_CS = /^(-?(?:\d{1,3}(?:\s\d{3})+|\d+)(?:,\d{1,2})?)\s*Kč$/;
const AMOUNT_EN = /^(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)\s*Kč$/;

function cellText(row: Element, i: number): string {
  return row.children[i]?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function amountOf(text: string, english: boolean): number | null {
  const m = text.match(english ? AMOUNT_EN : AMOUNT_CS);
  if (!m?.[1]) return null;
  const digits = english ? m[1].replace(/,/g, '') : m[1].replace(/\s/g, '').replace(',', '.');
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export function parseClaims(html: string): Claim[] | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('#omezeniPohledavkyTable');
  if (!table) return null;
  const english = /^en\b/i.test(doc.documentElement.lang);
  const claims: Claim[] = [];
  for (const row of Array.from(table.querySelectorAll('tbody tr'))) {
    const id = row.querySelector('.payfrommainaccount')?.getAttribute('data-id') ?? '';
    const date = cellText(row, 0).match(DATE);
    const remaining = amountOf(cellText(row, 4), english);
    if (!GUID.test(id) || !date || remaining === null || remaining <= 0) continue;
    const [, d, m, y] = date;
    claims.push({
      id,
      due: `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`,
      description: cellText(row, 1),
      remaining,
    });
  }
  return claims;
}

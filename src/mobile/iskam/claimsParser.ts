/**
 * Open payments (pohledávky) from WebISKAM's /InformaceOKlientovi.
 *
 * A PARSER of IS-shaped HTML: see CLAUDE.md > Parser Rules. Evidence: the live
 * page on 2026-11-15 with one claim open (__tests__/fixtures/pohledavky.html).
 * The table is `#omezeniPohledavkyTable`; a claim is a row with WebISKAM's own
 * pay button `.payfrommainaccount[data-id]`, and the "Celkem" row has none.
 * Cells: 0 due date, 1 description, 4 "Zbývá uhradit" / "To be paid".
 *
 * WebISKAM answers in the PHONE's language, and many students' phones are in
 * English: the same table then says "11/20/2026" and "5,370 Kč". Both are read
 * (fixtures/pohledavky.html and pohledavky-en.html).
 *
 * [] when nothing is owed: the panel disappears and only the hidden pay dialog
 * stays (seen 2026-11-15, fixtures/pohledavky-empty.html). null when neither is
 * there: not the signed-in claims page, so "cannot tell".
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
// Czech "20.11.2026" (day first); English "11/20/2026" (month first). Measured
// on the live page in both languages, 2026-11-15. The separator decides the
// order, so a page whose lang attribute is odd still reads right.
const DATE_CS = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const DATE_EN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function isoDate(text: string): string | null {
  const cs = text.match(DATE_CS);
  const en = cs ? null : text.match(DATE_EN);
  const [day, month, year] = cs ? [cs[1], cs[2], cs[3]] : en ? [en[2], en[1], en[3]] : [];
  if (!day || !month || !year) return null;
  const d = Number(day);
  const m = Number(month);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
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
  // Nothing owed: the panel is gone but the signed-in page's pay dialog is not
  // (fixtures/pohledavky-empty.html). Without either, it is not that page.
  if (!table) return doc.getElementById('ZaplatitZKonta') ? [] : null;
  const english = /^en\b/i.test(doc.documentElement.lang);
  const claims: Claim[] = [];
  for (const row of Array.from(table.querySelectorAll('tbody tr'))) {
    const id = row.querySelector('.payfrommainaccount')?.getAttribute('data-id') ?? '';
    const due = isoDate(cellText(row, 0));
    const remaining = amountOf(cellText(row, 4), english);
    if (!GUID.test(id) || !due || remaining === null || remaining <= 0) continue;
    claims.push({
      id,
      due,
      description: cellText(row, 1),
      remaining,
    });
  }
  return claims;
}

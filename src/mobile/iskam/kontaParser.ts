/**
 * The Hlavní konto balance from WebISKAM's /Konta.
 *
 * A PARSER of IS-shaped HTML: see CLAUDE.md > Parser Rules. Evidence: the live
 * page on 2026-10-13 (structure reproduced in __tests__/fixtures/konta.html).
 * Four `.vyskaRiadkuKonto` rows; cell 0 the account name, cell 1 "N,NN Kč".
 *
 * The row is identified by its top-up link, `/Platby/NabitiKonta/0`, which does
 * not change with the page language; the name is only the fallback. A row whose
 * amount cannot be read returns null, so a changed page shows "unavailable"
 * rather than a wrong number.
 *
 * WebISKAM answers in the PHONE's language (the login popup's Accept-Language
 * sets its language cookie), and the number format follows: Czech
 * "1 234,56 Kč", English "1,234.56 Kč" (measured on a Pixel 9a set to English,
 * 2026-10-13). The page's own `<html lang>` says which one it is. Only the
 * amount is returned — the app formats it in its own language.
 */
export interface KontoBalance {
  amount: number;
}

const ROW = '.vyskaRiadkuKonto';
const MAIN_TOP_UP = /\/Platby\/NabitiKonta\/0(?:$|[?#])/;
const MAIN_NAME = /^(Hlavní konto|Main account)$/i;
const AMOUNT_CS = /^(-?\d[\d\s]*(?:,\d+)?)\s*Kč$/;
const AMOUNT_EN = /^(-?\d[\d,]*(?:\.\d+)?)\s*Kč$/;

export function parseHlavniKonto(html: string): KontoBalance | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll(ROW));
  const row =
    rows.find((r) =>
      Array.from(r.querySelectorAll('a[href]')).some((a) =>
        MAIN_TOP_UP.test(a.getAttribute('href') ?? '')
      )
    ) ?? rows.find((r) => MAIN_NAME.test(r.children[0]?.textContent?.trim() ?? ''));
  const text = row?.children[1]?.textContent?.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const english = /^en\b/i.test(doc.documentElement.lang);
  const m = text.match(english ? AMOUNT_EN : AMOUNT_CS);
  if (!m?.[1]) return null;
  const digits = english ? m[1].replace(/,/g, '') : m[1].replace(/\s/g, '').replace(',', '.');
  const amount = Number(digits);
  return Number.isFinite(amount) ? { amount } : null;
}

// DOM helpers for clovek.pl (personProfile.ts, search/peopleParserProfile.ts).
// Pure: no fetch, no store. Split out of personProfile.ts to keep both files small.
import { boldSpans } from './studyPlanHeading';

/**
 * Collapses IS's nbsp-laden whitespace so a value can be compared or shown.
 * `\s` already covers U+00A0, which is what IS's `&nbsp;` decodes to — no
 * separate pass for it.
 */
export function tidy(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, ' ').trim() || null;
}

/**
 * The contact block is a two-column table: a label cell, then its value.
 * Blank spacer rows carry `colspan="2"` and are skipped by the length check.
 *
 * Read by label rather than by row index — IS omits any row the person has not
 * filled in, so positions shift from profile to profile.
 */
export function readLabelledRows(doc: Document): Map<string, HTMLTableCellElement> {
  const out = new Map<string, HTMLTableCellElement>();
  for (const row of Array.from(doc.querySelectorAll('tr'))) {
    const cells = row.querySelectorAll<HTMLTableCellElement>('td.odsazena');
    if (cells.length !== 2) continue;
    const label = tidy(cells[0]?.textContent)?.replace(/:$/, '');
    const value = cells[1];
    if (label && value) out.set(label, value);
  }
  return out;
}

export function deobfuscate(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.replace(/\s*\[at\]\s*/g, '@').trim() || null;
}

/**
 * The whole text of the first `td.odsazena` whose content matches `marker`.
 *
 * Returns the CELL, not the matched substring. The study sentences each occupy
 * a cell of their own on both language versions, so the cell text is already
 * exactly the sentence — and matching on a frame word ("typ studia" / "type of
 * study") instead of on an enumeration of degree names means the parser does
 * not have to know every value IS can put there. Enumerating them is what made
 * this Czech-only: `Bakalářský|Magisterský|…` has no English equivalent that
 * stays true as MENDELU adds programmes.
 */
export function findTdMatching(doc: Document, marker: RegExp): string | null {
  const tds = Array.from(doc.querySelectorAll('td.odsazena'));
  for (const td of tds) {
    // LEAF cells only. The header's photo/detail layout nests a whole table
    // inside a `td.odsazena`, so the outer cell's textContent is every study
    // line concatenated — and being an ancestor it comes FIRST in document
    // order, so a container check is what stops the match returning the entire
    // header block instead of the one sentence.
    if (td.querySelector('td')) continue;
    const text = (td.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (marker.test(text)) return text;
  }
  return null;
}

/**
 * First present label among `aliases`, which are the same row in each language.
 *
 * IS translates every contact label, so a lookup that knows only the Czech one
 * returns null on an English page rather than failing loudly — the exact shape
 * of #206. Aliases are matched exactly (after `readLabelledRows` has tidied and
 * dropped the trailing colon), so "Office number" cannot collide with "Office
 * phone number" or "Office address".
 */
export function labelled(rows: Map<string, HTMLTableCellElement>, ...aliases: string[]) {
  for (const alias of aliases) {
    const cell = rows.get(alias);
    if (cell) return cell;
  }
  return undefined;
}

/**
 * The person's name on clovek.pl: `<b><font size="+1">` before the UIS redesign,
 * a bold `<span style="font-size: 1.125rem; font-weight: bold;">` since
 * (is.mendelu.cz, 2026-11-15, real page in both locales). The old path stays
 * first; the span is consulted only where it finds nothing.
 */
export function personNameElement(doc: ParentNode): Element | null {
  return (
    doc.querySelector('td.odsazena b font[size="+1"]') ??
    boldSpans(doc).find((el) => !!el.closest('td.odsazena')) ??
    null
  );
}

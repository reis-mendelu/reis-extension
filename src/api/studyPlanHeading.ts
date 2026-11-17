/**
 * Headings of Kontrola plánu, in both IS markups.
 *
 * Production IS prints a semester / whole-plan heading as
 * `<b><font size="+1">…</font></b>`. The next IS release (seen on
 * test.is.mendelu.cz, 2026-11-09) prints the same heading as
 * `<span style="font-size: 1.125rem; font-weight: bold;">…</span>` and keeps
 * `<b>` everywhere else on the page. Nobody knows the day it ships, so the old
 * path stays first and untouched: a bold span is consulted only where the old
 * markup has nothing. See `__tests__/studyPlanNewIsHeadings.test.ts`.
 */

const BOLD_STYLE = /font-weight:\s*(bold|[6-9]00)\b/i;

/** `<span>`s that the new IS uses in place of `<b><font size="+1">`. */
export function boldSpans(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll('span[style]')).filter((el) =>
    BOLD_STYLE.test(el.getAttribute('style') || '')
  );
}

/** Text of a row's heading: its first `<b>` (old IS), else its first bold span (new IS). */
export function rowHeadingText(row: Element): string {
  const el = row.querySelector('b') ?? boldSpans(row)[0];
  return el ? (el.textContent || '').trim() : '';
}

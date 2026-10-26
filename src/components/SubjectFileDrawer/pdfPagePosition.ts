/**
 * Where the reader is in a PDF, for reopening it on the same page. Pure: the
 * viewer measures, these decide. 0-based page indices throughout, the same
 * numbering the iPad's native reader stores (src/mobile/pdfCache.ts).
 */

/**
 * The page to reopen on. A saved page past the end — the teacher re-uploaded a
 * shorter deck — lands on the last page rather than back at the top: the
 * student was near the end, and that is still the nearest place.
 */
export function clampPageIndex(saved: number | null | undefined, pageCount: number): number {
  if (saved == null || !Number.isInteger(saved) || saved < 0 || pageCount <= 0) return 0;
  return Math.min(saved, pageCount - 1);
}

/** The page being read: the last one whose top is at or above the reading line. */
export function pageAtOffset(tops: number[], line: number): number {
  let page = 0;
  for (let i = 0; i < tops.length; i++) {
    if ((tops[i] ?? Infinity) <= line) page = i;
    else break;
  }
  return page;
}

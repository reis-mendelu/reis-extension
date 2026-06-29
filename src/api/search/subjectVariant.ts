/**
 * Helpers for collapsing and ranking subject search results.
 *
 * MENDELU PEF subject codes encode the language of instruction in the third
 * character: the `E?A-…` family (EBA-, ENA-, EXA-, EDA-) is taught in English
 * ("v AJ"), its `E?C-…` twin (EBC-, ENC-, …) is the Czech version.
 */
const ENGLISH_VARIANT_RE = /^E[BNXD]A-/i;

/** True when the code is the English-taught ("v AJ") variant of a subject. */
export function isEnglishVariantCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return ENGLISH_VARIANT_RE.test(code);
}

/**
 * A sortable rank for a semester label, higher = more recent.
 * Handles both CZ (ZS/LS) and EN (WS/SS) labels; within an academic year the
 * summer term (LS/SS) ranks after the winter term (ZS/WS). Unparseable → -1.
 */
export function semesterRank(semester: string | null | undefined): number {
  if (!semester) return -1;
  const m = semester.match(/(ZS|LS|WS|SS)\s+(\d{4})\/\d{4}/i);
  if (!m) return -1;
  const term = m[1].toUpperCase();
  const year = parseInt(m[2], 10);
  const isSummer = term === 'LS' || term === 'SS';
  return year * 2 + (isSummer ? 1 : 0);
}

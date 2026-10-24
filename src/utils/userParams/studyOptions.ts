/** One study the signed-in student can switch to, as IS's switcher lists it. */
export interface StudyOption {
  studium: string;
  /** Verbatim from IS, e.g. `PEF B-OI prez [sem 3, roč 2]`. Never parsed. */
  label: string;
}

/**
 * The studies in `studium.pl`'s switcher (`#titulek select[name=studium]`).
 *
 * A student with two parallel studies is offered both there, and that is the
 * ONLY place the second study's id appears on the page: every link carries the
 * selected study alone, which is why the `studium=…;obdobi=…` regex in
 * `fetchers.ts` never learned a second one existed. A student with one study
 * gets no `<select>` at all, which reads as an empty list.
 *
 * Regex rather than DOMParser: the same fetcher runs under Node in the MCP.
 */
export function parseStudyOptions(html: string): StudyOption[] {
  const select = html.match(/<select[^>]*name="studium"[^>]*>([\s\S]*?)<\/select>/i);
  if (!select) return [];
  const options: StudyOption[] = [];
  // safe: `select` has its one capturing group required
  for (const m of select[1]!.matchAll(/<option[^>]*value="(\d+)"[^>]*>([^<]*)<\/option>/gi)) {
    // safe: both groups are required
    options.push({ studium: m[1]!, label: decodeEntities(m[2]!).trim() });
  }
  return options;
}

/**
 * The `Stav studia` value of `studium.pl` (`řádně zapsán`, …). Only the Czech
 * label is read, so callers ask for the page with `lang=cz`.
 */
export function parseStudyStatus(html: string): string | null {
  const m = html.match(/Stav\s+studia:\s*<\/td>\s*<td[^>]*>\s*([^<]+)/i);
  // safe: the capturing group is required
  return m ? decodeEntities(m[1]!).trim() : null;
}

/**
 * Whether a study is one the student attends now. Only `řádně zapsán` is a
 * captured value (2026-10-20); the exclusions are assumptions — no interrupted
 * or finished study has been seen yet — and they only ever keep the study the
 * app already runs on, never move it.
 */
export function isEnrolledStatus(status: string): boolean {
  // Anchored: `nezapsán` (not enrolled) contains `zapsán`.
  return /(^|[\s,])zapsán/i.test(status) && !/přeruš|ukonč|absolv/i.test(status);
}

function decodeEntities(s: string): string {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

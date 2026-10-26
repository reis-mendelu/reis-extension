/**
 * An Instagram handle reIS will store and link to: 1–30 of letters, digits,
 * `.` and `_`, with no dot at either end and no two dots in a row — the rules
 * Instagram itself enforces. Stricter than the database CHECK, which allows
 * the dotted forms; `..` would otherwise build instagram.com/../, the homepage.
 *
 * Shared by the society form (what gets written) and the event card (what
 * gets linked, since the stored value is data from Supabase).
 */
const HANDLE_RE = /^(?!\.)(?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;

export function isInstagramHandle(s: string): boolean {
  return HANDLE_RE.test(s);
}

/**
 * What one IS page turned out to be, decided AROUND a parser, never inside it.
 *
 * A parser that finds nothing returns an empty value, and so does one that was
 * handed a page it no longer understands. Stored, the second reads as "you have
 * no subjects / exams / plan" and replaces what the student had. Two rules
 * tell them apart, both deliberately conservative:
 *
 * - R1: a page that offered rows of which the parser understood none is
 *   unrecognised. `rows` is counted with the parser's own row selector and
 *   guards (`*PageShape.ts` beside each fetcher), so a placeholder row the
 *   parser would skip anyway is never "offered".
 * - R2: IS's login form is never an answer, not even an empty one.
 *
 * R2 tests for the login form rather than for the absence of the signed-in
 * marker (`logout.pl`): every MENDELU page carries the marker, but nothing on
 * file shows that other schools' builds do, and absence would turn a VŠE
 * student's real "no exams" into a failure.
 *
 * Neither rule can demote a page the parser read: anything understood is data.
 */

/** Counts and booleans only: no text, href or id from the page, ever. */
export interface PageShape {
  /** Rows offered, counted the way the parser selects them. */
  rows: number;
  /** The page is IS's login form, not the page asked for. */
  loginForm: boolean;
  [count: string]: number | boolean;
}

export type IsPage<T> =
  { kind: 'data'; value: T } | { kind: 'empty' } | { kind: 'unrecognised'; shape: PageShape };

export function classifyIsPage<T>(value: T, parsed: number, shape: PageShape): IsPage<T> {
  if (parsed > 0) return { kind: 'data', value };
  if (shape.rows > 0 || shape.loginForm) return { kind: 'unrecognised', shape };
  return { kind: 'empty' };
}

/** The password field of IS's login form, as a lapsed session returns it (mcp/session.ts). */
export function isLoginForm(html: string): boolean {
  return /name="credential_1"/.test(html);
}

/**
 * The error a caller logs (or throws) for an unrecognised page. The shape goes
 * in the FIRST line of the message: the diagnostic log keeps context, status
 * and that line only, so a report sent with technical details still shows it.
 */
export function notUnderstood(resource: string, shape: PageShape): Error {
  const counts = Object.entries(shape)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' ');
  return new Error(`${resource} page not understood: ${counts}`);
}

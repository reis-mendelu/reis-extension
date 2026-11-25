// Search without a model: plain string search over text already in the store
// (step 4 of the map, docs/superpowers/specs/2026-11-25-reis-for-claude-map-design.md).
// Case and diacritics are folded away on both sides, so "zapocet" finds "Zápočet".

const MARKS = /\p{M}/gu;

/**
 * Lower case, no diacritics, a PDF's ligatures ("ﬁ") spelled out. Used for the query
 * and, as one string, for a whole text.
 */
export const foldPlain = (s: string) =>
  // ς (word-final sigma) is σ: lower-casing a whole string and a single letter disagree on it.
  s.normalize('NFKD').replace(MARKS, '').toLowerCase().replace(/ς/g, 'σ');

/**
 * A text folded character by character, so a position in the folded string can be
 * turned back into a position in the original (a snippet is cut from the original).
 */
export type Folded = { text: string; origin: (folded: number) => number };

// eslint-disable-next-line no-control-regex -- the ASCII fast path is the point
const ASCII = /^[\x00-\x7f]*$/;

export function foldMapped(s: string): Folded {
  if (ASCII.test(s)) return { text: s.toLowerCase(), origin: (i) => Math.min(i, s.length) };
  const parts: string[] = [];
  const starts: number[] = [];
  // A text has a few hundred distinct non-ASCII letters; normalizing each once is what keeps
  // a multi-megabyte text fast.
  const cache = new Map<string, string>();
  for (let i = 0; i < s.length;) {
    const cp = s.codePointAt(i)!;
    const len = cp > 0xffff ? 2 : 1;
    let f: string;
    if (cp < 128) f = String.fromCharCode(cp).toLowerCase();
    else {
      const ch = s.slice(i, i + len);
      f = cache.get(ch) ?? foldPlain(ch);
      cache.set(ch, f);
    }
    if (f) {
      parts.push(f);
      for (let k = 0; k < f.length; k++) starts.push(i);
    }
    i += len;
  }
  return { text: parts.join(''), origin: (i) => (i >= starts.length ? s.length : starts[i]!) };
}

/** What the student typed: every word must be found; "a quoted phrase" must be found as written. */
export type Query = { terms: string[]; display: string[] };

export const MAX_TERMS = 12;
const MAX_TERM = 120;

export function parseQuery(raw: string): Query {
  const found: string[] = [];
  // A phrase between matching quotes (straight, curly or Czech), or a bare word. A quote
  // that never closes is stray punctuation, not the start of a phrase.
  for (const m of raw.matchAll(/"([^"]*)"|“([^”]*)”|„([^“”"]*)[“”"]|(\S+)/g)) {
    const t = (m[1] ?? m[2] ?? m[3] ?? (m[4] ?? '').replace(/["“”„]/g, ''))
      .trim()
      .replace(/\s+/g, ' ');
    // A word that is only punctuation (a stray quote, a dash) matches nothing useful.
    if (t && /[\p{L}\p{N}]/u.test(t)) found.push(t.slice(0, MAX_TERM));
  }
  const seen = new Set<string>();
  const display: string[] = [];
  const terms: string[] = [];
  for (const t of found) {
    const f = foldPlain(t);
    if (seen.has(f)) continue;
    seen.add(f);
    display.push(t);
    terms.push(f);
  }
  return { terms: terms.slice(0, MAX_TERMS), display: display.slice(0, MAX_TERMS) };
}

/**
 * One global regex per term over a folded text. A phrase's spaces match any run of
 * white space, because a PDF puts a line break between words where a student sees a space.
 */
export function termRegex(term: string): RegExp {
  const body = term
    .split(' ')
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return new RegExp(body, 'g');
}

/** How many times the term occurs, counted up to `cap`. */
export function countMatches(folded: string, re: RegExp, cap = 1000): number {
  re.lastIndex = 0;
  let n = 0;
  while (n < cap && re.exec(folded)) {
    n++;
    if (re.lastIndex === 0) break;
  }
  return n;
}

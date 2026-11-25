// The part of a hit the student's words were found in: about 200 characters each
// side, cut at word boundaries, the words themselves marked **like this**, and the
// line (or page, when the text has page breaks) it sits on.
import { foldMapped, termRegex } from './searchFold';

export const SIDE = 200;
/** Two words further apart than this are shown by the first one's neighbourhood only. */
const MAX_SPAN = 600;
// Far beyond any real text; a cap only keeps a pathological one from filling memory.
const MAX_POSITIONS = 100_000;

type Range = [number, number];

function rangesOf(folded: string, term: string): Range[] {
  const re = termRegex(term);
  const out: Range[] = [];
  for (let m = re.exec(folded); m && out.length < MAX_POSITIONS; m = re.exec(folded)) {
    out.push([m.index, m.index + m[0].length]);
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

/** The tightest stretch holding one occurrence of every word that is in the text at all. */
function tightest(lists: Range[][]): Range | null {
  const present = lists.filter((l) => l.length);
  if (!present.length) return null;
  const [anchor, ...rest] = [...present].sort((a, b) => a.length - b.length) as [
    Range[],
    ...Range[][],
  ];
  let best: Range | null = null;
  for (const [s, e] of anchor) {
    let from = s;
    let to = e;
    for (const list of rest) {
      // The occurrence nearest to this one (lists are in order, so binary search).
      let lo = 0;
      let hi = list.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (list[mid]![0] < s) lo = mid + 1;
        else hi = mid;
      }
      const near = [list[lo], list[lo - 1]].filter((r): r is Range => !!r);
      const pick = near.sort((a, b) => Math.abs(a[0] - s) - Math.abs(b[0] - s))[0]!;
      from = Math.min(from, pick[0]);
      to = Math.max(to, pick[1]);
    }
    if (!best || to - from < best[1] - best[0]) best = [from, to];
  }
  return best;
}

/** How far apart the words are in the tightest place they all occur; null if one is missing. */
export function spanOf(folded: string, terms: string[]): number | null {
  const lists = terms.map((t) => rangesOf(folded, t));
  if (lists.some((l) => !l.length)) return null;
  const w = tightest(lists);
  return w ? w[1] - w[0] : null;
}

export type Snippet = {
  snippet: string;
  /** Words found in the text close together: the most useful kind of hit. */
  together: boolean;
  line?: number;
  page?: number;
};

/**
 * Finds where the words are once (the expensive part: the whole text is folded), and returns
 * a function that cuts the snippet for a given width, so a caller that shrinks the snippets
 * to fit a size limit does not fold the text again. `terms` are folded (see parseQuery).
 * Null when none of them is in the text.
 */
export function prepareSnippet(text: string, terms: string[]): ((side: number) => Snippet) | null {
  const f = foldMapped(text);
  const lists = terms.map((t) => rangesOf(f.text, t));
  const present = lists.filter((l) => l.length).length;
  let window = tightest(lists);
  if (!window) return null;
  let together = present === terms.length;
  if (window[1] - window[0] > MAX_SPAN) {
    // Too far apart to show together: show the rarest word with its surroundings.
    const rarest = lists.filter((l) => l.length).sort((a, b) => a.length - b.length)[0]!;
    window = rarest[0]!;
    together = false;
  }
  const found = window;
  return (side) => cut(text, f, lists, found, together, side);
}

export const snippetFor = (text: string, terms: string[], side = SIDE): Snippet | null =>
  prepareSnippet(text, terms)?.(side) ?? null;

function cut(
  text: string,
  f: ReturnType<typeof foldMapped>,
  lists: Range[][],
  window: Range,
  together: boolean,
  side: number
): Snippet {
  const from = f.origin(window[0]);
  const to = Math.max(f.origin(window[1]), from);
  let start = Math.max(0, from - side);
  let end = Math.min(text.length, to + side);
  // Word boundaries, never cutting into the match itself.
  while (start > 0 && start < from && !/\s/.test(text[start - 1]!)) start++;
  while (end < text.length && end > to && !/\s/.test(text[end]!)) end--;

  const marks = lists
    .flat()
    .map(([a, b]): Range => {
      const from = f.origin(a);
      let to = Math.max(f.origin(b), from + 1);
      // never end between the two halves of a character outside the BMP
      if (/[\ud800-\udbff]/.test(text[to - 1] ?? '')) to++;
      return [from, to];
    })
    .filter(([a, b]) => a >= start && b <= end)
    .sort((a, b) => a[0] - b[0]);
  let out = '';
  let at = start;
  for (const [a, b] of marks) {
    if (a < at) continue; // overlaps the one before
    out += text.slice(at, a) + '**' + text.slice(a, b) + '**';
    at = b;
  }
  out += text.slice(at, end);
  const snippet = `${start > 0 ? '… ' : ''}${out.replace(/\s+/g, ' ').trim()}${end < text.length ? ' …' : ''}`;

  // A page break (form feed) means pages are known; otherwise the line is the best place to give.
  const before = text.slice(0, from);
  const hasPages = text.includes('\f');
  const count = (c: string) => before.split(c).length;
  return {
    snippet,
    together,
    ...(hasPages ? { page: count('\f') } : { line: count('\n') }),
  };
}

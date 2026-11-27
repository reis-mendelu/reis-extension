/**
 * A page's visible text, one line per block. It is what gets compared from
 * day to day (so a page counts as changed only when what a person would read
 * changed) and what Claude searches later.
 *
 * Regex, not a DOM: it runs on IS and WebISKAM markup only, it must not
 * depend on the app's runtime, and an approximate line break costs nothing.
 */

/**
 * IS's header: today's name day, the clock at the moment the page was served,
 * and the student's name. Flat divs, so one regex removes it. Without this
 * every IS page would "change" every day. Seen on every /auth/ page (2026-11-15).
 */
const IS_HEADER = /<div class="info">(?:<div[^>]*>[^<]*<\/div>)*<\/div>/g;

/** IS's main column. Everything before it is chrome: header, menu, the
 * document server's unread badge. Present on every /auth/ page (2026-11-15). */
const IS_MAIN = '<div class="mainpage">';

/** Lines that change on every load and mean nothing: the home page's usage counters. */
const VOLATILE = [
  /provedeno celkem [\d\s]+ operací/,
  /bylo přihlášeno [\d\s]+ uživatelů/,
  /v posledních 5 minutách/i,
  /operations (were|have been) performed/i,
  /in the last 5 minutes/i,
  /users? (were |have )?logged in/i,
];

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ndash: '–',
  mdash: '—',
  hellip: '…',
  times: '×',
};

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith('#')) {
      const n =
        code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Elements whose content is not text. */
const SKIP = new Set(['script', 'style', 'noscript']);
/** Closing one of these ends a line. */
const BLOCK = new Set(
  'p div tr li h1 h2 h3 h4 h5 h6 table ul ol dt dd section header footer form option label'.split(
    ' '
  )
);

/**
 * Markup to text in one left-to-right pass, no regex replacing: a tag is
 * dropped whole, script/style/noscript and comments with their content, and an
 * unclosed tag ends the text. Nothing of a tag can survive (no `<` is ever
 * copied), whatever the nesting. Cells end in a tab, blocks and <br> in a newline.
 */
function stripMarkup(html: string): string {
  const lower = html.toLowerCase();
  let out = '';
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) return out + html.slice(i);
    out += html.slice(i, lt);
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    const gt = html.indexOf('>', lt);
    if (gt < 0) return out;
    i = gt + 1;
    const m = /^(\/?)([a-z][a-z0-9]*)/.exec(lower.slice(lt + 1, gt));
    if (!m) continue;
    const closing = m[1] === '/';
    const name = m[2] ?? '';
    if (!closing && SKIP.has(name)) {
      const end = lower.indexOf(`</${name}`, i);
      const endGt = end < 0 ? -1 : html.indexOf('>', end);
      i = endGt < 0 ? html.length : endGt + 1;
    } else if (closing && (name === 'td' || name === 'th')) out += '\t';
    else if ((closing && BLOCK.has(name)) || (!closing && name === 'br')) out += '\n';
  }
  return out;
}

export function pageText(html: string): string {
  const main = html.indexOf(IS_MAIN);
  const text = stripMarkup((main >= 0 ? html.slice(main) : html).replace(IS_HEADER, ''));
  return decode(text)
    .split('\n')
    .map((line) =>
      line
        .split('\t')
        .map((cell) => cell.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\t')
    )
    .filter((line) => line && !VOLATILE.some((re) => re.test(line)))
    .join('\n');
}

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

export function pageText(html: string): string {
  const main = html.indexOf(IS_MAIN);
  const text = (main >= 0 ? html.slice(main) : html)
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(IS_HEADER, '')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(
      /<br\b[^>]*>|<\/(p|div|tr|li|h[1-6]|table|ul|ol|dt|dd|section|header|footer|form|option|label)>/gi,
      '\n'
    )
    .replace(/<[^>]+>/g, '');
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

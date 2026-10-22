// The "Pokyny" (teacher's instructions) of one IS submission box.
//
// IS draws no column text for them: the cell holds an icon whose onclick opens
// a popup, and the text is the call's second argument, a JS string of HTML —
//   uis.box.open_fixed('3','<b>{box name}:</b><p></p><p></p>{instructions}');
// (verified 2026-10-20 on the 812 and 829 pages, cz and en alike). A box
// without instructions has no icon. The HTML is read as plain text here and is
// never rendered as HTML anywhere.

/** The second quoted argument; `(?:[^'\\]|\\.)*` so a ")" or "\'" in the text cannot end it. */
const CALL = /open_fixed\(\s*'(?:[^'\\]|\\.)*'\s*,\s*'((?:[^'\\]|\\.)*)'/;

const ESCAPES: Record<string, string> = { n: '\n', r: '', t: ' ', b: '', f: '', v: '' };

function unescapeJs(s: string): string {
  return s.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, e: string) =>
    e.length > 1 ? String.fromCharCode(parseInt(e.slice(1), 16)) : (ESCAPES[e] ?? e)
  );
}

/** Paragraphs and <br> become line breaks; the rest of the markup goes, entities decode once. */
function htmlToText(html: string): string {
  const marked = html.replace(/<br\s*\/?>|<\/?p\b[^>]*>/gi, '\n');
  // A DOMParser document is inert: nothing in it runs or loads.
  const body = new DOMParser().parseFromString(`<body>${marked}</body>`, 'text/html').body;
  return (body.textContent ?? '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Plain-text instructions from the Pokyny icon's onclick, or undefined when
 * there are none. IS opens the popup with "{box name}:" in bold; the card
 * already shows the name, so that heading goes — any other heading stays.
 */
export function instructionsFromOnclick(
  onclick: string | null,
  boxName: string
): string | undefined {
  const arg = onclick?.match(CALL)?.[1];
  if (arg === undefined) return undefined;
  let html = unescapeJs(arg);

  const heading = html.match(/^\s*<b>([\s\S]*?)<\/b>/i);
  if (heading && oneLine(htmlToText(heading[1] ?? '')) === `${oneLine(boxName)}:`) {
    html = html.slice(heading[0].length);
  }
  return htmlToText(html) || undefined;
}

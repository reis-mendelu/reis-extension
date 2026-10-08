/**
 * The downloaded text, if it is a plain SVG drawing; throws otherwise.
 *
 * emoji:fetch writes what a CDN returned into public/, which ships in every
 * build. Twemoji's files are shapes and fills only, so this is an ALLOWLIST of
 * drawing elements and attributes rather than a list of dangerous ones: a
 * blocklist missed `<s:script>` bound to the SVG namespace (review on #517),
 * and would miss whatever comes next. Anything outside the list — a prefixed
 * name, a link, a style, an entity, a comment, stray text — means the response
 * is not the file we asked for, and nothing is written.
 */
const MAX_BYTES = 64 * 1024;
const SVG_NS = 'http://www.w3.org/2000/svg';

const ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'rect',
  'polygon',
  'polyline',
  'line',
]);
const ATTRIBUTES = new Set([
  'xmlns',
  'viewBox',
  'xml:space',
  'd',
  'fill',
  'fill-rule',
  'fill-opacity',
  'opacity',
  'clip-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'height',
  'points',
]);
// A colour, a number list or a path: no parentheses, no url(), no quotes or
// angle brackets. No `transform`: no Twemoji file uses one, and its pattern was
// the only regular expression here that could backtrack (CodeQL on #517).
const PLAIN_VALUE = /^[#\w\s.,%-]*$/;

export function asPlainSvg(code: string, text: string): string {
  const svg = text.trim();
  const fail = (why: string): never => {
    throw new Error(`${code}: ${why}`);
  };
  if (svg.length > MAX_BYTES) fail(`${svg.length} bytes is not an emoji`);
  if (!/^<svg[\s>][\s\S]*<\/svg>$/.test(svg)) fail('not an SVG document');

  let end = 0;
  for (const m of svg.matchAll(/<(\/?)([^\s/>]+)([^>]*)>/g)) {
    if (svg.slice(end, m.index).trim()) fail('text outside the drawing');
    end = m.index + m[0].length;
    const closing = m[1];
    const name = m[2] ?? '';
    if (!ELEMENTS.has(name)) fail(`<${name}> is not a drawing element`);
    if (closing) continue;
    const attrs = (m[3] ?? '').replace(/\/\s*$/, '');
    const leftover = attrs.replace(/\s([^\s=]+)="([^"]*)"/g, (_, key: string, value: string) => {
      if (!ATTRIBUTES.has(key)) fail(`${key}= is not a drawing attribute`);
      if (key === 'xmlns') {
        if (value !== SVG_NS) fail(`xmlns="${value}"`);
      } else if (!PLAIN_VALUE.test(value)) fail(`${key}="${value}"`);
      return '';
    });
    if (leftover.trim()) fail(`unparsed attributes on <${name}>`);
  }
  if (svg.slice(end).trim()) fail('text outside the drawing');
  return text;
}

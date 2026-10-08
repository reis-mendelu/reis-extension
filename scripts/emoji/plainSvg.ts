/**
 * The downloaded text, if it is a plain SVG drawing; throws otherwise.
 *
 * emoji:fetch writes what a CDN returned into public/, which ships in every
 * build. Twemoji's files are paths and fills only, so anything that can run or
 * load something — a script, an event handler, a link, a foreign object — means
 * the response is not the file we asked for, and nothing is written.
 */
const MAX_BYTES = 64 * 1024;
const ACTIVE =
  /<script|<foreignObject|<iframe|<image|\bon[a-z]+\s*=|href\s*=|url\s*\(|<!ENTITY|<!DOCTYPE/i;

export function asPlainSvg(code: string, text: string): string {
  const svg = text.trim();
  if (svg.length > MAX_BYTES) throw new Error(`${code}: ${svg.length} bytes is not an emoji`);
  if (!/^<svg[\s>][\s\S]*<\/svg>$/.test(svg)) throw new Error(`${code}: not an SVG document`);
  if (ACTIVE.test(svg)) throw new Error(`${code}: the SVG holds active content`);
  return text;
}

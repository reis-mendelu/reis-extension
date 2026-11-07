import type { FileAttachment, ParsedFile } from '../types/documents';

/**
 * What the drawer, the iPad reader's sidebar and reIS for Claude call a
 * document and its files, so they never disagree.
 */

/** The title as IS prints it; rows cached before `title` existed have only file_name. */
export function documentTitle(doc: Pick<ParsedFile, 'file_name' | 'title'>): string {
  return doc.title || doc.file_name;
}

/**
 * A lone file goes by its document's title, which says what it is
 * ("Přednáška 05", not "Tyden5_Uzivatele_a_bezpecnost.pptx"). One of several
 * goes by its own name: they share the title, and "Title (3)" told a student
 * nothing about which of five PDFs was the Ethernet lecture.
 */
export function attachmentLabel(
  doc: Pick<ParsedFile, 'file_name' | 'title'>,
  attachment: Pick<FileAttachment, 'filename'>,
  index: number,
  count: number
): string {
  const title = documentTitle(doc);
  if (count <= 1) return title;
  return attachment.filename || `${title} (${index + 1})`;
}

/** An extension: a final dot and up to 16 letters or digits, at least one a letter (not "2.0"). */
const EXTENSION = /\.(?=[a-z0-9]*[a-z])[a-z0-9]{1,16}$/i;
const DIGIT = /\p{N}/u;

/**
 * A file name as a row shows it: no extension (the badge beside it says PDF),
 * and `_`, `-` or `.` between two words read as spaces, so it wraps like text:
 * "ig-harm_kombinovani_PPS-ZS2026.pdf" → "ig harm kombinovani PPS ZS2026".
 * A dot or hyphen between two digits stays ("2.1", "04.10.2026", "Q1-48"), and
 * a spaced dash in a title ("Reading week - Pisařovic") is not a separator.
 * Display only: the reader, saved files and reIS for Claude keep the real name.
 */
export function prettifyFileName(name: string): string {
  const stem = name.replace(EXTENSION, '');
  if (!stem.trim()) return name;
  const spaced = stem
    .replace(/_+/g, ' ')
    .replace(
      /([\p{L}\p{N}])([-.]+)(?=[\p{L}\p{N}])/gu,
      (match, before: string, seps: string, at: number, all: string) => {
        const after = all.charAt(at + match.length);
        const numeric = seps.length === 1 && DIGIT.test(before) && DIGIT.test(after);
        return numeric ? match : `${before} `;
      }
    )
    // Leftover separators at the very ends ("__P3__final--"); an abbreviation's
    // dot ("č. 4") is inside the text and stays.
    .replace(/^[-.\s]+/, '')
    .replace(/[-\s]+$/, '');
  return spaced.replace(/\s+/g, ' ').trim() || name;
}

/**
 * `text` cut to `keep` characters in its middle, both ends kept:
 * "ig organizac…novani". The row picks `keep` by measuring (FileName.tsx).
 */
export function middleCut(text: string, keep: number): string {
  // By code point, so an emoji is never split into two broken halves.
  const chars = Array.from(text);
  if (chars.length <= keep) return text;
  if (keep < 2) return '…';
  const head = Math.ceil((keep - 1) * 0.6);
  const tail = keep - 1 - head;
  const end =
    tail > 0
      ? chars
          .slice(chars.length - tail)
          .join('')
          .trimStart()
      : '';
  return `${chars.slice(0, head).join('').trimEnd()}…${end}`;
}

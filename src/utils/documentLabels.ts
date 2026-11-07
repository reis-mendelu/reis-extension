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

/**
 * `name` cut to `keep` characters in the middle of its stem, the extension
 * whole: "Cviceni_5_Uzivat…_ukazkami.ipynb". The file row picks `keep` by
 * measuring (FileName.tsx); a clamp alone cuts the end, which is exactly where
 * ".pdf" sits. A name with no extension is cut at its end.
 */
export function middleTruncate(name: string, keep: number): string {
  if (name.length <= keep) return name;
  const ext = /\.[a-z0-9]{1,8}$/i.exec(name)?.[0] ?? '';
  const room = keep - ext.length - 1;
  if (!ext || room < 2) return `${name.slice(0, Math.max(keep - 1, 0))}…`;
  const stem = name.slice(0, -ext.length);
  const head = Math.ceil(room * 0.6);
  return `${stem.slice(0, head)}…${stem.slice(stem.length - (room - head))}${ext}`;
}

const SEPARATORS = '_-.…';

/**
 * Where a file name may wrap: after `_`, `-`, `.` or `…` in its stem (each
 * piece ends at one), and never inside `tail`, which holds the extension glued
 * to the stem's last segment ("ZS2026.pdf") when the two are short, else to its
 * last character, so ".pdf" neither splits nor sits alone on a line. A name
 * with no extension is one piece, left to the browser.
 */
export function nameBreaks(name: string): { pieces: string[]; tail: string } {
  const ext = /\.[a-z0-9]{1,8}$/i.exec(name)?.[0];
  if (!ext || name.length <= ext.length) return { pieces: [name], tail: '' };
  const stem = name.slice(0, -ext.length);
  // Start of the last segment: after the last separator, or the whole stem.
  let start = 0;
  for (let i = stem.length - 1; i > 0; i--) {
    if (SEPARATORS.includes(stem.charAt(i - 1))) {
      start = i;
      break;
    }
  }
  const cut = stem.length - start + ext.length <= GLUED_MAX ? start : stem.length - 1;
  const pieces: string[] = [];
  let piece = '';
  for (const ch of stem.slice(0, cut)) {
    piece += ch;
    if (SEPARATORS.includes(ch)) {
      pieces.push(piece);
      piece = '';
    }
  }
  if (piece) pieces.push(piece);
  return { pieces, tail: stem.slice(cut) + ext };
}

/** The longest unbreakable tail: the narrowest row (320 px, a file under its document) fits 14 characters a line. */
const GLUED_MAX = 14;

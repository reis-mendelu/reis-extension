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

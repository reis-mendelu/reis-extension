import { sanitizeString } from '../../utils/validation/stringSanitizer';

/**
 * A file's own name, which IS prints on the mime icon inside its link.
 *
 * Verified live on 2026-11-07 against folder pages of four subjects, cz and en:
 * every link in the Přílohy cell wraps `<span data-sysid="mime-pdf"
 * title="ig-04-Ethernet.pdf" aria-label="ig-04-Ethernet.pdf">`. The row's
 * Název is the DOCUMENT's title; a document with five files used to show five
 * rows of that one title. Only the mime icon is read, never the read-status or
 * view-info icons the same row carries (see iconSysid.ts).
 *
 * Sanitised for display, not for a path: a saved file still goes through
 * downloadName's own character replacement.
 */
export function attachmentFilename(link: Element): string {
  const icon = link.querySelector('[data-sysid^="mime-"]');
  // Whole, not cut to a display length: the type is read from its extension,
  // and a cut name can end in a false one. The row truncates it in CSS.
  return sanitizeString(
    icon?.getAttribute('title') || icon?.getAttribute('aria-label') || '',
    1000
  );
}

/**
 * IS's `mime-unknown` for files it has no icon for (.ipynb, .md, .pkt in the
 * captured pages): the name's extension is the better type.
 */
export function typeFromFilename(type: string, filename: string): string {
  if (type !== 'unknown') return type;
  return /\.([a-z0-9]{1,8})$/i.exec(filename)?.[1]?.toLowerCase() ?? type;
}

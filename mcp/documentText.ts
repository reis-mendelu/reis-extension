import { parseOffice } from 'officeparser';
import { clean, type DocumentMeta, type FileText } from './files';

// The .mcpb build: extract the text here, because Claude Desktop chat has no
// file tools of its own. The plugin build swaps this module for
// documentHandover.ts (vite.mcp.plugin.config.ts), which drops officeparser.
//
// One extractor for PDF and Office files: officeparser 8 ships the patched
// pdfjs-dist 6.2.108. unpdf bundled its own pdfjs 6.1.200 (inside the
// GHSA-hq66-cqwq-w95j range), and two pdfjs copies in one process collide.

export const DOCUMENT_DESCRIPTION =
  'Downloads one file from the IS document server and returns its text (PDF, DOCX, PPTX, XLSX, ODT, plain text). Only accepts a downloadUrl from mendelu_subject_files. Read-only.';

/** Text extraction has no message-size ceiling of its own: the same cap as text files. */
export const MAX_DOCUMENT_BYTES = 30 * 1024 * 1024;

const EMPTY = 'No extractable text — the document may be scanned or image-only.';

export async function documentResult(bytes: Uint8Array, meta: DocumentMeta): Promise<FileText> {
  const ast = await parseOffice(Buffer.from(bytes));
  const t = clean((await ast.to('text')).value);
  const pages = ast.metadata?.pages;
  return {
    ...(meta.filename ? { filename: meta.filename } : {}),
    kind: ast.type || meta.ext.slice(1) || 'document',
    ...(pages ? { pages } : {}),
    text: t,
    ...(t.trim() ? {} : { note: EMPTY }),
  };
}

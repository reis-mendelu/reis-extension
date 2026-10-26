import type { DocumentMeta } from './files';

// The plugin build (Claude Code): hand the file itself to Claude as an embedded
// resource. Claude Code saves it and reads PDFs directly and Office files by
// their XML, so the server needs no PDF or Office parser (officeparser was
// two thirds of the bundle). Checked 2026-10-26 with PDFs up to 9.4 MB.

export const DOCUMENT_DESCRIPTION =
  'Downloads one file from the IS document server and returns the file itself (PDF, DOCX, PPTX, XLSX, ODT, up to 10 MB) for you to read, or the text of a plain-text file. Only accepts a downloadUrl from mendelu_subject_files. Read-only.';

/**
 * Claude Code drops a server whose message passes 16 MiB, and base64 adds a
 * third: 11.5 MiB arrived, 12 MiB closed the connection and took every reIS
 * tool with it (measured 2026-10-26). 10 MB keeps a margin.
 */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.odt': 'application/vnd.oasis.opendocument.text',
};

export type FileHandover = {
  handover: { filename: string; mimeType: string; base64: string; bytes: number };
};

export async function documentResult(bytes: Uint8Array, meta: DocumentMeta): Promise<FileHandover> {
  const generic = !meta.mediaType || meta.mediaType === 'application/octet-stream';
  return {
    handover: {
      filename: meta.filename ?? `file${meta.ext}`,
      mimeType: (generic ? MIME_BY_EXT[meta.ext] : meta.mediaType) ?? 'application/octet-stream',
      base64: Buffer.from(bytes).toString('base64'),
      bytes: bytes.byteLength,
    },
  };
}

import { fetchFolderListing } from '../src/api/documents/service';
import { documentTitle } from '../src/utils/documentLabels';
// The plugin build aliases this import to ./documentHandover (vite.mcp.plugin.config.ts).
import { documentResult, MAX_DOCUMENT_BYTES } from './documentText';
import { readCapped } from './download';
import { carry } from './originalCarry';

export type SubjectFile = {
  /** The document's title as IS prints it. */
  name: string;
  /** The file's own name and extension; a document can hold several files. */
  file?: string;
  /** The subfolder the teacher filed it under, when there is one. */
  folder?: string;
  author: string;
  date: string;
  /** IS's Modifikace: later than `date` when the teacher replaced the files. */
  modified?: string;
  downloadUrl: string;
};
export type FileText = {
  filename?: string;
  kind: string;
  pages?: number;
  note?: string;
  text: string;
};
export type DocumentMeta = { filename?: string; mediaType: string; ext: string };

const DOC_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.odt'];
/** Pre-2007 binary Office files: officeparser reads none of them. */
const OLD_OFFICE = ['.doc', '.ppt', '.xls'];
// IS often serves source files as application/octet-stream, so the extension decides:
// a MATLAB .m, a notebook, a diagram and a page are all text a student asks about.
const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.m', '.ipynb', '.drawio', '.html', '.htm'];

export const clean = (t: string) => t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
export const extOf = (name?: string) => /\.[^./\\]+$/.exec(name ?? '')?.[0].toLowerCase() ?? '';

/**
 * One entry per file that has a download link, deduplicated by that link.
 * Every file of a document is listed, not only the first: a lecture row in IS
 * can hold five PDFs, and Claude could only ever read one of them.
 *
 * All or nothing: when a page or subfolder failed to load, a file missing from
 * the list would read as "not uploaded yet" (and the tool cache keeps a list).
 */
export async function listFolderFiles(folderUrl: string): Promise<SubjectFile[]> {
  const { files: entries, complete } = await fetchFolderListing(folderUrl);
  if (!complete) {
    throw new Error(
      'IS sent only part of this folder: a page or subfolder did not load. Try again in a minute.'
    );
  }
  const seen = new Set<string>();
  const out: SubjectFile[] = [];
  for (const e of entries) {
    for (const f of e.files ?? []) {
      if (!/download=/.test(f.link) || seen.has(f.link)) continue;
      seen.add(f.link);
      out.push({
        name: documentTitle(e),
        ...(f.filename ? { file: f.filename } : {}),
        ...(e.subfolder ? { folder: e.subfolder } : {}),
        author: e.author,
        date: e.date,
        ...(e.modified ? { modified: e.modified } : {}),
        downloadUrl: f.link,
      });
    }
  }
  return out;
}

/**
 * RFC 6266: `filename*=UTF-8''…` is percent-encoded, plain `filename="…"` is
 * not, and may hold a literal % (`100% řešení.pdf`), so only the first is decoded.
 */
export function filenameOf(disposition: string): string | undefined {
  const encoded = /filename\*=(?:UTF-8|utf-8)''([^;]+)/.exec(disposition)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim());
    } catch {
      return encoded.trim();
    }
  }
  return /filename="?([^";]+)"?/i.exec(disposition)?.[1]?.trim();
}

/** Only IS document-server files: the model can never steer a download elsewhere. */
export function assertDokServerUrl(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error('Not a URL. Pass a downloadUrl from mendelu_subject_files.');
  }
  if (
    u.protocol !== 'https:' ||
    u.host !== 'is.mendelu.cz' ||
    !u.pathname.startsWith('/auth/dok_server/')
  ) {
    throw new Error(
      'Only IS dok_server files can be read. Pass a downloadUrl from mendelu_subject_files.'
    );
  }
}

/** How a file is read: a document goes to the extractor, text is decoded, anything else is not read. */
export type ReadKind = 'document' | 'text' | null;

export function readKindOf(contentType: string, ext: string): ReadKind {
  const type = contentType.toLowerCase();
  const mediaType = type.split(';', 1)[0]?.trim() ?? '';
  if (
    /pdf|wordprocessingml|presentationml|spreadsheetml|opendocument/.test(type) ||
    DOC_EXTENSIONS.includes(ext)
  )
    return 'document';
  if (
    type.startsWith('text/') ||
    mediaType === 'application/json' ||
    type.includes('xml') ||
    TEXT_EXTENSIONS.includes(ext)
  )
    return 'text';
  return null;
}

/** What mendelu_read_file answers for bytes already downloaded. */
export async function textOfBytes(
  bytes: Uint8Array,
  kind: 'document' | 'text',
  meta: DocumentMeta
) {
  if (kind === 'document') return documentResult(bytes, meta);
  const named = meta.filename ? { filename: meta.filename } : {};
  return { ...named, kind: 'text', text: clean(new TextDecoder().decode(bytes)) } as FileText;
}

/** The headers a dok_server answer carries, read once. */
export function headersOf(res: Response) {
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  const mediaType = type.split(';', 1)[0]?.trim() ?? '';
  const filename = filenameOf(res.headers.get('content-disposition') ?? '');
  return { type, mediaType, filename, ext: extOf(filename) };
}

/**
 * Downloads one dok_server file and extracts its text. An expired session is
 * handled by the session fetch (it re-logs in on the login page), so no
 * login-page guard is needed here. The downloaded bytes ride along with the
 * answer (originalCarry.ts), so the store can keep the original once.
 */
export async function readDokServerFile(
  url: string,
  fetchImpl: typeof fetch
): Promise<FileText | Awaited<ReturnType<typeof documentResult>>> {
  assertDokServerUrl(url);
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`IS answered HTTP ${res.status} for this file.`);
  const { type, mediaType, filename, ext } = headersOf(res);
  const named = filename ? { filename } : {};
  const kind = readKindOf(type, ext);

  // Decide from the headers first: an unsupported file is never downloaded.
  if (!kind) {
    await res.body?.cancel().catch(() => {});
    return {
      ...named,
      kind: type || 'unknown',
      text: '',
      note: OLD_OFFICE.includes(ext)
        ? `This format (${ext}) can't be read as text. Open it in IS directly, or ask the teacher for the ${ext}x version.`
        : 'No text extractor for this file type. Open it in IS directly.',
    };
  }
  const bytes = await readCapped(res, kind === 'document' ? MAX_DOCUMENT_BYTES : MAX_FILE_BYTES);
  const answer = await textOfBytes(bytes, kind, { ...named, mediaType, ext });
  return carry(answer, { bytes, ...named, mediaType });
}

/** Lecture slides run to tens of MB; past this a file is not worth parsing for text. */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

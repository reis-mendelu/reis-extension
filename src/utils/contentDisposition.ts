/**
 * The name to save an IS file under.
 *
 * IS serves every document from a query-string URL (`slozka.pl?download=…`),
 * so the URL never carries a name: the Content-Disposition header is the only
 * real source, and the row's title is the fallback. What IS sends today
 * (checked 2026-10-03) is a plain quoted ASCII `filename="algo05.pptx"` — it
 * transliterates Czech titles itself. `filename*` (RFC 5987) is handled
 * because it is what a server sends for a non-ASCII name, not because IS does.
 *
 * Imports nothing: it is shared by the extension, the native path and the zip.
 */

/** RFC 6266 parameters after the disposition type, names lower-cased. */
function parseParams(header: string): Map<string, string> {
  const params = new Map<string, string>();
  let i = header.indexOf(';');
  if (i === -1) return params;
  while (i < header.length) {
    while (i < header.length && (header[i] === ';' || header[i] === ' ' || header[i] === '\t')) i++;
    const eq = header.indexOf('=', i);
    const semi = header.indexOf(';', i);
    if (eq === -1 || (semi !== -1 && semi < eq)) {
      if (semi === -1) break;
      i = semi;
      continue;
    }
    const name = header.slice(i, eq).trim().toLowerCase();
    i = eq + 1;
    while (header[i] === ' ' || header[i] === '\t') i++;
    let value = '';
    if (header[i] === '"') {
      i++;
      while (i < header.length && header[i] !== '"') {
        if (header[i] === '\\' && i + 1 < header.length) i++;
        value += header[i];
        i++;
      }
      i++;
    } else {
      const end = header.indexOf(';', i);
      value = header.slice(i, end === -1 ? undefined : end).trim();
      i = end === -1 ? header.length : end;
    }
    if (name && !params.has(name)) params.set(name, value);
  }
  return params;
}

/** `charset'lang'percent-encoded` — null when it cannot be decoded. */
function decodeExtValue(value: string): string | null {
  const match = /^([^']*)'[^']*'(.*)$/.exec(value);
  if (!match) return null;
  const charset = (match[1] ?? '').toLowerCase();
  const encoded = match[2] ?? '';
  try {
    if (charset === 'utf-8') return decodeURIComponent(encoded);
    if (charset === 'iso-8859-1') {
      if (/%(?![0-9a-f]{2})/i.test(encoded)) return null;
      return encoded.replace(/%([0-9a-f]{2})/gi, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
      );
    }
  } catch {
    // A malformed percent sequence: let the plain `filename=` answer instead.
  }
  return null;
}

/** The last path segment, so a name can never climb out of the save folder. */
function baseName(name: string): string | null {
  const base = name.split(/[\\/]/).pop()?.trim() ?? '';
  return base === '' || base === '.' || base === '..' ? null : base;
}

/** The filename a Content-Disposition header names, or null. */
export function filenameFromContentDisposition(header: string | null | undefined): string | null {
  if (!header) return null;
  const params = parseParams(header);
  const extended = params.get('filename*');
  const decoded = extended === undefined ? null : decodeExtValue(extended);
  const name = decoded ?? params.get('filename') ?? '';
  return baseName(name);
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/x-7z-compressed': '7z',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
};

/** IS's own row type (`pptx`, `ipynb`…) as an extension — but never its "I don't know". */
export function rowTypeExtension(rowType: string | undefined): string | null {
  const type = rowType?.trim().toLowerCase() ?? '';
  return /^[a-z0-9]{1,8}$/.test(type) && type !== 'unknown' ? type : null;
}

function extensionFor(contentType: string | null, rowType: string | undefined): string | null {
  const mime = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  return EXTENSION_BY_TYPE[mime] ?? rowTypeExtension(rowType);
}

export interface DownloadedFile {
  contentDisposition: string | null;
  contentType: string | null;
}

/** The drawer row the file came from, when the caller has one. */
export interface FileRowHint {
  name: string;
  type?: string;
}

/**
 * IS's own name when the header has one — the same name the download button
 * has always saved — otherwise the row's title, otherwise `fallback`, with an
 * extension from the content type or the row's type.
 */
export function downloadName(
  file: DownloadedFile,
  row?: FileRowHint,
  fallback = 'dokument'
): string {
  const named = filenameFromContentDisposition(file.contentDisposition);
  if (named) return named;
  const title = row?.name.replace(/[\\/:*?"<>|]/g, '_').trim() || fallback;
  const ext = extensionFor(file.contentType, row?.type);
  if (!ext || title.toLowerCase().endsWith(`.${ext}`)) return title;
  return `${title}.${ext}`;
}

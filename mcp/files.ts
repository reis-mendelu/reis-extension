import { parseOffice } from 'officeparser';
import { fetchFilesFromFolder } from '../src/api/documents/service';

export type SubjectFile = { name: string; author: string; date: string; downloadUrl: string };
export type FileText = {
  filename?: string;
  kind: string;
  pages?: number;
  note?: string;
  text: string;
};

const EMPTY = 'No extractable text — the document may be scanned or image-only.';
// One extractor for PDF and Office files: officeparser 8 ships the patched
// pdfjs-dist 6.2.108. unpdf bundled its own pdfjs 6.1.200 (inside the
// GHSA-hq66-cqwq-w95j range), and two pdfjs copies in one process collide.
const DOC_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.odt'];
const TEXT_EXTENSIONS = ['.txt', '.md', '.csv'];

const clean = (t: string) => t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
const extOf = (name?: string) => /\.[^./\\]+$/.exec(name ?? '')?.[0].toLowerCase() ?? '';
const withNote = (text: string) => (text.trim() ? {} : { note: EMPTY });

/** One entry per file that has a download link, deduplicated by that link. */
export async function listFolderFiles(folderUrl: string): Promise<SubjectFile[]> {
  const entries = await fetchFilesFromFolder(folderUrl);
  const seen = new Set<string>();
  const out: SubjectFile[] = [];
  for (const e of entries ?? []) {
    const link = e.files?.find((f) => /download=/.test(f.link))?.link;
    if (!link || seen.has(link)) continue;
    seen.add(link);
    out.push({ name: e.file_name, author: e.author, date: e.date, downloadUrl: link });
  }
  return out;
}

/** Only IS document-server files: the model can never steer a download elsewhere. */
export function assertDokServerUrl(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error('Not a URL. Pass a downloadUrl from mendelu_subject_files.');
  }
  if (u.host !== 'is.mendelu.cz' || !u.pathname.startsWith('/auth/dok_server/')) {
    throw new Error(
      'Only IS dok_server files can be read. Pass a downloadUrl from mendelu_subject_files.'
    );
  }
}

/**
 * Downloads one dok_server file and extracts its text. An expired session is
 * handled by the session fetch (it re-logs in on the login page), so no
 * login-page guard is needed here.
 */
export async function readDokServerFile(url: string, fetchImpl: typeof fetch): Promise<FileText> {
  assertDokServerUrl(url);
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`IS answered HTTP ${res.status} for this file.`);
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  const disposition = res.headers.get('content-disposition') ?? '';
  const rawName = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
  const filename = rawName ? decodeURIComponent(rawName) : undefined;
  const named = filename ? { filename } : {};
  const bytes = new Uint8Array(await res.arrayBuffer());
  const ext = extOf(filename);

  if (
    /pdf|wordprocessingml|presentationml|spreadsheetml|opendocument/.test(type) ||
    DOC_EXTENSIONS.includes(ext)
  ) {
    const ast = await parseOffice(Buffer.from(bytes));
    const t = clean((await ast.to('text')).value);
    const pages = ast.metadata?.pages;
    return {
      ...named,
      kind: ast.type || ext.slice(1) || 'document',
      ...(pages ? { pages } : {}),
      text: t,
      ...withNote(t),
    };
  }
  if (
    type.startsWith('text/') ||
    type === 'application/json' ||
    type.includes('xml') ||
    TEXT_EXTENSIONS.includes(ext)
  ) {
    return { ...named, kind: 'text', text: clean(new TextDecoder().decode(bytes)) };
  }
  return {
    ...named,
    kind: type || 'unknown',
    text: '',
    note: 'No text extractor for this file type. Open it in IS directly.',
  };
}

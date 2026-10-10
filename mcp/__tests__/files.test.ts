import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/api/documents/service', () => ({ fetchFilesFromFolder: vi.fn() }));
import { fetchFilesFromFolder } from '../../src/api/documents/service';
import {
  listFolderFiles,
  assertDokServerUrl,
  readDokServerFile,
  filenameOf,
  MAX_FILE_BYTES,
} from '../files';

const DL = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=1;download=2';

// A plain object, not a Response: happy-dom's Response cannot carry every
// header Node's fetch exposes, and only these members are read.
function fileResponse(body: Uint8Array | string, headers: Record<string, string>, ok = true) {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  return {
    ok,
    status: ok ? 200 : 404,
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}
const asFetch = (f: unknown) => f as typeof fetch;

describe('listFolderFiles', () => {
  it('keeps one download link per file and drops entries without one', async () => {
    const entry = (file_name: string, link?: string) => ({
      subfolder: '',
      file_name,
      file_comment: '',
      author: 'A',
      date: '1. 10. 2026',
      files: link ? [{ name: 'x', type: 'pdf', link }] : [],
    });
    vi.mocked(fetchFilesFromFolder).mockResolvedValue([
      entry('L1.pdf', DL),
      entry('dup', DL),
      entry('no-link'),
    ]);
    expect(await listFolderFiles('https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1')).toEqual([
      { name: 'L1.pdf', author: 'A', date: '1. 10. 2026', downloadUrl: DL },
    ]);
  });
});

describe('assertDokServerUrl', () => {
  it('accepts dok_server links and refuses anything else', () => {
    expect(() => assertDokServerUrl(DL)).not.toThrow();
    expect(() => assertDokServerUrl('https://is.mendelu.cz/auth/elis/ot/psani_testu.pl')).toThrow(
      /dok_server/
    );
    expect(() => assertDokServerUrl('https://evil.example/auth/dok_server/x')).toThrow(
      /dok_server/
    );
    expect(() => assertDokServerUrl('not a url')).toThrow(/downloadUrl/);
    expect(() => assertDokServerUrl(DL.replace('https:', 'http:'))).toThrow(/dok_server/);
  });
});

describe('filenameOf', () => {
  it('decodes only the RFC 5987 form and keeps a literal % in a plain name', () => {
    expect(filenameOf("attachment; filename*=UTF-8''p%C5%99edn%C3%A1%C5%A1ka.pdf")).toBe(
      'přednáška.pdf'
    );
    expect(filenameOf('attachment; filename="100% řešení.pdf"')).toBe('100% řešení.pdf');
    expect(filenameOf("attachment; filename*=UTF-8''bad%E0%A4%A")).toBe('bad%E0%A4%A');
    expect(filenameOf('inline')).toBeUndefined();
  });
});

describe('readDokServerFile', () => {
  it('reads JSON even when the content type carries a charset', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(
        fileResponse('{"a":1}', { 'content-type': 'application/json; charset=utf-8' })
      );
    expect((await readDokServerFile(DL, asFetch(f))).text).toBe('{"a":1}');
  });

  it('decodes plain text files and takes the filename from content-disposition', async () => {
    const f = vi.fn().mockResolvedValue(
      fileResponse('hello\n\n\n\nworld', {
        'content-type': 'text/plain',
        'content-disposition': 'attachment; filename="notes.txt"',
      })
    );
    expect(await readDokServerFile(DL, asFetch(f))).toEqual({
      filename: 'notes.txt',
      kind: 'text',
      text: 'hello\n\nworld',
    });
  });

  it('returns a note for unsupported types instead of bytes', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(
        fileResponse(new Uint8Array([1, 2]), { 'content-type': 'application/zip' })
      );
    const r = await readDokServerFile(DL, asFetch(f));
    expect(r.text).toBe('');
    expect(r.note).toMatch(/No text extractor/);
  });

  it('refuses a non-dok_server URL before fetching anything', async () => {
    const f = vi.fn();
    await expect(
      readDokServerFile('https://is.mendelu.cz/auth/student/list.pl', asFetch(f))
    ).rejects.toThrow(/dok_server/);
    expect(f).not.toHaveBeenCalled();
  });

  it('refuses a file over the size cap before reading it', async () => {
    const r = fileResponse('x', {
      'content-type': 'application/pdf',
      'content-length': String(MAX_FILE_BYTES + 1),
    });
    const f = vi.fn().mockResolvedValue(r);
    await expect(readDokServerFile(DL, asFetch(f))).rejects.toThrow(/too big/);
  });

  it('never downloads a file type it cannot read', async () => {
    const arrayBuffer = vi.fn();
    const f = vi.fn().mockResolvedValue({
      ...fileResponse('', { 'content-type': 'application/zip' }),
      arrayBuffer,
    });
    await readDokServerFile(DL, asFetch(f));
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('reports an HTTP failure', async () => {
    const f = vi.fn().mockResolvedValue(fileResponse('', {}, false));
    await expect(readDokServerFile(DL, asFetch(f))).rejects.toThrow(/HTTP 404/);
  });
});

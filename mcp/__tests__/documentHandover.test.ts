import { describe, it, expect, vi } from 'vitest';
import { documentResult, DOCUMENT_DESCRIPTION } from '../documentHandover';
import { toolResult, CHARACTER_LIMIT } from '../format';

const PDF = new TextEncoder().encode('%PDF-1.4 lecture 7');

describe('documentHandover (plugin build)', () => {
  it('hands the file itself to Claude instead of extracting its text', async () => {
    const r = await documentResult(PDF, {
      filename: 'L7.pdf',
      mediaType: 'application/pdf',
      ext: '.pdf',
    });
    expect(r).toEqual({
      handover: {
        filename: 'L7.pdf',
        mimeType: 'application/pdf',
        base64: Buffer.from(PDF).toString('base64'),
        bytes: PDF.byteLength,
      },
    });
  });

  it('names the Office type from the extension when IS sends a generic one', async () => {
    const r = await documentResult(PDF, {
      filename: 'cviceni.docx',
      mediaType: 'application/octet-stream',
      ext: '.docx',
    });
    expect(r.handover.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });

  it('says in the tool description that it returns the file, not its text', () => {
    expect(DOCUMENT_DESCRIPTION).toMatch(/returns the file itself/i);
    expect(DOCUMENT_DESCRIPTION).not.toMatch(/returns its text/i);
  });
});

describe('toolResult with a handed-over file', () => {
  it('returns the file as an embedded resource, never cut at the text limit', async () => {
    const big = new Uint8Array(CHARACTER_LIMIT * 4).fill(65);
    const data = await documentResult(big, {
      filename: 'L7.pdf',
      mediaType: 'application/pdf',
      ext: '.pdf',
    });
    const r = toolResult(data, 'markdown');
    expect(r.content).toHaveLength(2);
    expect(r.content[0]).toMatchObject({ type: 'text' });
    expect(r.content[0]!.text).toContain('L7.pdf');
    expect(r.content[0]!.text).toContain('Read the saved copy');
    expect(r.content[1]).toEqual({
      type: 'resource',
      resource: {
        uri: 'mendelu-file:///L7.pdf',
        mimeType: 'application/pdf',
        blob: Buffer.from(big).toString('base64'),
      },
    });
    expect('structuredContent' in r).toBe(false);
  });

  it('does the same in json mode', async () => {
    const data = await documentResult(PDF, {
      filename: 'L7.pdf',
      mediaType: 'application/pdf',
      ext: '.pdf',
    });
    const r = toolResult(data, 'json');
    expect(r.content[1]).toMatchObject({ type: 'resource' });
    expect('structuredContent' in r).toBe(false);
  });
});

describe('readDokServerFile in the plugin build', () => {
  it('refuses a document over 10 MB before reading it: Claude Code drops the server on a bigger message', async () => {
    vi.resetModules();
    vi.doMock('../documentText', () => import('../documentHandover'));
    const { readDokServerFile } = await import('../files');
    const arrayBuffer = vi.fn();
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (n: string) =>
          ({ 'content-type': 'application/pdf', 'content-length': String(11 * 1024 * 1024) })[
            n.toLowerCase()
          ] ?? null,
      },
      arrayBuffer,
    });
    await expect(
      readDokServerFile(
        'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=1;download=2',
        f as unknown as typeof fetch
      )
    ).rejects.toThrow(/over 10 MB/);
    expect(arrayBuffer).not.toHaveBeenCalled();
    vi.doUnmock('../documentText');
  });
});

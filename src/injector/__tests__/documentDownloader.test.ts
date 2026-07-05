import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadDocumentInPage } from '../documentDownloader';

const pdfBlob = () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' });

describe('downloadDocumentInPage', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    document.body.innerHTML = '';
    // happy-dom lacks these; stub them.
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { clickSpy.mockRestore(); vi.restoreAllMocks(); });

  it('fetches the PDF and saves it via an <a download> with the given filename', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(pdfBlob(), { status: 200, headers: { 'content-type': 'application/pdf' } }),
    );
    let downloadName = '';
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) { downloadName = this.download; });

    await downloadDocumentInPage('https://is.mendelu.cz/x', 'Potvrzeni_o_studiu.pdf');

    expect(fetchSpy).toHaveBeenCalledWith('https://is.mendelu.cz/x', { credentials: 'include' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(downloadName).toBe('Potvrzeni_o_studiu.pdf');
  });

  it('rejects when the response is not a PDF (session expired → login HTML)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    await expect(downloadDocumentInPage('https://is.mendelu.cz/x', 'f.pdf')).rejects.toThrow();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('rejects on a 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    await expect(downloadDocumentInPage('https://is.mendelu.cz/x', 'f.pdf')).rejects.toThrow();
  });
});

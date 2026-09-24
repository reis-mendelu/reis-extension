import { describe, it, expect, afterEach, vi } from 'vitest';

// The iframe app is chrome-extension:// — cross-site to is.mendelu.cz. Where
// the browser blocks third-party cookies (Brave by default, Chrome by setting,
// Firefox's Total Cookie Protection) a direct fetch from here reaches IS
// without UISAuth and gets 403: the inline PDF preview showed nothing, and a
// zip came out empty. File bytes take the content script's first-party route.
const fetchViaProxy = vi.fn();
let inIframe = true;
vi.mock('../../../api/proxyClient', () => ({
  fetchViaProxy: (...args: unknown[]) => fetchViaProxy(...args),
  isInIframe: () => inIframe,
}));

import { fetchIsFile } from '../fetchIsFile';

const URL_ = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=1';

describe('fetchIsFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fetchViaProxy.mockReset();
    inIframe = true;
  });

  it('inside the extension iframe: goes through the content script and never fetches directly', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchViaProxy.mockResolvedValue(
      JSON.stringify({
        contentType: 'application/pdf',
        contentDisposition: 'attachment; filename="a.pdf"',
        base64: 'JVBERi0=', // %PDF-
      })
    );
    const onTick = vi.fn();

    const file = await fetchIsFile(URL_, onTick);

    expect(fetchViaProxy).toHaveBeenCalledWith(URL_, { responseType: 'file' }, onTick);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(file.contentDisposition).toBe('attachment; filename="a.pdf"');
    expect(file.blob.type).toBe('application/pdf');
    expect(await file.blob.text()).toBe('%PDF-');
  });

  it('inside the iframe: a proxy failure rejects, so the caller can fall back', async () => {
    fetchViaProxy.mockRejectedValue(new Error('Error: HTTP 403'));
    await expect(fetchIsFile(URL_)).rejects.toThrow('HTTP 403');
  });

  // The dev webapp and the content script itself are top-level on their own
  // origin: nothing to proxy through, and the direct fetch is first-party.
  it('outside an iframe: fetches directly, with byte progress', async () => {
    inIframe = false;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('%PDF-1.4', {
        headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline' },
      })
    );
    const onTick = vi.fn();

    const file = await fetchIsFile(URL_, onTick);

    expect(fetch).toHaveBeenCalledWith(URL_, { credentials: 'include' });
    expect(fetchViaProxy).not.toHaveBeenCalled();
    expect(file.contentDisposition).toBe('inline');
    expect(await file.blob.text()).toBe('%PDF-1.4');
    expect(onTick).toHaveBeenCalled();
  });

  it('outside an iframe: a non-ok status rejects with its code', async () => {
    inIframe = false;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x', { status: 503 }));
    await expect(fetchIsFile(URL_)).rejects.toThrow('HTTP 503');
  });

  // IS answers some file anchors with a viewer page, and an expired session
  // with the login page — both 200 HTML. Neither is the file: saving it under
  // the file's name, or zipping it, hands the student a web page.
  it('inside the iframe: an HTML page rejects instead of passing for the file', async () => {
    fetchViaProxy.mockResolvedValue(
      JSON.stringify({
        contentType: 'text/html; charset=utf-8',
        contentDisposition: null,
        base64: 'PGh0bWw+', // <html>
      })
    );
    await expect(fetchIsFile(URL_)).rejects.toThrow('HTML');
  });

  it('outside an iframe: an HTML page rejects too', async () => {
    inIframe = false;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>', { headers: { 'content-type': 'Text/HTML' } })
    );
    await expect(fetchIsFile(URL_)).rejects.toThrow('HTML');
  });
});

import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchFileForIframe } from '../fetchFileForIframe';
import type { FileFetchPayload } from '../../types/messages/base';

const URL_ = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=1;z=1';

function respond(body: BodyInit, init: ResponseInit) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, init));
}

describe('fetchFileForIframe — the content-script half of an iframe file fetch', () => {
  afterEach(() => vi.restoreAllMocks());

  // A lecture PDF, a zip entry: a byte that changes on the way through
  // postMessage is a file that opens corrupted, with nothing saying why.
  it('round-trips every byte value, and carries both headers the iframe reads', async () => {
    const all = new Uint8Array(256).map((_, i) => i);
    respond(all, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="prednaska.pdf"',
      },
    });

    const payload = JSON.parse(await fetchFileForIframe(URL_, () => {})) as FileFetchPayload;

    expect(payload.contentType).toBe('application/pdf');
    expect(payload.contentDisposition).toBe('attachment; filename="prednaska.pdf"');
    const bin = atob(payload.base64);
    expect(Array.from(bin, (c) => c.charCodeAt(0))).toEqual(Array.from(all));
  });

  it('fetches first-party with the session cookie', async () => {
    respond('x', { headers: { 'content-type': 'application/pdf' } });
    await fetchFileForIframe(URL_, () => {});
    expect(fetch).toHaveBeenCalledWith(URL_, { credentials: 'include' });
  });

  // IS serves viewer pages under the same anchors as files. fetchPdfBlob and
  // openFile decide what to do with a non-PDF — refusing it here would take
  // that decision away from them.
  it('returns an HTML body instead of throwing on it', async () => {
    respond('<html>viewer</html>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
    const payload = JSON.parse(await fetchFileForIframe(URL_, () => {})) as FileFetchPayload;
    expect(payload.contentType).toMatch(/text\/html/);
    expect(atob(payload.base64)).toBe('<html>viewer</html>');
  });

  it('reports byte progress as the body arrives', async () => {
    respond(new Uint8Array(10), {
      headers: { 'content-type': 'application/pdf', 'content-length': '10' },
    });
    const ticks: { loaded: number; total: number | null }[] = [];
    await fetchFileForIframe(URL_, (t) => ticks.push(t));
    expect(ticks[0]).toEqual({ loaded: 0, total: 10 });
    expect(ticks.at(-1)).toEqual({ loaded: 10, total: 10 });
  });

  // One forbidden file in a zip of ten must not navigate the IS page to the
  // login screen and take the iframe down with it. The caller's window.open
  // fallback shows IS's own answer top-level instead.
  it('fails a 403 WITHOUT redirecting the host page to login', async () => {
    respond('nope', { status: 403 });
    const before = window.location.href;
    await expect(fetchFileForIframe(URL_, () => {})).rejects.toThrow('HTTP 403');
    expect(window.location.href).toBe(before);
  });

  it('refuses a URL that is not IS Mendelu', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await expect(fetchFileForIframe('https://evil.example/x', () => {})).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});

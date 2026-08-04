import { describe, it, expect, vi } from 'vitest';
import {
  base64ToBlob,
  filenameFromResponse,
  fetchIsBinary,
  toBytes,
  type BinaryDeps,
} from '../capacitorBinary';

const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAA%2FBBBBBBBBBBBBBBBBBBB';
// "%PDF-1.5" — a real PDF magic header, base64-encoded.
const PDF_B64 = 'JVBERi0xLjU=';

describe('base64ToBlob', () => {
  it('decodes to the original bytes, preserving the PDF magic number', async () => {
    const blob = base64ToBlob(PDF_B64, 'application/pdf');
    expect(blob.type).toBe('application/pdf');
    expect(await blob.text()).toBe('%PDF-1.5');
  });

  it('tolerates a data: URI prefix, which some platforms include', async () => {
    const blob = base64ToBlob(`data:application/pdf;base64,${PDF_B64}`, 'application/pdf');
    expect(await blob.text()).toBe('%PDF-1.5');
  });

  it('produces a non-empty blob — a zero-length save is the silent failure we guard against', () => {
    expect(base64ToBlob(PDF_B64, 'application/pdf').size).toBeGreaterThan(0);
  });
});

describe('filenameFromResponse', () => {
  it('prefers the Content-Disposition filename', () => {
    expect(
      filenameFromResponse({
        'Content-Disposition': 'attachment; filename="Prednaska_01.pdf"',
      })
    ).toBe('Prednaska_01.pdf');
  });

  it('handles an unquoted filename', () => {
    expect(filenameFromResponse({ 'content-disposition': 'attachment; filename=x.pdf' })).toBe(
      'x.pdf'
    );
  });

  it('falls back to a sane name when the header is absent — IS query URLs have no basename', () => {
    expect(filenameFromResponse({})).toBe('dokument.pdf');
  });
});

describe('fetchIsBinary', () => {
  function deps(over: Partial<BinaryDeps> = {}): BinaryDeps {
    return {
      platform: 'android',
      setCookie: vi.fn(async () => {}),
      httpGet: vi.fn(async () => ({
        status: 200,
        data: PDF_B64,
        headers: { 'Content-Type': 'application/pdf' },
      })),
      ...over,
    };
  }

  it('requests the body as a blob, not as text — a PDF does not survive as a string', async () => {
    const d = deps();
    await fetchIsBinary('https://is.mendelu.cz/f.pdf', TOKEN, d);
    expect(d.httpGet).toHaveBeenCalledWith(expect.objectContaining({ responseType: 'blob' }));
  });

  it('seeds the native jar on android and sends no Cookie header', async () => {
    const d = deps();
    await fetchIsBinary('https://is.mendelu.cz/f.pdf', TOKEN, d);
    expect(d.setCookie).toHaveBeenCalled();
    expect(d.httpGet).toHaveBeenCalledWith(expect.objectContaining({ headers: {} }));
  });

  it('sends a Cookie header on ios and does not seed the jar', async () => {
    const d = deps({ platform: 'ios' });
    await fetchIsBinary('https://is.mendelu.cz/f.pdf', TOKEN, d);
    expect(d.setCookie).not.toHaveBeenCalled();
    expect(d.httpGet).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { Cookie: `UISAuth=${TOKEN}` } })
    );
  });

  it('returns the decoded blob and a filename', async () => {
    const r = await fetchIsBinary('https://is.mendelu.cz/f.pdf', TOKEN, deps());
    if (r.kind !== 'binary') throw new Error('expected binary');
    expect(await r.blob.text()).toBe('%PDF-1.5');
    expect(r.filename).toBe('dokument.pdf');
  });

  it('THROWS sessionExpired on 403 rather than saving an error page as a PDF', async () => {
    const d = deps({
      httpGet: vi.fn(async () => ({ status: 403, data: '', headers: {} })),
    });
    await expect(fetchIsBinary('https://is.mendelu.cz/f.pdf', TOKEN, d)).rejects.toMatchObject({
      sessionExpired: true,
    });
  });

  // Android's HttpRequestHandler.readData takes the `errorStream != null`
  // branch for any error status and returns the body as a RAW STRING, ignoring
  // responseType:'blob'. Without a status guard a 503 maintenance page fell
  // through to the HTML branch, where atob() choked on markup that was never
  // base64 — and the swallowed throw reported the outage as a lapsed session.
  it('THROWS a plain error on 5xx — an IS outage is not the student being logged out', async () => {
    const d = deps({
      httpGet: vi.fn(async () => ({
        status: 503,
        data: '<!DOCTYPE html><h1>Odstávka</h1>',
        headers: { 'Content-Type': 'text/html' },
      })),
    });
    const err = await fetchIsBinary('https://is.mendelu.cz/f.p12', TOKEN, d).catch((e) => e);
    expect(err.message).toMatch(/503/);
    expect(err.sessionExpired).toBeUndefined();
  });

  // Android forwards the server's own header casing, so the VALUE arrives
  // exactly as IS sent it. An exact-cased check would let `Text/Html` past and
  // save a login page as the document.
  it('detects HTML whatever the casing of the content-type value', async () => {
    const d = deps({
      httpGet: vi.fn(async () => ({
        status: 200,
        data: btoa('<html>login</html>'),
        headers: { 'Content-Type': 'Text/Html; charset=UTF-8' },
      })),
    });
    await expect(fetchIsBinary('https://is.mendelu.cz/f.p12', TOKEN, d)).rejects.toMatchObject({
      sessionExpired: true,
    });
  });

  it('THROWS on HTML with no logout link — that is a lapsed session, not a document', async () => {
    // btoa('<html>login</html>')
    const d = deps({
      httpGet: vi.fn(async () => ({
        status: 200,
        data: btoa('<html>login</html>'),
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      })),
    });
    await expect(fetchIsBinary('https://is.mendelu.cz/f.pdf', TOKEN, d)).rejects.toMatchObject({
      sessionExpired: true,
    });
  });

  it('reports an AUTHENTICATED html page as kind=page — dokumenty_cteni.pl is a viewer, not a file', async () => {
    const d = deps({
      httpGet: vi.fn(async () => ({
        status: 200,
        data: btoa('<html><a href="/system/logout.pl">out</a></html>'),
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      })),
    });
    await expect(
      fetchIsBinary('https://is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl?id=1', TOKEN, d)
    ).resolves.toEqual({ kind: 'page' });
  });

  it('refuses an off-IS link, and never sends the session', async () => {
    // File links are parsed out of IS HTML; an IS page can link anywhere.
    const d = deps();
    await expect(fetchIsBinary('https://evil.example/x.pdf', TOKEN, d)).rejects.toThrow(
      /evil\.example/
    );
    expect(d.httpGet).not.toHaveBeenCalled();
    expect(d.setCookie).not.toHaveBeenCalled();
  });
});

describe('toBytes', () => {
  it('returns the blob contents as bytes', async () => {
    const blob = new Blob([new Uint8Array([0x30, 0x82, 0x01])], { type: 'application/x-pkcs12' });
    const bytes = await toBytes({ kind: 'binary', blob, filename: 'cert.p12' });
    expect(Array.from(bytes)).toEqual([0x30, 0x82, 0x01]);
  });

  it('THROWS on a page — an HTML page must never be written as a certificate', async () => {
    // fetchIsBinary returns kind:'page' for an AUTHENTICATED html response.
    // For a .p12 request that means IS did not serve the file; saving the page
    // would produce a corrupt certificate that fails silently at install time.
    await expect(toBytes({ kind: 'page' })).rejects.toThrow(/page/i);
  });

  it('does NOT call that a lapsed session — kind:page is positive proof the session is alive', async () => {
    // fetchIsBinary only returns kind:'page' when the HTML CONTAINED logout.pl.
    // Tagging it sessionExpired asserts the opposite of what was just measured.
    // The flag means "the session lapsed, re-authenticate" — see
    // src/injector/messageHandler.ts:202, which redirects to the IS login page
    // on it — so any handler acting on it would push the student through
    // re-auth over a perfectly healthy response.
    const err = await toBytes({ kind: 'page' }).catch((e) => e);
    expect(err.sessionExpired).toBeUndefined();
  });
});

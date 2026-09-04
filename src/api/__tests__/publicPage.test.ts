import { describe, it, expect, vi } from 'vitest';
import { readPublicPageBody } from '../publicPage';

describe('readPublicPageBody', () => {
  // CapacitorHttp hands back a parsed `data` whose type depends on the
  // response's content-type. An HTML page normally arrives as a string, but a
  // proxy or a mislabelled response can produce an object, and the menu parser
  // takes a string — "[object Object]" would parse to an empty menu, which is
  // indistinguishable on screen from "the canteen posted nothing today".
  it('passes a string body straight through', () => {
    expect(readPublicPageBody({ status: 200, data: '<html>x</html>' })).toBe('<html>x</html>');
  });

  it('refuses a non-string body rather than stringifying it', () => {
    expect(() => readPublicPageBody({ status: 200, data: { a: 1 } })).toThrow(/not text/i);
  });

  it('refuses an error status, naming it', () => {
    expect(() => readPublicPageBody({ status: 503, data: '' })).toThrow(/503/);
  });

  it('accepts an empty string, which is a real answer', () => {
    expect(readPublicPageBody({ status: 200, data: '' })).toBe('');
  });
});

describe('fetchPublicPage transport choice', () => {
  // The menu is a PUBLIC page on skm.mendelu.cz — no cookies, no session. In
  // the extension it still has to go through the content script, because the
  // iframe's origin cannot read a cross-origin page. On Capacitor there is no
  // content script at all: REIS_FETCH goes unanswered and the request sat for
  // the full 30s REQUEST_TIMEOUT, which is why the jídelníček was missing on
  // the iPad while every other screen worked.
  it('uses the native transport on capacitor and the proxy elsewhere', async () => {
    const httpGet = vi.fn().mockResolvedValue({ status: 200, data: '<html>ok</html>' });
    const viaProxy = vi.fn().mockResolvedValue('<html>proxy</html>');
    const { fetchPublicPage } = await import('../publicPage');

    await expect(
      fetchPublicPage('https://skm.mendelu.cz/x', { kind: 'capacitor', httpGet, viaProxy })
    ).resolves.toBe('<html>ok</html>');
    expect(viaProxy).not.toHaveBeenCalled();

    await expect(
      fetchPublicPage('https://skm.mendelu.cz/x', { kind: 'extension', httpGet, viaProxy })
    ).resolves.toBe('<html>proxy</html>');
    expect(httpGet).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { fetchIsPhotoDataUrl, type PhotoDeps } from '../capacitorPhoto';
import { TOKEN } from './capacitorDeps';

const JPEG_B64 = '/9j/4AAQSkZJRgABAQEB';
const URL_18583 = 'https://is.mendelu.cz/auth/lide/foto.pl?id=18583;lang=cz';

/** The options bag `fetchIsPhotoDataUrl` handed to the native call — the twin
 *  of `sentTo` in capacitorDeps, which types the transport's own deps. */
function sentTo(fn: PhotoDeps['httpGet']) {
  return (fn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
    url: string;
    headers: Record<string, string>;
    responseType?: string;
  };
}

/**
 * Defaults to what the device actually answered for a person WITH a photo
 * (measured on the A001 handset, 2026-08-09): 200, `image/jpeg`, and the body
 * already base64 — CapacitorHttp hands `responseType: 'blob'` back as base64
 * on native, so there is no Blob to read here.
 */
function deps(over: Partial<PhotoDeps> = {}): PhotoDeps {
  return {
    platform: 'android',
    setCookie: vi.fn(async () => {}),
    httpGet: vi.fn(async () => ({
      status: 200,
      data: JPEG_B64,
      headers: { 'Content-Type': 'image/jpeg' },
    })),
    ...over,
  };
}

describe('fetchIsPhotoDataUrl', () => {
  it('returns a self-contained data: URL, the same shape the extension proxy resolves', async () => {
    const url = await fetchIsPhotoDataUrl(URL_18583, TOKEN, deps());
    expect(url).toBe(`data:image/jpeg;base64,${JPEG_B64}`);
  });

  it('seeds the native cookie jar on Android and sends no Cookie header', async () => {
    const setCookie = vi.fn(async () => {});
    const httpGet = vi.fn(async () => ({
      status: 200,
      data: JPEG_B64,
      headers: { 'Content-Type': 'image/jpeg' },
    }));
    await fetchIsPhotoDataUrl(URL_18583, TOKEN, deps({ platform: 'android', setCookie, httpGet }));
    expect(setCookie).toHaveBeenCalledWith({
      url: 'https://is.mendelu.cz',
      key: 'UISAuth',
      value: TOKEN,
    });
    expect(sentTo(httpGet)).toMatchObject({ headers: {}, responseType: 'blob' });
  });

  it('sends an explicit Cookie header on iOS and does not seed the jar', async () => {
    const setCookie = vi.fn(async () => {});
    const httpGet = vi.fn(async () => ({
      status: 200,
      data: JPEG_B64,
      headers: { 'Content-Type': 'image/jpeg' },
    }));
    await fetchIsPhotoDataUrl(URL_18583, TOKEN, deps({ platform: 'ios', setCookie, httpGet }));
    expect(setCookie).not.toHaveBeenCalled();
    expect(sentTo(httpGet).headers).toEqual({ Cookie: `UISAuth=${TOKEN}` });
  });

  /**
   * MEASURED, and the reason this cannot just trust a 200: IS answers an
   * unknown person id with `200 image/jpeg` and a body of ZERO bytes — not a
   * 404, not HTML. Building a data: URL out of that yields
   * `data:image/jpeg;base64,` which renders as a BROKEN-image glyph, strictly
   * worse than the caller's own fallback icon.
   */
  it('rejects an empty body — how IS says "this person has no photo"', async () => {
    const httpGet = vi.fn(async () => ({
      status: 200,
      data: '',
      headers: { 'Content-Type': 'image/jpeg' },
    }));
    await expect(fetchIsPhotoDataUrl(URL_18583, TOKEN, deps({ httpGet }))).rejects.toThrow(
      /empty/i
    );
  });

  it('rejects a non-image body rather than rendering a login page as a face', async () => {
    const httpGet = vi.fn(async () => ({
      status: 200,
      data: 'PGh0bWw+',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }));
    await expect(fetchIsPhotoDataUrl(URL_18583, TOKEN, deps({ httpGet }))).rejects.toThrow(
      /not an image/i
    );
  });

  it('rejects a non-2xx status', async () => {
    const httpGet = vi.fn(async () => ({
      status: 500,
      data: '',
      headers: { 'Content-Type': 'text/html' },
    }));
    await expect(fetchIsPhotoDataUrl(URL_18583, TOKEN, deps({ httpGet }))).rejects.toThrow(
      'HTTP 500'
    );
  });

  /**
   * A photo URL is built from a personId parsed out of IS HTML, so this is the
   * same guard `fetchIsBinary` carries: the session must never follow a URL to
   * another host.
   */
  it('refuses to send the session off the IS origin', async () => {
    const httpGet = vi.fn(async () => ({ status: 200, data: JPEG_B64, headers: {} }));
    await expect(
      fetchIsPhotoDataUrl('https://evil.example/foto.pl?id=1', TOKEN, deps({ httpGet }))
    ).rejects.toThrow(/refusing to send the IS session/);
    expect(httpGet).not.toHaveBeenCalled();
  });

  /** Some platforms hand back a full data: URI rather than bare base64. */
  it('passes through a body that already is a data: URI', async () => {
    const httpGet = vi.fn(async () => ({
      status: 200,
      data: `data:image/jpeg;base64,${JPEG_B64}`,
      headers: { 'Content-Type': 'image/jpeg' },
    }));
    const url = await fetchIsPhotoDataUrl(URL_18583, TOKEN, deps({ httpGet }));
    expect(url).toBe(`data:image/jpeg;base64,${JPEG_B64}`);
  });
});

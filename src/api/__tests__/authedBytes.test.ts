import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchAuthedBytes } from '../client';
import { setPlatform, __resetPlatformForTests } from '../../platform';
import type { ReisPlatform } from '../../platform/types';

function stub(kind: ReisPlatform['kind']): ReisPlatform {
  const bag = new Map<string, unknown>();
  return {
    kind,
    storage: {
      async get(k) {
        return bag.get(k);
      },
      async set(k, v) {
        bag.set(k, v);
      },
      async remove(k) {
        bag.delete(k);
      },
    },
    getAssetUrl: (p) => `/${p}`,
  };
}

describe('fetchAuthedBytes on the extension', () => {
  afterEach(() => {
    __resetPlatformForTests();
    vi.restoreAllMocks();
  });

  it('returns the response body as bytes, with credentials', async () => {
    setPlatform(stub('extension'));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([0x30, 0x82, 0x04]), {
        status: 200,
        headers: { 'content-type': 'application/x-pkcs12' },
      })
    );
    const bytes = await fetchAuthedBytes(
      'https://is.mendelu.cz/auth/wifi/certifikat.pl?get=user-p12'
    );
    expect(Array.from(bytes)).toEqual([0x30, 0x82, 0x04]);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/wifi/certifikat.pl?get=user-p12',
      { credentials: 'include' }
    );
  });

  it('THROWS on an HTML body — that is a login page, not a certificate', async () => {
    setPlatform(stub('extension'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>login</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=UTF-8' },
      })
    );
    await expect(fetchAuthedBytes('https://is.mendelu.cz/x')).rejects.toThrow(/HTML/i);
  });

  // `Headers` normalises header NAMES to lowercase but leaves VALUES alone, so
  // a server answering `Content-Type: Text/Html` reaches an exact-cased check
  // unchanged — and the HTML would then be written to disk as a .p12 that only
  // fails at install time. The Capacitor transport already lowercases here.
  it('THROWS on HTML whatever the casing of the content-type value', async () => {
    setPlatform(stub('extension'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>login</html>', {
        status: 200,
        headers: { 'content-type': 'Text/Html; charset=UTF-8' },
      })
    );
    await expect(fetchAuthedBytes('https://is.mendelu.cz/x')).rejects.toThrow(/HTML/i);
  });

  it('THROWS on a non-2xx', async () => {
    setPlatform(stub('extension'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    await expect(fetchAuthedBytes('https://is.mendelu.cz/x')).rejects.toThrow(/500/);
  });
});

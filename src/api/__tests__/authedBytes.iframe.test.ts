import { describe, it, expect, afterEach, vi } from 'vitest';

// The iframe app is chrome-extension:// — cross-site to is.mendelu.cz. Where
// the browser blocks third-party cookies (Brave by default, Chrome by setting)
// a direct fetch from here reaches IS without UISAuth and gets 403, which is
// how the eduroam profile failed for a student whose cert page had just loaded
// fine through the proxy. Bytes must take the same first-party route.
const fetchViaProxy = vi.fn();
vi.mock('../proxyClient', () => ({
  fetchViaProxy: (...args: unknown[]) => fetchViaProxy(...args),
  isInIframe: () => true,
}));
vi.mock('../../platform', () => ({ getPlatform: () => ({ kind: 'extension' }) }));

import { fetchAuthedBytes } from '../client';

describe('fetchAuthedBytes inside the extension iframe', () => {
  afterEach(() => vi.restoreAllMocks());

  it('goes through the content script and never fetches directly', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchViaProxy.mockResolvedValue('MIIE'); // base64 of 30 82 04
    const url = 'https://is.mendelu.cz/auth/wifi/certifikat.pl?get=root-der;lang=cz';

    const bytes = await fetchAuthedBytes(url);

    expect(Array.from(bytes)).toEqual([0x30, 0x82, 0x04]);
    expect(fetchViaProxy).toHaveBeenCalledWith(url, { responseType: 'bytes' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

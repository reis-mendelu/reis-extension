import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { fetchCvicneTests } from '../cvicneTests';
import { fetchOdevzdavarny } from '../odevzdavarny';
import { fetchKontrolaData } from '../kontrola';
import { setPlatform, __resetPlatformForTests } from '../../platform';
import type { ReisPlatform } from '../../platform/types';

/**
 * These three read IS through a bare `fetch`. That works in the extension only
 * because a Chrome extension's fetch bypasses CORS for hosts in
 * `host_permissions` — a privilege the Capacitor app does not have, so on the
 * phone each one fails silently and the screen shows nothing.
 *
 * "It works in the extension" therefore proves nothing here; what has to be
 * asserted is that the request goes through the shared transport, which routes
 * natively on Capacitor. DEFAULT_HEADERS is that transport's fingerprint — a
 * bare fetch sends none of it.
 */
function stubPlatform(): ReisPlatform {
  const bag = new Map<string, unknown>();
  return {
    kind: 'extension',
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

describe('IS reads route through the authenticated transport', () => {
  let seen: { init?: RequestInit; url?: string };

  beforeEach(() => {
    setPlatform(stubPlatform());
    seen = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      seen.url = String(input);
      seen.init = init;
      return new Response('<html><body></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    });
  });

  afterEach(() => {
    __resetPlatformForTests();
    vi.restoreAllMocks();
  });

  const assertRouted = () => {
    const headers = (seen.init?.headers ?? {}) as Record<string, string>;
    expect(headers['accept-language']).toBeDefined();
    expect(seen.init?.credentials).toBe('include');
  };

  it('practice tests (subject detail)', async () => {
    await fetchCvicneTests('12345');
    expect(seen.url).toContain('seznam_osnov.pl');
    assertRouted();
  });

  it('submissions', async () => {
    await fetchOdevzdavarny('12345', '678');
    expect(seen.url).toContain('odevzdavarny.pl');
    assertRouted();
  });

  it('study check', async () => {
    await fetchKontrolaData();
    expect(seen.url).toContain('kontrola');
    assertRouted();
  });
});

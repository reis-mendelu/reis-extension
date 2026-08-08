import { describe, it, expect, afterEach, vi } from 'vitest';
import { parseCertPage, fetchEduroamCertMaterial } from './eduroam';
import { setPlatform, __resetPlatformForTests } from '../platform';
import type { ReisPlatform } from '../platform/types';

describe('parseCertPage', () => {
  it('detects an existing cert and extracts the CZ password', () => {
    const html = `
      <p>použijte prosím heslo <b>wIp.num.7.uzo</b></p>
      <ul><li><a href="certifikat.pl?get=user-p12;lang=cz">PKCS#12</a></li>
      <li><a href="certifikat.pl?get=root-der;lang=cz">root</a></li></ul>`;
    expect(parseCertPage(html)).toEqual({ hasCert: true, password: 'wIp.num.7.uzo' });
  });

  it('extracts the EN password variant', () => {
    const html = `please use the password <b>abc.def.1.ghi</b>
      <a href="certifikat.pl?get=user-p12;lang=en">p12</a>`;
    expect(parseCertPage(html).password).toBe('abc.def.1.ghi');
  });

  it('reports no cert when only the generate button is present', () => {
    const html = `<form><input type="submit" name="gen" value="Vygenerovat certifikát"></form>`;
    expect(parseCertPage(html)).toEqual({ hasCert: false, password: null });
  });
});

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
    // Shares the plain bag: these tests exercise the transport, not the
    // storage guarantee — tokenStore.test.ts owns that.
    secureStorage: {
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

const NO_CERT = '<form><input type="submit" name="gen" value="Vygenerovat certifikát"></form>';
const HAS_CERT = 'heslo <b>wIp.num.7.uzo</b> <a href="certifikat.pl?get=user-p12;lang=cz">p12</a>';

describe('generateCert on the wire', () => {
  afterEach(() => {
    __resetPlatformForTests();
    vi.restoreAllMocks();
  });

  /**
   * This is the product's only IS *write* through fetchWithAuth, and a
   * malformed Content-Type means IS never parses the body: no certificate is
   * created and the student is told "generation did not produce a certificate".
   *
   * DEFAULT_HEADERS carries a lowercase `content-type`. A caller adding
   * `Content-Type` survives the object spread as a SECOND, distinct key, and
   * `new Headers({...})` APPENDS rather than replaces — so the request went out
   * with `application/x-www-form-urlencoded, application/x-www-form-urlencoded`.
   *
   * The assertion counts keys on the object handed to `fetch` rather than
   * reading it back through `new Headers`, because happy-dom's Headers is the
   * one implementation that silently REPLACES on a duplicate name. Node/undici
   * and real browsers append, which is the whole defect — a test routed through
   * happy-dom's Headers would pass while the wire stayed malformed.
   */
  it('puts exactly one content-type on the generate POST', async () => {
    setPlatform(stubPlatform());
    let postInit: RequestInit | undefined;
    let pageHits = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (init?.method === 'POST') {
        postInit = init;
        return new Response('ok', { status: 200 });
      }
      if (url.includes('get=')) {
        return new Response(new Uint8Array([0x30, 0x82]), {
          status: 200,
          headers: { 'content-type': 'application/x-pkcs12' },
        });
      }
      pageHits++;
      return new Response(pageHits === 1 ? NO_CERT : HAS_CERT, { status: 200 });
    });

    await fetchEduroamCertMaterial();

    const sent = postInit?.headers as Record<string, string>;
    const contentTypes = Object.entries(sent)
      .filter(([key]) => key.toLowerCase() === 'content-type')
      .map(([, value]) => value);
    expect(contentTypes).toEqual(['application/x-www-form-urlencoded']);
  });
});

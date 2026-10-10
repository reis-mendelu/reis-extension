import { describe, it, expect, afterEach, vi } from 'vitest';
import { parseCertPage, fetchEduroamCertMaterial, regenerateEduroamCert } from './eduroam';
import { base64ToBytes } from '../services/eduroam/base64';
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

// Synthetic, from a throwaway test CA: notAfter 2025-01-01T12:00:00Z.
const EXPIRED_DER = new Uint8Array(
  base64ToBytes(
    'MIICNDCCARygAwIBAgIUMrn7ZQT+x/nKOtF/FDIXwjy5cxcwDQYJKoZIhvcNAQELBQAwFDESMBAGA1UEAwwJVGVzdCBSb290MB4XDTI0MDEwMTAwMDAwMFoXDTI1MDEwMTEyMDAwMFowGzEZMBcGA1UEAwwQeHRlc3RAbWVuZGVsdS5jejBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABF3mIB0YgTZZe2wS5XHmFuznoWmLGOYASX5wNVD5z0S1ZcYqJ1m2cKoW1h1uzNbOvXX725560WcrZdAT+jsOKs6jQjBAMB0GA1UdDgQWBBQj1wHwTdId87wF+iaW3zxmXDCe9zAfBgNVHSMEGDAWgBTkIE0iF9krSvW0AQYnjXnM44U0xzANBgkqhkiG9w0BAQsFAAOCAQEAg6xwegiDTG/lbfJ1VC5rzx58SSeQTF5zDsZvCNnhlbk8lwtrVyBZvSnG989i15nroXR/ShQ36RO5aTmzPJIac/qezuYeQcmOeENMxTfjbfTMXb8H0GWD1rELhp0SAnkdb4D7oqQlC1MutpFch7jTZy+zkTyVujsyaugGiwDDsVwafoRofZBrFv22mAS8UmmoSRS1w3+9i1t28SVKUWYYMrxETevRoNSpxJ1zlUF92zlEGFgo9cj2A0h/xmpYrK4PCjl5pzP4i14It8cLr10DvBCNK10jl+1vir5mgKCDHBLam6h/KiEHOklgqp9Xf0PTuAhKOOSN1955GlxTmgZEGQ=='
  )
);

/** IS with an existing certificate; `der` answers `get=user-der`. */
function stubIs(der: () => Response) {
  const posts: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === 'POST') {
      posts.push(String(init.body));
      return new Response('ok', { status: 200 });
    }
    if (url.includes('get=user-der')) return der();
    if (url.includes('get=')) {
      return new Response(new Uint8Array([0x30, 0x82]), {
        status: 200,
        headers: { 'content-type': 'application/x-pkcs12' },
      });
    }
    return new Response(HAS_CERT, { status: 200 });
  });
  return posts;
}

describe('certificate expiry', () => {
  afterEach(() => {
    __resetPlatformForTests();
    vi.restoreAllMocks();
  });

  /**
   * IS does not replace an expired certificate by itself, and its page keeps
   * offering one, so reIS used to install a dead certificate and report
   * success. The expiry comes from the certificate, not the page.
   */
  it('reports when the existing certificate expires', async () => {
    setPlatform(stubPlatform());
    stubIs(() => new Response(EXPIRED_DER, { status: 200 }));

    const material = await fetchEduroamCertMaterial();

    expect(material.expiresAt).toEqual(new Date('2025-01-01T12:00:00Z'));
  });

  // Generating rotates a credential the student may have on other devices.
  // Only the student's own tap may do it — never the act of noticing expiry.
  it('never generates a certificate because the existing one expired', async () => {
    setPlatform(stubPlatform());
    const posts = stubIs(() => new Response(EXPIRED_DER, { status: 200 }));

    await fetchEduroamCertMaterial();

    expect(posts).toEqual([]);
  });

  // The check only adds information. Failing to read it must not cost the
  // student the setup that worked before it existed.
  it('carries on with an unknown expiry when the DER cannot be fetched', async () => {
    setPlatform(stubPlatform());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubIs(() => new Response('nope', { status: 500 }));

    const material = await fetchEduroamCertMaterial();

    expect(material.expiresAt).toBeNull();
    expect(material.clientP12.length).toBeGreaterThan(0);
  });

  it('generates exactly once when the student asks for a new certificate', async () => {
    setPlatform(stubPlatform());
    const posts = stubIs(() => new Response(EXPIRED_DER, { status: 200 }));

    await regenerateEduroamCert();

    expect(posts).toHaveLength(1);
    expect(posts[0]).toContain('gen=');
  });
});

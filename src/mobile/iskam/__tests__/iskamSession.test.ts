import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IskamHttpDeps, NativeHttpResponse } from '../iskamHttp';
import type { IskamJar } from '../iskamJar';

const store = new Map<string, unknown>();
const secureStorage = {
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => {
    store.set(k, v);
  },
  remove: async (k: string) => {
    store.delete(k);
  },
};
vi.mock('../../../platform', () => ({
  getPlatform: () => ({ kind: 'capacitor', secureStorage }),
}));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

import { runSilentChain } from '../iskamSession';
import { __resetIskamJarForTests, clearJar, loadJar, saveJar } from '../iskamCookieStore';

const W = 'webiskam.mendelu.cz';
const A = 'alibaba.mendelu.cz';
const STORED: IskamJar = [
  { name: '.ISKAMASPXAUTH', value: 'old', host: W, path: '/', expires: null },
  { name: '_shibsession_ab', value: 'sp', host: W, path: '/', expires: null },
  { name: 'shib_idp_session', value: 'idp', host: A, path: '/idp', expires: null },
];
const KONTA_OK = '<div class="vyskaRiadkuKonto">Hlavní konto</div>';
const SAML = `<form action="https://webiskam.mendelu.cz/Shibboleth.sso/SAML2/POST" method="post"><input type="hidden" name="SAMLResponse" value="x"/></form>`;
const PASSWORD = `<form method="post"><input name="j_username"/><input type="password" name="j_password"/></form>`;

type Route = (url: string, method: string) => NativeHttpResponse;
function http(route: Route) {
  const calls: string[] = [];
  const deps: IskamHttpDeps = {
    platform: 'ios',
    setCookie: async () => {},
    request: vi.fn(async (o: Parameters<IskamHttpDeps['request']>[0]) => {
      const u = new URL(o.url);
      calls.push(`${o.method} ${u.host}${u.pathname}`);
      return route(o.url, o.method);
    }),
  };
  return { deps, calls };
}
const toHomeIndex: NativeHttpResponse = {
  status: 302,
  headers: { Location: '/Home/Index?ReturnUrl=%2fKonta' },
  data: '',
};

describe('runSilentChain', () => {
  beforeEach(async () => {
    store.clear();
    __resetIskamJarForTests();
    await saveJar(STORED);
  });

  it('is dead without asking anyone when nothing is stored', async () => {
    await clearJar();
    const { deps, calls } = http(() => ({ status: 500 }));
    expect(await runSilentChain(deps)).toEqual({ state: 'dead' });
    expect(calls).toEqual([]);
  });

  it('is live on the first /Konta when the ticket still works', async () => {
    const { deps, calls } = http(() => ({ status: 200, headers: {}, data: KONTA_OK }));
    expect(await runSilentChain(deps)).toEqual({ state: 'live', kontaHtml: KONTA_OK });
    expect(calls).toEqual(['GET webiskam.mendelu.cz/Konta']);
  });

  it('re-issues the ticket from the SP session in one hop, then re-reads /Konta', async () => {
    let n = 0;
    const { deps, calls } = http((url) => {
      if (url.endsWith('/Konta')) return n++ === 0 ? toHomeIndex : { status: 200, data: KONTA_OK };
      return {
        status: 302,
        headers: {
          'Set-Cookie': '.ISKAMASPXAUTH=fresh; path=/',
          Location: '/ObjednavkyStravovani',
        },
        data: '',
      };
    });
    expect((await runSilentChain(deps)).state).toBe('live');
    expect(calls).toEqual([
      'GET webiskam.mendelu.cz/Konta',
      'GET webiskam.mendelu.cz/Prihlaseni/AuthShibb',
      'GET webiskam.mendelu.cz/Konta',
    ]);
    expect((await loadJar()).find((c) => c.name === '.ISKAMASPXAUTH')?.value).toBe('fresh');
  });

  it('falls through to the IdP and posts the SAML form back to webiskam', async () => {
    let konta = 0;
    let authShibb = 0;
    const { deps, calls } = http((url, method) => {
      const u = new URL(url);
      if (u.pathname === '/Konta')
        return konta++ === 0 ? toHomeIndex : { status: 200, data: KONTA_OK };
      if (u.pathname === '/Prihlaseni/AuthShibb')
        return authShibb++ === 0
          ? {
              status: 302,
              headers: {
                Location: 'https://alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO?SAMLRequest=x',
              },
              data: '',
            }
          : {
              status: 302,
              headers: {
                'Set-Cookie': '.ISKAMASPXAUTH=viaidp; path=/',
                Location: '/ObjednavkyStravovani',
              },
              data: '',
            };
      if (u.host === 'alibaba.mendelu.cz')
        return {
          status: 200,
          headers: { 'Set-Cookie': 'shib_idp_session_ss=rot; Path=/idp' },
          data: SAML,
        };
      if (u.pathname === '/Shibboleth.sso/SAML2/POST' && method === 'POST')
        return {
          status: 302,
          headers: {
            'Set-Cookie': '_shibsession_ab=sp2; path=/',
            Location: '/Prihlaseni/AuthShibb',
          },
          data: '',
        };
      return { status: 500 };
    });
    expect((await runSilentChain(deps)).state).toBe('live');
    expect(calls).toEqual([
      'GET webiskam.mendelu.cz/Konta',
      'GET webiskam.mendelu.cz/Prihlaseni/AuthShibb',
      'GET alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO',
      'POST webiskam.mendelu.cz/Shibboleth.sso/SAML2/POST',
      'GET webiskam.mendelu.cz/Prihlaseni/AuthShibb',
      'GET webiskam.mendelu.cz/Konta',
    ]);
    // alibaba rotates shib_idp_session_ss on every SSO; the rotation must be kept.
    expect((await loadJar()).find((c) => c.name === 'shib_idp_session_ss')?.value).toBe('rot');
  });

  it('is dead at the password form, never submits it, and clears the stored login', async () => {
    const { deps, calls } = http((url) => {
      const u = new URL(url);
      if (u.pathname === '/Konta') return toHomeIndex;
      if (u.pathname === '/Prihlaseni/AuthShibb')
        return {
          status: 302,
          headers: { Location: 'https://alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO' },
          data: '',
        };
      return { status: 200, data: PASSWORD };
    });
    expect(await runSilentChain(deps)).toEqual({ state: 'dead' });
    expect(calls.some((c) => c.startsWith('POST'))).toBe(false);
    expect(await loadJar()).toEqual([]);
  });

  it('refuses a SAML form that posts anywhere but webiskam', async () => {
    const { deps } = http((url) => {
      const u = new URL(url);
      if (u.pathname === '/Konta') return toHomeIndex;
      if (u.pathname === '/Prihlaseni/AuthShibb')
        return { status: 302, headers: { Location: 'https://alibaba.mendelu.cz/idp/x' }, data: '' };
      return { status: 200, data: SAML.replace('webiskam.mendelu.cz', 'evil.example') };
    });
    expect((await runSilentChain(deps)).state).toBe('dead');
  });

  it('keeps the stored login on a network error or a 5xx', async () => {
    const down = http(() => {
      throw new Error('The Internet connection appears to be offline.');
    });
    expect((await runSilentChain(down.deps)).state).toBe('unreachable');
    const broken = http(() => ({ status: 503, data: '' }));
    expect((await runSilentChain(broken.deps)).state).toBe('unreachable');
    expect(await loadJar()).toEqual(STORED);
  });

  it('a sign-out that lands mid-chain wins: the chain does not write the cookies back', async () => {
    const { deps } = http((url) => {
      if (url.endsWith('/Konta')) {
        void clearJar();
        return {
          status: 200,
          headers: { 'Set-Cookie': '.ISKAMASPXAUTH=late; path=/' },
          data: KONTA_OK,
        };
      }
      return { status: 500 };
    });
    await runSilentChain(deps);
    expect(await loadJar()).toEqual([]);
  });

  // Review finding I4: a Set-Cookie that DELETES the ticket used to count as a
  // new one, so the chain said "ok", /Konta 302'd, and the result was
  // "unreachable" forever — the IdP leg was never tried.
  it('a Set-Cookie that deletes the ticket is not a new ticket: the chain goes on to the IdP', async () => {
    let konta = 0;
    let authShibb = 0;
    const { deps, calls } = http((url, method) => {
      const u = new URL(url);
      if (u.pathname === '/Konta')
        return konta++ === 0 ? toHomeIndex : { status: 200, data: KONTA_OK };
      if (u.pathname === '/Prihlaseni/AuthShibb')
        return authShibb++ === 0
          ? {
              status: 302,
              headers: {
                'Set-Cookie': '.ISKAMASPXAUTH=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/',
                Location: 'https://alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO',
              },
              data: '',
            }
          : {
              status: 302,
              headers: { 'Set-Cookie': '.ISKAMASPXAUTH=new; path=/', Location: '/' },
              data: '',
            };
      if (u.host === 'alibaba.mendelu.cz') return { status: 200, data: SAML };
      if (method === 'POST')
        return { status: 302, headers: { Location: '/Prihlaseni/AuthShibb' }, data: '' };
      return { status: 500 };
    });
    expect((await runSilentChain(deps)).state).toBe('live');
    expect(calls).toContain('GET alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO');
  });

  // Review finding M1: alibaba re-asks attribute consent when the attributes
  // change. That page has a form but no SAML response and no password field;
  // it used to be "unreachable" (retry only), which no retry could fix.
  it('an IdP page that needs the student (consent) sends them to the popup', async () => {
    const CONSENT = `<form method="post"><input type="hidden" name="_shib_idp_consentIds" value="mail"/><button name="_eventId_proceed">OK</button></form>`;
    const { deps } = http((url) => {
      const u = new URL(url);
      if (u.pathname === '/Konta') return toHomeIndex;
      if (u.pathname === '/Prihlaseni/AuthShibb')
        return { status: 302, headers: { Location: 'https://alibaba.mendelu.cz/idp/x' }, data: '' };
      return { status: 200, data: CONSENT };
    });
    expect((await runSilentChain(deps)).state).toBe('dead');
  });

  // PR #548 review: a network error after alibaba rotated its cookies threw out
  // of reauthenticate and the rotated jar was never saved.
  it('keeps cookies the IdP rotated even when a later hop fails on the network', async () => {
    const { deps } = http((url, method) => {
      const u = new URL(url);
      if (u.pathname === '/Konta') return toHomeIndex;
      if (u.pathname === '/Prihlaseni/AuthShibb')
        return { status: 302, headers: { Location: 'https://alibaba.mendelu.cz/idp/x' }, data: '' };
      if (u.host === 'alibaba.mendelu.cz')
        return {
          status: 200,
          headers: { 'Set-Cookie': 'shib_idp_session_ss=rot; Path=/idp' },
          data: SAML,
        };
      if (method === 'POST') throw new Error('The network connection was lost.');
      return { status: 500 };
    });
    expect((await runSilentChain(deps)).state).toBe('unreachable');
    expect((await loadJar()).find((c) => c.name === 'shib_idp_session_ss')?.value).toBe('rot');
  });

  it('a secure-store read failure is unreachable, not signed out, and keeps the login', async () => {
    const spy = vi.spyOn(secureStorage, 'get').mockRejectedValueOnce(new Error('keystore'));
    const { deps, calls } = http(() => ({ status: 500 }));
    expect((await runSilentChain(deps)).state).toBe('unreachable');
    expect(calls).toEqual([]);
    spy.mockRestore();
    expect(await loadJar()).toEqual(STORED);
  });

  // PR #548 review: an auth-looking path is only auth on webiskam itself.
  it('a redirect to /Home/Index on another host is not a lapsed login', async () => {
    const { deps, calls } = http(() => ({
      status: 302,
      headers: { Location: 'https://example.org/Home/Index' },
      data: '',
    }));
    expect((await runSilentChain(deps)).state).toBe('unreachable');
    expect(calls).toEqual(['GET webiskam.mendelu.cz/Konta']);
    expect(await loadJar()).toEqual(STORED);
  });
});

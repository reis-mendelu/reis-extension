import { describe, it, expect, vi } from 'vitest';
import { iskamHop, type IskamHttpDeps, type NativeHttpResponse } from '../iskamHttp';
import type { IskamJar } from '../iskamJar';

const JAR: IskamJar = [
  { name: '.ISKAMASPXAUTH', value: 't', host: 'webiskam.mendelu.cz', path: '/', expires: null },
  {
    name: 'shib_idp_session',
    value: 's',
    host: 'alibaba.mendelu.cz',
    path: '/idp',
    expires: null,
  },
];

function deps(
  platform: IskamHttpDeps['platform'],
  response: NativeHttpResponse = { status: 200, headers: {}, data: 'ok' }
) {
  return {
    platform,
    request: vi.fn(async (_o: Parameters<IskamHttpDeps['request']>[0]) => response),
    setCookie: vi.fn(async (_o: Parameters<IskamHttpDeps['setCookie']>[0]) => {}),
  } satisfies IskamHttpDeps;
}

describe('iskamHop', () => {
  it("iOS: sends only this host's cookies as an explicit header, last, and never seeds the jar", async () => {
    const d = deps('ios');
    await iskamHop(d, JAR, 'https://webiskam.mendelu.cz/Konta', {
      headers: { Cookie: 'spoof=1' },
    });
    const sent = d.request.mock.calls[0]![0];
    expect(sent.headers.Cookie).toBe('.ISKAMASPXAUTH=t');
    expect(sent.disableRedirects).toBe(true);
    expect(d.setCookie).not.toHaveBeenCalled();
  });

  it('Android: seeds the native jar as session cookies for this host only, with no Cookie header', async () => {
    const d = deps('android');
    await iskamHop(d, JAR, 'https://alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO');
    expect(d.setCookie).toHaveBeenCalledTimes(1);
    expect(d.setCookie).toHaveBeenCalledWith({
      url: 'https://alibaba.mendelu.cz/idp',
      key: 'shib_idp_session',
      value: 's',
      path: '/idp',
    });
    expect(d.request.mock.calls[0]![0].headers.Cookie).toBeUndefined();
  });

  it('folds Set-Cookie back into the jar and resolves a relative Location', async () => {
    const d = deps('ios', {
      status: 302,
      headers: {
        'set-cookie': '.ISKAMASPXAUTH=new; path=/, ISKaM4_SessionId=x; path=/',
        Location: '/ObjednavkyStravovani',
      },
      data: '',
    });
    const { res, jar } = await iskamHop(d, [], 'https://webiskam.mendelu.cz/Prihlaseni/AuthShibb');
    expect(res.status).toBe(302);
    expect(res.location).toBe('https://webiskam.mendelu.cz/ObjednavkyStravovani');
    expect(res.setCookieNames).toEqual(['.ISKAMASPXAUTH', 'ISKaM4_SessionId']);
    expect(jar.map((c) => c.name)).toEqual(['.ISKAMASPXAUTH', 'ISKaM4_SessionId']);
  });

  it('POSTs a form body with the urlencoded content type', async () => {
    const d = deps('ios');
    await iskamHop(d, [], 'https://webiskam.mendelu.cz/Shibboleth.sso/SAML2/POST', {
      method: 'POST',
      body: 'SAMLResponse=x',
    });
    const sent = d.request.mock.calls[0]![0];
    expect(sent.method).toBe('POST');
    expect(sent.data).toBe('SAMLResponse=x');
    expect(sent.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it("refuses to send anything to a host outside the jar's two", async () => {
    const d = deps('ios');
    await expect(iskamHop(d, JAR, 'https://is.mendelu.cz/')).rejects.toThrow(/refusing/);
    expect(d.request).not.toHaveBeenCalled();
  });

  it('turns a parsed JSON body back into text', async () => {
    const d = deps('ios', { status: 200, headers: {}, data: { a: 1 } });
    const { res } = await iskamHop(d, [], 'https://webiskam.mendelu.cz/x');
    expect(res.body).toBe('{"a":1}');
  });
});

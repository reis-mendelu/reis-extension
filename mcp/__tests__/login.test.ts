import { describe, it, expect, vi } from 'vitest';
import { loginToIs, IsLoginError } from '../login';

const TOKEN = 'abcDEF123%2Fxyz456789==';

// A plain object, not a Response: the suite runs in happy-dom, whose Headers
// drop Set-Cookie exactly like a browser's. Node's fetch exposes it.
function respond(
  status: number,
  init: { cookies?: string[]; html?: string; location?: string } = {}
) {
  return {
    status,
    headers: {
      getSetCookie: () => init.cookies ?? [],
      get: (name: string) => (name.toLowerCase() === 'location' ? (init.location ?? null) : null),
    },
    text: async () => init.html ?? '',
  };
}

// Shape of IS's answer to a wrong login, probed live 2026-10-10: HTTP 200, no
// cookie, the form again with the OTP field disabled and auth_2fa_type "no".
// The page always carries these static error texts, so they prove nothing.
const WRONG_LOGIN_PAGE =
  '<span>Incorrect login or password.</span><span>Please type the verification code</span>' +
  '<input type="password" name="credential_1" value="" />' +
  '<input type="text" name="credential_k" size="20" disabled="disabled" autocomplete="off" />' +
  '<input type="hidden" name="auth_2fa_type" value="no" id="auth_2fa_type" />';

const asFetch = (f: unknown) => f as typeof fetch;

describe('loginToIs', () => {
  it('posts the IS login form and returns the UISAuth cookie pair', async () => {
    const f = vi.fn().mockResolvedValue(
      respond(302, {
        cookies: [`UISAuth=${TOKEN}; path=/; secure; HttpOnly`],
        location: '/auth/?lang=cz',
      })
    );
    await expect(loginToIs('xstudent', 'pw', asFetch(f))).resolves.toBe(`UISAuth=${TOKEN}`);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('https://is.mendelu.cz/system/login.pl');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    const body = new URLSearchParams(init.body as URLSearchParams);
    expect(body.get('credential_0')).toBe('xstudent');
    expect(body.get('credential_1')).toBe('pw');
    expect(body.get('auth_2fa_type')).toBe('no');
  });

  it('reports bad credentials when IS shows the login form again', async () => {
    const f = vi.fn().mockResolvedValue(respond(200, { html: WRONG_LOGIN_PAGE }));
    const err = await loginToIs('x', 'wrong', asFetch(f)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IsLoginError);
    expect((err as IsLoginError).kind).toBe('bad-credentials');
  });

  it('reports two-factor when IS enables the verification-code field', async () => {
    const html =
      '<input type="password" name="credential_1" value="" />' +
      '<input type="text" name="credential_k" size="20" class="reqfields" id="overovaci_kod" />';
    const f = vi.fn().mockResolvedValue(respond(200, { html }));
    const err = await loginToIs('x', 'pw', asFetch(f)).catch((e: unknown) => e);
    expect((err as IsLoginError).kind).toBe('two-factor');
  });

  it('reports two-factor when auth_2fa_type is not "no"', async () => {
    const html = '<input type="hidden" name="auth_2fa_type" value="totp" id="auth_2fa_type" />';
    const f = vi.fn().mockResolvedValue(respond(200, { html }));
    const err = await loginToIs('x', 'pw', asFetch(f)).catch((e: unknown) => e);
    expect((err as IsLoginError).kind).toBe('two-factor');
  });

  it('treats a disabled OTP field as no 2FA whatever the attribute order', async () => {
    const html =
      '<input type="password" name="credential_1" value="" />' +
      '<input disabled="disabled" type="text" name="credential_k" />';
    const f = vi.fn().mockResolvedValue(respond(200, { html }));
    const err = await loginToIs('x', 'wrong', asFetch(f)).catch((e: unknown) => e);
    expect((err as IsLoginError).kind).toBe('bad-credentials');
  });

  it('reads the form from a 403 answer too', async () => {
    const f = vi.fn().mockResolvedValue(respond(403, { html: WRONG_LOGIN_PAGE }));
    const err = await loginToIs('x', 'wrong', asFetch(f)).catch((e: unknown) => e);
    expect((err as IsLoginError).kind).toBe('bad-credentials');
  });

  it('never reads a 5xx page as bad credentials', async () => {
    const f = vi.fn().mockResolvedValue(respond(503, { html: WRONG_LOGIN_PAGE }));
    const err = await loginToIs('x', 'pw', asFetch(f)).catch((e: unknown) => e);
    expect((err as IsLoginError).kind).toBe('unexpected');
  });

  it('never puts the username or password into the error message', async () => {
    const f = vi.fn().mockResolvedValue(respond(500));
    const err = await loginToIs('xsecretuser', 'hunter2pw', asFetch(f)).catch((e: unknown) => e);
    expect((err as IsLoginError).kind).toBe('unexpected');
    expect(String((err as Error).message)).not.toMatch(/xsecretuser|hunter2pw/);
  });

  it('treats a network failure as unexpected', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const err = await loginToIs('x', 'pw', asFetch(f)).catch((e: unknown) => e);
    expect((err as IsLoginError).kind).toBe('unexpected');
  });

  it('rejects an implausible cookie value as unexpected', async () => {
    const f = vi.fn().mockResolvedValue(respond(302, { cookies: ['UISAuth=short; path=/'] }));
    const err = await loginToIs('x', 'pw', asFetch(f)).catch((e: unknown) => e);
    expect((err as IsLoginError).kind).toBe('unexpected');
  });
});

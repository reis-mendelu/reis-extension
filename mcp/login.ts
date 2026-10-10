import { isPlausibleToken, UIS_AUTH_COOKIE } from '../src/platform/sessionToken';

const LOGIN_URL = 'https://is.mendelu.cz/system/login.pl';

export type LoginFailure = 'bad-credentials' | 'two-factor' | 'unexpected';

/** Messages are fixed strings: a thrown message ends up in Claude Desktop's logs. */
export class IsLoginError extends Error {
  readonly kind: LoginFailure;

  constructor(kind: LoginFailure, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'IsLoginError';
  }
}

const MESSAGES: Record<LoginFailure, string> = {
  'bad-credentials':
    'IS Mendelu rejected the username or password. Fix them in Claude Desktop → Settings → Extensions → reIS for Claude.',
  'two-factor':
    'This IS Mendelu account uses two-factor sign-in, which reIS for Claude does not support yet.',
  unexpected:
    'IS Mendelu did not start a session. Try again later; if it persists, IS may have changed its login.',
};

const fail = (kind: LoginFailure) => new IsLoginError(kind, MESSAGES[kind]);

/**
 * One browserless form POST, the same fields IS's own login page sends.
 * Resolves to the `UISAuth=<value>` cookie pair (verified live 2026-10-10:
 * 302 + Set-Cookie, and that cookie alone opens /auth/ pages).
 *
 * Classified by form state, never by text: IS's login page always carries
 * the static "Incorrect login or password" message, hidden or not.
 */
export async function loginToIs(
  user: string,
  pass: string,
  fetchImpl: typeof fetch
): Promise<string> {
  const body = new URLSearchParams({
    login_hidden: '1',
    destination: '/auth/?lang=cz',
    auth_id_hidden: '0',
    auth_2fa_type: 'no',
    credential_0: user,
    credential_1: pass,
    login: 'Přihlásit',
  });
  let res: Response;
  try {
    res = await fetchImpl(LOGIN_URL, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    throw fail('unexpected');
  }

  const prefix = `${UIS_AUTH_COOKIE}=`;
  const pair = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0] ?? '')
    .find((c) => c.startsWith(prefix));
  if (pair && isPlausibleToken(pair.slice(prefix.length))) return pair;

  // IS has answered with its form under 200 and 403 (live, 2026-10-10); 401 is
  // read too. Anything else (a 5xx maintenance page) stays unexpected, so it is
  // never mistaken for bad credentials and made final.
  const html = [200, 401, 403].includes(res.status) ? await res.text().catch(() => '') : '';
  // The OTP field ships disabled; it counts as enabled only when the tag has no
  // disabled attribute anywhere, whatever the attribute order.
  const otpTag = /<input\b[^>]*\bname="credential_k"[^>]*>/.exec(html)?.[0];
  const otpEnabled = !!otpTag && !/\bdisabled\b/.test(otpTag);
  const twoFactorType = /name="auth_2fa_type" value="(?!no")/.test(html);
  if (otpEnabled || twoFactorType) throw fail('two-factor');
  if (/name="credential_1"/.test(html)) throw fail('bad-credentials');
  throw fail('unexpected');
}

/**
 * The WebISKAM login, as cookies, and the rules for where each one may go.
 *
 * WebISKAM signs in through MENDELU's Shibboleth IdP, so the login is two
 * jars: webiskam.mendelu.cz (`.ISKAMASPXAUTH`, `ISKaM4_SessionId`,
 * `_shibsession_<hex>`) and alibaba.mendelu.cz under /idp (`shib_idp_session`,
 * `shib_idp_session_ss`, `shib_idp_persistent_ss`, `JSESSIONID`). Each cookie
 * is stored HOST-ONLY and a Domain attribute is ignored: the student's session
 * must never travel further than the host that issued it, and nothing here has
 * a reason to send it anywhere else. Any third host throws.
 *
 * Pure: no storage, no plugin. See docs/superpowers/specs/
 * 2026-10-13-isic-balance-topup-design.md.
 */
export const ISKAM_ORIGIN = 'https://webiskam.mendelu.cz';
export const ISKAM_HOST = 'webiskam.mendelu.cz';
export const IDP_HOST = 'alibaba.mendelu.cz';
export const ISKAM_COOKIE_URL = 'https://webiskam.mendelu.cz/';
/** With the path: alibaba scopes its cookies to /idp, and `/` returns none. */
export const IDP_COOKIE_URL = 'https://alibaba.mendelu.cz/idp/';
export const TICKET_COOKIE = '.ISKAMASPXAUTH';

export interface IskamCookie {
  name: string;
  value: string;
  host: string;
  path: string;
  /** Epoch ms, or null for a cookie the server issued without an expiry. */
  expires: number | null;
}
export type IskamJar = readonly IskamCookie[];

const ALLOWED_HOSTS = new Set([ISKAM_HOST, IDP_HOST]);

export function assertJarUrl(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error('reIS: refusing an unparseable WebISKAM URL');
  }
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) {
    throw new Error(`reIS: refusing to send WebISKAM cookies to ${u.origin}`);
  }
  return u;
}

/**
 * Both native layers hand JS one `Set-Cookie` string with the values joined by
 * ", " (Android `buildResponseHeaders`, iOS `allHeaderFields`). A split on
 * every comma would cut `Expires=Wed, 13 Oct 2027 …` in half, so only a comma
 * followed by `name=` starts a new cookie.
 */
export function splitSetCookie(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(/,\s*(?=[^;,=\s]+=)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function defaultPath(pathname: string): string {
  const i = pathname.lastIndexOf('/');
  return i <= 0 ? '/' : pathname.slice(0, i);
}

export function applySetCookies(
  jar: IskamJar,
  url: string,
  setCookies: readonly string[],
  now = Date.now()
): IskamJar {
  const u = assertJarUrl(url);
  let out = [...jar];
  for (const sc of setCookies) {
    const [pair = '', ...attrs] = sc.split(';');
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    let path = defaultPath(u.pathname);
    let expires: number | null = null;
    let maxAge: number | null = null;
    for (const a of attrs) {
      const i = a.indexOf('=');
      const key = (i < 0 ? a : a.slice(0, i)).trim().toLowerCase();
      const val = i < 0 ? '' : a.slice(i + 1).trim();
      if (key === 'path' && val.startsWith('/')) path = val;
      else if (key === 'expires') {
        const d = Date.parse(val);
        if (!Number.isNaN(d)) expires = d;
      } else if (key === 'max-age' && /^-?\d+$/.test(val)) maxAge = Number(val);
    }
    // Max-Age wins over Expires (RFC 6265 §5.3).
    if (maxAge !== null) expires = now + maxAge * 1000;
    out = out.filter((c) => !(c.name === name && c.host === u.hostname && c.path === path));
    const dead = value === '' || (expires !== null && expires <= now);
    if (!dead) out.push({ name, value, host: u.hostname, path, expires });
  }
  return out;
}

function pathMatches(cookiePath: string, requestPath: string): boolean {
  if (requestPath === cookiePath) return true;
  const prefix = cookiePath.endsWith('/') ? cookiePath : `${cookiePath}/`;
  return requestPath.startsWith(prefix);
}

export function cookiesFor(jar: IskamJar, url: string, now = Date.now()): IskamCookie[] {
  const u = assertJarUrl(url);
  return jar.filter(
    (c) =>
      c.host === u.hostname &&
      pathMatches(c.path, u.pathname) &&
      (c.expires === null || c.expires > now)
  );
}

export function cookieHeader(jar: IskamJar, url: string, now = Date.now()): string {
  return cookiesFor(jar, url, now)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

/** `InAppBrowser.getCookies` returns name → value only, so expiry is unknown. */
export function jarFromRecord(
  host: string,
  path: string,
  record: Record<string, string>
): IskamJar {
  return Object.entries(record)
    .filter(([, value]) => typeof value === 'string' && value !== '')
    .map(([name, value]) => ({ name, value, host, path, expires: null }));
}

export function isIskamCookie(v: unknown): v is IskamCookie {
  const c = v as Partial<IskamCookie> | null;
  return (
    !!c &&
    typeof c.name === 'string' &&
    typeof c.value === 'string' &&
    (c.host === ISKAM_HOST || c.host === IDP_HOST) &&
    typeof c.path === 'string' &&
    (c.expires === null || typeof c.expires === 'number')
  );
}

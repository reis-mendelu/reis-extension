import {
  applySetCookies,
  assertJarUrl,
  cookieHeader,
  cookiesFor,
  splitSetCookie,
  type IskamJar,
} from './iskamJar';

export interface NativeHttpResponse {
  status: number;
  headers?: Record<string, string>;
  data?: unknown;
}

export interface IskamHttpDeps {
  platform: 'ios' | 'android' | 'web';
  request(o: {
    url: string;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    data?: string;
    disableRedirects: true;
  }): Promise<NativeHttpResponse>;
  setCookie(o: { url: string; key: string; value: string; path: string }): Promise<void>;
}

export interface IskamResponse {
  url: string;
  status: number;
  location: string | null;
  setCookieNames: string[];
  body: string;
}

export interface HopOptions {
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
}

function header(h: Record<string, string> | undefined, name: string): string | undefined {
  if (!h) return undefined;
  const key = Object.keys(h).find((k) => k.toLowerCase() === name);
  return key === undefined ? undefined : h[key];
}

function bodyText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data === undefined || data === null) return '';
  return JSON.stringify(data);
}

/**
 * One request to WebISKAM or the IdP, redirects NOT followed.
 *
 * Redirects are ours to follow because the login crosses hosts, and each host
 * may only ever receive its own cookies — a native layer following them would
 * decide that for us. Expiry is a 302 to /Home/Index, so the status and the
 * Location are the signal, not a final URL.
 *
 * Cookie delivery is the split `api/capacitorTransport.ts` measured on device
 * for IS, and it is not to be unified: iOS needs the explicit header (seeding
 * alone 403'd); Android ignores a hand-set header and needs the native jar
 * seeded. The secure jar is the copy reIS keeps; the native stores also keep
 * what they see (Android's CookieHandler writes every response cookie into the
 * WebView jar, iOS URLSession into HTTPCookieStorage), which is why sign-out
 * clears them too (clearIskam). The header goes LAST so a caller cannot
 * replace it.
 */
export async function iskamHop(
  deps: IskamHttpDeps,
  jar: IskamJar,
  url: string,
  opts: HopOptions = {}
): Promise<{ res: IskamResponse; jar: IskamJar }> {
  assertJarUrl(url);
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = {
    ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    ...opts.headers,
  };
  delete headers.Cookie;
  if (deps.platform === 'android') {
    for (const c of cookiesFor(jar, url)) {
      await deps.setCookie({
        url: `https://${c.host}${c.path}`,
        key: c.name,
        value: c.value,
        path: c.path,
      });
    }
  } else {
    const cookie = cookieHeader(jar, url);
    if (cookie) headers.Cookie = cookie;
  }

  const raw = await deps.request({ url, method, headers, data: opts.body, disableRedirects: true });
  const setCookies = splitSetCookie(header(raw.headers, 'set-cookie'));
  const location = header(raw.headers, 'location');
  return {
    jar: applySetCookies(jar, url, setCookies),
    res: {
      url,
      status: raw.status,
      location: location ? new URL(location, url).toString() : null,
      setCookieNames: setCookies.map((s) => (s.split('=')[0] ?? '').trim()),
      body: bodyText(raw.data),
    },
  };
}

/** The real bindings. Lazy, so nothing outside the phone tree pulls them in. */
export async function buildIskamHttpDeps(): Promise<IskamHttpDeps> {
  const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');
  return {
    platform: Capacitor.getPlatform() as IskamHttpDeps['platform'],
    request: (o) => CapacitorHttp.request(o) as Promise<NativeHttpResponse>,
    setCookie: (o) => CapacitorCookies.setCookie(o),
  };
}

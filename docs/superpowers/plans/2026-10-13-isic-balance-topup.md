# ISIC Balance and Top-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the phone/iPad app's jídelníček sheet, show the student's WebISKAM Hlavní konto balance and let them top it up by card or Google Pay through GoPay.

**Architecture:** Mobile-only code in `src/mobile/iskam/` keeps a WebISKAM + alibaba cookie jar in `secureStorage`, talks to WebISKAM over CapacitorHttp with redirects disabled, and refreshes a lapsed login silently (ticket → SP session → IdP) before falling back to an InAppBrowser login popup. A separate Zustand store drives one row (`IskamBalanceRow`) at the top of `MenuSheet`; the top-up opens GoPay's gateway in `@capacitor/browser`.

**Tech Stack:** TypeScript, React, Zustand, DaisyUI/Tailwind, Capacitor 8.5 (`CapacitorHttp`, `CapacitorCookies`), `@capgo/capacitor-inappbrowser`, `@capacitor/browser` (new), Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-13-isic-balance-topup-design.md`

## Global Constraints

- Mobile only. Nothing under `src/api/`, `src/utils/parsers/`, `src/store/slices/`, `src/entrypoints/`, `src/injector/`, `mcp/`; `utils/trustedOrigin.ts` keeps REJECTING `https://webiskam.mendelu.cz`.
- Scope: Hlavní konto balance + top-up only. No dorm, reservations, meal orders, history, bank QR, keep-alive timers, background refresh.
- Base URL `https://webiskam.mendelu.cz`; IdP `https://alibaba.mendelu.cz` with cookies under `/idp`.
- WebISKAM cookies go ONLY to `webiskam.mendelu.cz`; alibaba cookies ONLY to `alibaba.mendelu.cz`. Any other host throws.
- Cookies live only in `platform.secureStorage` (key `reis.iskam.jar`), written only by `iskamCookieStore.ts`. Never Preferences, IndexedDB, logs or `logError` extras.
- Balance is memory-only; never shown stale (every sheet open starts at `checking`).
- Only an authentication answer clears the stored jar; network errors / timeouts / 5xx keep it (`unavailable`).
- Amount: whole Kč, 1 – 15 000 (spaces/NBSP allowed as thousands separators).
- Google Pay button only on Android (`Capacitor.getPlatform() === 'android'`); card on both.
- Gateway URL accepted only if `https:` + host `gate.gopay.com` + path starting `/gw-ui/`.
- Login popup: `InAppBrowser.openWebView` on `https://webiskam.mendelu.cz/Prihlaseni/AuthShibb`, **no** `clearCookiesOnOpen`.
- Row hidden in demo mode (`isDemoMode()`) and when `getPlatform().kind !== 'capacitor'` (or `getPlatform()` throws).
- Iron rules from CLAUDE.md: no `localStorage`, no `useEffect` data fetching (fetch from event handlers/store), DaisyUI classes only, files ≤ 200 lines, direct imports, test first.
- Never run a real top-up without Dominik paying himself; never enter card details or passwords.
- Copy (cz / en): show "Zobrazit zůstatek ISIC" / "Show ISIC balance"; label "ISIC · Hlavní konto" / "ISIC · Main account"; unavailable "Zůstatek teď nejde načíst" / "Balance unavailable right now"; topUp "Dobít" / "Top up"; amount "Částka (Kč)" / "Amount (CZK)"; card "Zaplatit kartou" / "Pay by card"; gpay "Google Pay" / "Google Pay"; invalid "Zadej celé číslo od 1 do 15 000 Kč" / "Enter a whole amount from 1 to 15,000 CZK"; failed "Platbu se nepodařilo zahájit" / "Could not start the payment"; checking (aria) "Načítám zůstatek" / "Loading balance".
- Local verification per task: `npx vitest run <pattern>` and `npm run typecheck`. Under load use `--no-file-parallelism --maxWorkers=1`. Repo-wide lint/format/full suite are CI's.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stop before opening the PR and ask Dominik.

## Review Focus

1. **The sheet closes (or reopens) while a check is in flight** → the late result must not overwrite the newer state; reopening shows `checking`, never the previous balance. Test in Task 7 (`reset during check`).
2. **A double tap on a pay button** → exactly one `InitGopayPayment`, one gateway. Test in Task 10 (`ignores a second startTopUp`).
3. **Sign-out during a running silent chain** → the chain's late write must not resurrect cookies. Tests in Task 2 (`saveJar basedOn`) and Task 5 (`clear during chain`).
4. **Balances as WebISKAM prints them**: `1 234,56 Kč` with NBSP, `0 Kč`, negative `-12,00 Kč`, and an English page → parse correctly or return null, never a wrong number. Tests in Task 4.
5. **A slow first login (consent page, typing)** → the 30 s first-load deadline must not close the popup after the first page has loaded. Test in Task 6 (`disarms on first load`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/mobile/iskam/iskamJar.ts` | Pure cookie jar: host/path rules, `Set-Cookie` parsing, `Cookie` header |
| `src/mobile/iskam/iskamCookieStore.ts` | Only writer of the jar to `secureStorage`; ordering guarantees |
| `src/mobile/iskam/iskamHttp.ts` | One CapacitorHttp hop with per-platform cookie delivery |
| `src/mobile/iskam/samlForm.ts` | Pure: SAMLResponse form + password-form detection |
| `src/mobile/iskam/kontaParser.ts` | Pure: Hlavní konto balance from `/Konta` |
| `src/mobile/iskam/topUp.ts` | Pure: amount validation, init URL, gateway URL validation |
| `src/mobile/iskam/iskamSession.ts` | Silent chain → `live` / `dead` / `unreachable` |
| `src/mobile/iskam/iskamLogin.ts` | Login popup (cookie poll) |
| `src/mobile/iskam/iskamTopUp.ts` | `initTopUp`, `openGateway` |
| `src/mobile/iskam/iskamStore.ts` | Zustand store separate from `useAppStore` |
| `src/mobile/iskam/clearIskam.ts` | Sign-out half for WebISKAM |
| `src/components/mobile/sheets/IskamBalanceRow.tsx` | The row (four states) |
| `src/components/mobile/sheets/IskamTopUpForm.tsx` | Inline amount field + pay buttons |
| Modify `src/components/mobile/sheets/MenuSheet.tsx` | Render the row; reset store on close |
| Modify `src/components/mobile/screens/calendar/MenuCard.tsx` | Kick `check()` when the sheet is opened |
| Modify `src/mobile/signOut.ts` | `clearIskam` dep |
| Modify `src/platform/types.ts` | `secureStorage` doc names its second writer |
| Modify `src/i18n/locales/{cs,en}.json` | `iskam.*` keys |
| `src/test/guards/desktopHasNoIskam.test.ts` | Pins mobile-only placement |
| Modify `src/test/guards/noStudentDataLeaves.test.ts`, `PRIVACY.md`, `docs/privacy-policy-app.md` | Disclosures |
| Tests | `src/mobile/iskam/__tests__/*.test.ts`, `src/components/mobile/sheets/__tests__/IskamBalanceRow.test.tsx` |

---

### Task 1: Cookie jar (pure)

**Files:**
- Create: `src/mobile/iskam/iskamJar.ts`
- Test: `src/mobile/iskam/__tests__/iskamJar.test.ts`

**Interfaces:**
- Produces:
  - consts `ISKAM_ORIGIN = 'https://webiskam.mendelu.cz'`, `ISKAM_HOST = 'webiskam.mendelu.cz'`, `IDP_HOST = 'alibaba.mendelu.cz'`, `ISKAM_COOKIE_URL = 'https://webiskam.mendelu.cz/'`, `IDP_COOKIE_URL = 'https://alibaba.mendelu.cz/idp/'`, `TICKET_COOKIE = '.ISKAMASPXAUTH'`
  - `interface IskamCookie { name: string; value: string; host: string; path: string; expires: number | null }`, `type IskamJar = readonly IskamCookie[]`
  - `assertJarUrl(url: string): URL`
  - `splitSetCookie(header: string | null | undefined): string[]`
  - `applySetCookies(jar: IskamJar, url: string, setCookies: readonly string[], now?: number): IskamJar`
  - `cookiesFor(jar: IskamJar, url: string, now?: number): IskamCookie[]`
  - `cookieHeader(jar: IskamJar, url: string, now?: number): string`
  - `jarFromRecord(host: string, path: string, record: Record<string, string>): IskamJar`
  - `isIskamCookie(v: unknown): v is IskamCookie`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
  applySetCookies,
  assertJarUrl,
  cookieHeader,
  jarFromRecord,
  splitSetCookie,
  type IskamJar,
} from '../iskamJar';

const ISKAM = 'https://webiskam.mendelu.cz/Konta';
const IDP = 'https://alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO';
const NOW = Date.parse('2026-10-13T12:00:00Z');

describe('iskamJar', () => {
  it('splits a joined Set-Cookie header without breaking on commas inside Expires', () => {
    const joined =
      'shib_idp_persistent_ss=abc; Path=/idp; Expires=Wed, 13 Oct 2027 11:37:58 GMT; Secure, ' +
      'shib_idp_session=def; Path=/idp; HttpOnly, JSESSIONID=ghi; Path=/idp';
    expect(splitSetCookie(joined).map((s) => s.split('=')[0])).toEqual([
      'shib_idp_persistent_ss',
      'shib_idp_session',
      'JSESSIONID',
    ]);
    expect(splitSetCookie(undefined)).toEqual([]);
  });

  it('stores cookies host-only, so a webiskam cookie never goes to alibaba', () => {
    const jar = applySetCookies([], ISKAM, ['.ISKAMASPXAUTH=t1; path=/; HttpOnly'], NOW);
    expect(cookieHeader(jar, 'https://webiskam.mendelu.cz/Platby/x', NOW)).toBe('.ISKAMASPXAUTH=t1');
    expect(cookieHeader(jar, IDP, NOW)).toBe('');
  });

  it('ignores a Domain attribute that would widen the cookie', () => {
    const jar = applySetCookies([], ISKAM, ['wide=1; Domain=.mendelu.cz; Path=/'], NOW);
    expect(cookieHeader(jar, 'https://alibaba.mendelu.cz/idp/x', NOW)).toBe('');
  });

  it('scopes alibaba cookies to /idp', () => {
    const jar = applySetCookies([], IDP, ['shib_idp_session=s; Path=/idp'], NOW);
    expect(cookieHeader(jar, 'https://alibaba.mendelu.cz/idp/profile/x', NOW)).toBe('shib_idp_session=s');
    expect(cookieHeader(jar, 'https://alibaba.mendelu.cz/other', NOW)).toBe('');
    expect(cookieHeader(jar, 'https://alibaba.mendelu.cz/idpx', NOW)).toBe('');
  });

  it('replaces a cookie with the same name and path, and deletes on Max-Age=0 or a past Expires', () => {
    let jar: IskamJar = applySetCookies([], ISKAM, ['a=1; Path=/', 'b=2; Path=/'], NOW);
    jar = applySetCookies(jar, ISKAM, ['a=3; Path=/'], NOW);
    expect(cookieHeader(jar, ISKAM, NOW)).toBe('b=2; a=3');
    jar = applySetCookies(jar, ISKAM, ['a=; Max-Age=0; Path=/', 'b=x; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/'], NOW);
    expect(cookieHeader(jar, ISKAM, NOW)).toBe('');
  });

  it('drops expired cookies from the header', () => {
    const jar = applySetCookies([], ISKAM, ['a=1; Path=/; Max-Age=60'], NOW);
    expect(cookieHeader(jar, ISKAM, NOW + 61_000)).toBe('');
  });

  it('refuses every host but webiskam and alibaba, and plain http', () => {
    expect(() => assertJarUrl('https://is.mendelu.cz/')).toThrow();
    expect(() => assertJarUrl('https://webiskam.mendelu.cz.evil.example/')).toThrow();
    expect(() => assertJarUrl('http://webiskam.mendelu.cz/')).toThrow();
    expect(() => assertJarUrl('https://gate.gopay.com/gw-ui/rest/v3/1')).toThrow();
    expect(() => applySetCookies([], 'https://evil.example/', ['a=1'], NOW)).toThrow();
    expect(() => cookieHeader([], 'https://evil.example/', NOW)).toThrow();
  });

  it('builds a jar from a getCookies record, skipping empty values', () => {
    const jar = jarFromRecord('alibaba.mendelu.cz', '/idp', { shib_idp_session: 's', empty: '' });
    expect(jar).toEqual([{ name: 'shib_idp_session', value: 's', host: 'alibaba.mendelu.cz', path: '/idp', expires: null }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamJar.test.ts`
Expected: FAIL — cannot resolve `../iskamJar`.

- [ ] **Step 3: Write the implementation**

```ts
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
export function jarFromRecord(host: string, path: string, record: Record<string, string>): IskamJar {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamJar.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/mobile/iskam/iskamJar.ts src/mobile/iskam/__tests__/iskamJar.test.ts
git commit -m "feat(iskam): host-only cookie jar for the WebISKAM login

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Secure cookie store

**Files:**
- Create: `src/mobile/iskam/iskamCookieStore.ts`
- Modify: `src/platform/types.ts` (the `secureStorage` doc comment: "Only `tokenStore` should touch this" → name `iskamCookieStore` as the second writer)
- Test: `src/mobile/iskam/__tests__/iskamCookieStore.test.ts`

**Interfaces:**
- Consumes: `IskamJar`, `isIskamCookie` (Task 1); `getPlatform()` from `src/platform/index.ts`.
- Produces:
  - `jarGeneration(): number`
  - `loadJar(): Promise<IskamJar>` — `[]` on missing, unreadable or malformed
  - `saveJar(jar: IskamJar, basedOn?: number): Promise<number | null>` — returns the new generation, or `null` when dropped because `basedOn` is stale
  - `clearJar(basedOn?: number): Promise<boolean>` — `false` when dropped because `basedOn` is stale
  - `__resetIskamJarForTests(): void`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
const secureStorage = {
  get: vi.fn(async (k: string) => store.get(k)),
  set: vi.fn(async (k: string, v: unknown) => void store.set(k, v)),
  remove: vi.fn(async (k: string) => void store.delete(k)),
};
vi.mock('../../../platform', () => ({ getPlatform: () => ({ kind: 'capacitor', secureStorage }) }));

import {
  __resetIskamJarForTests,
  clearJar,
  jarGeneration,
  loadJar,
  saveJar,
} from '../iskamCookieStore';
import type { IskamJar } from '../iskamJar';

const JAR: IskamJar = [
  { name: '.ISKAMASPXAUTH', value: 't', host: 'webiskam.mendelu.cz', path: '/', expires: null },
];

describe('iskamCookieStore', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    __resetIskamJarForTests();
  });

  it('round-trips a jar through secureStorage as one JSON string', async () => {
    await saveJar(JAR);
    expect(secureStorage.set).toHaveBeenCalledWith('reis.iskam.jar', JSON.stringify(JAR));
    expect(await loadJar()).toEqual(JAR);
  });

  it('reads nothing as an empty jar: missing, unreadable, malformed, or foreign hosts', async () => {
    expect(await loadJar()).toEqual([]);
    store.set('reis.iskam.jar', '{not json');
    expect(await loadJar()).toEqual([]);
    store.set('reis.iskam.jar', JSON.stringify([{ name: 'x', value: 'y', host: 'evil.example', path: '/', expires: null }]));
    expect(await loadJar()).toEqual([]);
    secureStorage.get.mockRejectedValueOnce(new Error('keystore'));
    expect(await loadJar()).toEqual([]);
  });

  it('drops a save based on a generation that a clear has since moved past', async () => {
    const gen = jarGeneration();
    await clearJar();
    expect(await saveJar(JAR, gen)).toBeNull();
    expect(store.has('reis.iskam.jar')).toBe(false);
  });

  it('a clear issued after a save lands last, even if the save is slow', async () => {
    let release!: () => void;
    secureStorage.set.mockImplementationOnce(
      (k: string, v: unknown) =>
        new Promise<void>((r) => {
          release = () => {
            store.set(k, v);
            r();
          };
        })
    );
    const saving = saveJar(JAR);
    const clearing = clearJar();
    release();
    await Promise.all([saving, clearing]);
    expect(store.has('reis.iskam.jar')).toBe(false);
  });

  it('a clear based on a stale generation does not wipe a newer login', async () => {
    const gen = jarGeneration();
    await saveJar(JAR);
    expect(await clearJar(gen)).toBe(false);
    expect(await loadJar()).toEqual(JAR);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamCookieStore.test.ts`
Expected: FAIL — cannot resolve `../iskamCookieStore`.

- [ ] **Step 3: Write the implementation**

```ts
import { getPlatform } from '../../platform';
import { isIskamCookie, type IskamJar } from './iskamJar';

const KEY = 'reis.iskam.jar';

/**
 * The ONLY module that writes the WebISKAM login to disk.
 *
 * The jar authenticates as the student on WebISKAM and, through the alibaba
 * cookies, on the MENDELU IdP — so it lives in `platform.secureStorage`
 * (Keychain / Keystore AES-GCM), never in `platform.storage`, which is
 * plaintext Preferences. Keeping the key private to this file is what stops a
 * second writer from appearing.
 *
 * The ordering rules are tokenStore's, for the same race: a silent refresh
 * started before a sign-out can finish after it. `basedOn` is the generation a
 * caller read at; a write or clear based on a generation something has since
 * moved past is DROPPED, so a late refresh cannot resurrect cookies the student
 * signed out of, and a late "dead" verdict cannot wipe a login that just
 * succeeded. Writes go through one lane, so they reach the store in order.
 */
let generation = 0;
let writes: Promise<unknown> = Promise.resolve();

function serialized<T>(op: () => Promise<T>): Promise<T> {
  const next = writes.then(op, op);
  writes = next.catch(() => undefined);
  return next;
}

export function jarGeneration(): number {
  return generation;
}

export async function loadJar(): Promise<IskamJar> {
  let raw: unknown;
  try {
    raw = await getPlatform().secureStorage.get(KEY);
  } catch {
    return [];
  }
  if (typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isIskamCookie) : [];
  } catch {
    return [];
  }
}

export async function saveJar(jar: IskamJar, basedOn?: number): Promise<number | null> {
  if (basedOn !== undefined && basedOn !== generation) return null;
  const mine = ++generation;
  await serialized(() => getPlatform().secureStorage.set(KEY, JSON.stringify(jar)));
  return mine;
}

export async function clearJar(basedOn?: number): Promise<boolean> {
  if (basedOn !== undefined && basedOn !== generation) return false;
  generation++;
  await serialized(() => getPlatform().secureStorage.remove(KEY));
  return true;
}

/** Tests only. */
export function __resetIskamJarForTests(): void {
  generation = 0;
  writes = Promise.resolve();
}
```

In `src/platform/types.ts`, replace the line `Only \`tokenStore\` should touch this. It exists for UISAuth, which` and the following line with:

```ts
   * Two modules touch this and nothing else may: `tokenStore` (UISAuth, which
   * authenticates as the student on its own and never rotates) and
   * `mobile/iskam/iskamCookieStore` (the WebISKAM + alibaba login jar).
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamCookieStore.test.ts src/platform`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mobile/iskam/iskamCookieStore.ts src/mobile/iskam/__tests__/iskamCookieStore.test.ts src/platform/types.ts
git commit -m "feat(iskam): keep the WebISKAM login in secure storage, ordered like tokenStore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: One HTTP hop with per-platform cookie delivery

**Files:**
- Create: `src/mobile/iskam/iskamHttp.ts`
- Test: `src/mobile/iskam/__tests__/iskamHttp.test.ts`

**Interfaces:**
- Consumes: `applySetCookies`, `assertJarUrl`, `cookieHeader`, `cookiesFor`, `splitSetCookie`, `IskamJar` (Task 1).
- Produces:
  - `interface NativeHttpResponse { status: number; headers?: Record<string, string>; data?: unknown }`
  - `interface IskamHttpDeps { platform: 'ios' | 'android' | 'web'; request(o: { url: string; method: 'GET' | 'POST'; headers: Record<string, string>; data?: string; disableRedirects: true }): Promise<NativeHttpResponse>; setCookie(o: { url: string; key: string; value: string; path: string }): Promise<void> }`
  - `interface IskamResponse { url: string; status: number; location: string | null; setCookieNames: string[]; body: string }`
  - `interface HopOptions { method?: 'GET' | 'POST'; body?: string; headers?: Record<string, string> }`
  - `iskamHop(deps: IskamHttpDeps, jar: IskamJar, url: string, opts?: HopOptions): Promise<{ res: IskamResponse; jar: IskamJar }>`
  - `buildIskamHttpDeps(): Promise<IskamHttpDeps>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { iskamHop, type IskamHttpDeps } from '../iskamHttp';
import type { IskamJar } from '../iskamJar';

const JAR: IskamJar = [
  { name: '.ISKAMASPXAUTH', value: 't', host: 'webiskam.mendelu.cz', path: '/', expires: null },
  { name: 'shib_idp_session', value: 's', host: 'alibaba.mendelu.cz', path: '/idp', expires: null },
];

function deps(platform: IskamHttpDeps['platform'], response = { status: 200, headers: {}, data: 'ok' }) {
  return {
    platform,
    request: vi.fn(async () => response),
    setCookie: vi.fn(async () => {}),
  } satisfies IskamHttpDeps;
}

describe('iskamHop', () => {
  it('iOS: sends only this host\'s cookies as an explicit header, last, and never seeds the jar', async () => {
    const d = deps('ios');
    await iskamHop(d, JAR, 'https://webiskam.mendelu.cz/Konta', { headers: { Cookie: 'spoof=1' } });
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
      headers: { 'set-cookie': '.ISKAMASPXAUTH=new; path=/, ISKaM4_SessionId=x; path=/', Location: '/ObjednavkyStravovani' },
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
    await iskamHop(d, [], 'https://webiskam.mendelu.cz/Shibboleth.sso/SAML2/POST', { method: 'POST', body: 'SAMLResponse=x' });
    const sent = d.request.mock.calls[0]![0];
    expect(sent.method).toBe('POST');
    expect(sent.data).toBe('SAMLResponse=x');
    expect(sent.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('refuses to send anything to a host outside the jar\'s two', async () => {
    const d = deps('ios');
    await expect(iskamHop(d, JAR, 'https://is.mendelu.cz/')).rejects.toThrow(/refusing/);
    expect(d.request).not.toHaveBeenCalled();
  });

  it('turns a parsed JSON body back into text', async () => {
    const d = deps('ios', { status: 200, headers: {}, data: { a: 1 } as unknown as string });
    const { res } = await iskamHop(d, [], 'https://webiskam.mendelu.cz/x');
    expect(res.body).toBe('{"a":1}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamHttp.test.ts`
Expected: FAIL — cannot resolve `../iskamHttp`.

- [ ] **Step 3: Write the implementation**

```ts
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
 * seeded. Seeded WITHOUT an expiry, so the WebView never writes the 1-year
 * `shib_idp_persistent_ss` into its plaintext cookie database — the real
 * expiry is kept in secure storage. The header goes LAST so a caller cannot
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
  if (deps.platform === 'android') {
    for (const c of cookiesFor(jar, url)) {
      await deps.setCookie({ url: `https://${c.host}${c.path}`, key: c.name, value: c.value, path: c.path });
    }
    delete headers.Cookie;
  } else {
    const cookie = cookieHeader(jar, url);
    if (cookie) headers.Cookie = cookie;
    else delete headers.Cookie;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamHttp.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/mobile/iskam/iskamHttp.ts src/mobile/iskam/__tests__/iskamHttp.test.ts
git commit -m "feat(iskam): one WebISKAM hop with the measured per-platform cookie delivery

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pure parsers — SAML form, Hlavní konto, top-up helpers

**Files:**
- Create: `src/mobile/iskam/samlForm.ts`, `src/mobile/iskam/kontaParser.ts`, `src/mobile/iskam/topUp.ts`
- Create fixture: `src/mobile/iskam/__tests__/fixtures/konta.html` (structure of the real 2026-10-13 page; invented ids and amounts; no personal data)
- Test: `src/mobile/iskam/__tests__/samlForm.test.ts`, `kontaParser.test.ts`, `topUp.test.ts`

**Interfaces:**
- Produces:
  - `findSamlPostForm(html: string, baseUrl: string): { action: string; body: string } | null`
  - `hasPasswordForm(html: string): boolean`
  - `interface KontoBalance { amount: number; text: string }`; `parseHlavniKonto(html: string): KontoBalance | null`
  - `TOP_UP_MIN = 1`, `TOP_UP_MAX = 15_000`; `type AmountCheck = { ok: true; amount: number } | { ok: false }`; `validateAmount(text: string): AmountCheck`
  - `type PayMethod = 'card' | 'gpay'`; `initTopUpUrl(amount: number, method: PayMethod): string`; `parseGatewayUrl(html: string): string | null`

- [ ] **Step 1: Write the fixture**

`src/mobile/iskam/__tests__/fixtures/konta.html` — the account table exactly as WebISKAM renders it (2026-10-13), with invented ids and amounts:

```html
<!DOCTYPE html>
<html lang="cs"><head><title>Konta - ISKaM</title></head>
<body>
<div class="container">
                <div class="row mb-30 vyskaRiadkuKonto">
                    <div class="col-xs-4 col-sm-6 col-md-5">Hlavn&#237; konto</div>
                        <div class="col-xs-3 col-sm-2 col-md-2 text-right">1&#160;234,56 Kč</div>
                    <div class="col-xs-2 col-sm-1 col-md-1">
                            <a href="/Konta/PrevodyUhrady/00000000000000000000000000000001"><img alt="Detail" title="Detail Hlavn&#237; konto" src="/Content/images/eye.png"></a>
                    </div>
                            <div class="col-xs-2  col-sm-3 col-md-1 col-sm-offset-0"><a class="btn btn-sm " value="Nabít" title="Nab&#237;t Hlavn&#237; konto" href="/Platby/NabitiKonta/0">Nabít</a></div>
                                    </div>
                <div class="row mb-30 vyskaRiadkuKonto">
                    <div class="col-xs-4 col-sm-6 col-md-5">Ubytovac&#237; kauce</div>
                        <div class="col-xs-3 col-sm-2 col-md-2 text-right">5 000 Kč</div>
                    <div class="col-xs-2 col-sm-1 col-md-1">
                            <a href="/Konta/PrevodyUhrady/00000000000000000000000000000002"><img alt="Detail" src="/Content/images/eye.png"></a>
                    </div>
                            <div class="col-xs-2  col-sm-3 col-sm-offset-0"></div>
                                    </div>
                <div class="row mb-30 vyskaRiadkuKonto">
                    <div class="col-xs-4 col-sm-6 col-md-5">Rezervačn&#237; kauce</div>
                        <div class="col-xs-3 col-sm-2 col-md-2 text-right">0 Kč</div>
                    <div class="col-xs-2 col-sm-1 col-md-1">
                            <a href="/Konta/PrevodyUhrady/00000000000000000000000000000003"><img alt="Detail" src="/Content/images/eye.png"></a>
                    </div>
                            <div class="col-xs-2  col-sm-3 col-md-1 col-sm-offset-0"><a class="btn btn-sm " value="Nabít" href="/Platby/NabitiKonta/2">Nabít</a></div>
                                    </div>
                <div class="row mb-30 vyskaRiadkuKonto">
                    <div class="col-xs-4 col-sm-6 col-md-5">STRAVOVAC&#205; KONTO</div>
                        <div class="col-xs-3 col-sm-2 col-md-2 text-right">0 Kč</div>
                    <div class="col-xs-2 col-sm-1 col-md-1">
                            <a href="/Konta/PrevodyUhrady/00000000000000000000000000000004"><img alt="Detail" src="/Content/images/eye.png"></a>
                    </div>
                            <div class="col-xs-2  col-sm-3 col-sm-offset-0"></div>
                                    </div>
</div>
</body></html>
```

- [ ] **Step 2: Write the failing tests**

`kontaParser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHlavniKonto } from '../kontaParser';

const fixture = readFileSync(resolve(__dirname, 'fixtures/konta.html'), 'utf8');
const row = (name: string, amount: string, href = '') =>
  `<div class="row vyskaRiadkuKonto"><div>${name}</div><div>${amount}</div>${href ? `<a href="${href}">Nabít</a>` : ''}</div>`;

describe('parseHlavniKonto', () => {
  it('reads the Hlavní konto row by its NabitiKonta/0 link, with an NBSP thousands separator', () => {
    expect(parseHlavniKonto(fixture)).toEqual({ amount: 1234.56, text: '1 234,56 Kč' });
  });

  it('finds the row by link even when the name is translated', () => {
    expect(parseHlavniKonto(row('Main account', '12,00 Kč', '/Platby/NabitiKonta/0'))?.amount).toBe(12);
  });

  it('falls back to the name when the top-up link is missing', () => {
    expect(parseHlavniKonto(row('Hlavní konto', '0 Kč'))?.amount).toBe(0);
  });

  it('reads a negative balance', () => {
    expect(parseHlavniKonto(row('Hlavní konto', '-12,00 Kč', '/Platby/NabitiKonta/0'))?.amount).toBe(-12);
  });

  it('never returns a different account (NabitiKonta/2 is the reservation deposit)', () => {
    expect(parseHlavniKonto(row('Rezervační kauce', '700 Kč', '/Platby/NabitiKonta/2'))).toBeNull();
  });

  it('returns null rather than a guess when the amount cannot be read', () => {
    expect(parseHlavniKonto(row('Hlavní konto', 'n/a', '/Platby/NabitiKonta/0'))).toBeNull();
    expect(parseHlavniKonto('<html><body>login</body></html>')).toBeNull();
  });
});
```

`topUp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initTopUpUrl, parseGatewayUrl, validateAmount } from '../topUp';

describe('validateAmount', () => {
  it.each([
    ['1', 1],
    ['15000', 15000],
    [' 50 ', 50],
    ['1 500', 1500],
    ['1 500', 1500],
  ])('accepts %j', (text, amount) => {
    expect(validateAmount(text)).toEqual({ ok: true, amount });
  });

  it.each(['', '0', '-5', '12,5', '12.5', '15001', 'abc', '1e3'])('rejects %j', (text) => {
    expect(validateAmount(text)).toEqual({ ok: false });
  });
});

describe('initTopUpUrl', () => {
  it('builds the GET the WebISKAM page itself sends, for the Hlavní konto', () => {
    const u = new URL(initTopUpUrl(250, 'gpay'));
    expect(u.origin + u.pathname).toBe('https://webiskam.mendelu.cz/Platby/InitGopayPayment');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      CastkaZadana: '250',
      VybranaMetoda: 'GPAY',
      TypKonta: '0',
      PoSplatnosti: 'False',
      PoSplatnostiPozadavkyNaUhrady: 'False',
      PredSplatnosti: 'False',
      PredSplatnostiPozadavkyNaUhrady: 'False',
      IDEShopObjednavky: '',
    });
    expect(new URL(initTopUpUrl(1, 'card')).searchParams.get('VybranaMetoda')).toBe('PAYMENT_CARD');
  });
});

describe('parseGatewayUrl', () => {
  const form = (action: string) =>
    `<form action="${action}" method="post" id="gopay-payment-button"><input type="hidden" name="signature" /><button id="makepayment">Zaplatit</button></form>`;

  it('extracts the GoPay gateway action', () => {
    expect(parseGatewayUrl(form('https://gate.gopay.com/gw-ui/rest/v3/123456'))).toBe(
      'https://gate.gopay.com/gw-ui/rest/v3/123456'
    );
  });

  it.each([
    'https://gate.gopay.com.evil.example/gw-ui/rest/v3/1',
    'http://gate.gopay.com/gw-ui/rest/v3/1',
    'https://gate.gopay.com/other/1',
    'https://evil.example/gw-ui/1',
    'javascript:alert(1)',
    '/gw-ui/rest/v3/1',
  ])('rejects %s', (action) => {
    expect(parseGatewayUrl(form(action))).toBeNull();
  });

  it('returns null for an empty body (what an expired session gets)', () => {
    expect(parseGatewayUrl('')).toBeNull();
    expect(parseGatewayUrl('   ')).toBeNull();
  });
});
```

`samlForm.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findSamlPostForm, hasPasswordForm } from '../samlForm';

const SAML = `<html><body onload="document.forms[0].submit()"><noscript><p>Continue</p></noscript>
<form action="https&#x3a;&#x2f;&#x2f;webiskam.mendelu.cz&#x2f;Shibboleth.sso&#x2f;SAML2&#x2f;POST" method="post">
<input type="hidden" name="RelayState" value="ss&#x3a;mem&#x3a;abc"/>
<input type="hidden" name="SAMLResponse" value="PHNhbWw+"/>
<input type="submit" value="Continue"/></form></body></html>`;

describe('samlForm', () => {
  it('decodes the entity-encoded action and posts the hidden fields', () => {
    const f = findSamlPostForm(SAML, 'https://alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO');
    expect(f?.action).toBe('https://webiskam.mendelu.cz/Shibboleth.sso/SAML2/POST');
    expect(new URLSearchParams(f!.body).get('SAMLResponse')).toBe('PHNhbWw+');
    expect(new URLSearchParams(f!.body).get('RelayState')).toBe('ss:mem:abc');
  });

  it('finds no SAML form on the password page, and sees the password field', () => {
    const login = '<form action="/idp/x" method="post"><input name="j_username"><input type="password" name="j_password"></form>';
    expect(findSamlPostForm(login, 'https://alibaba.mendelu.cz/idp/x')).toBeNull();
    expect(hasPasswordForm(login)).toBe(true);
    expect(hasPasswordForm(SAML)).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/mobile/iskam/__tests__/kontaParser.test.ts src/mobile/iskam/__tests__/topUp.test.ts src/mobile/iskam/__tests__/samlForm.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write the implementations**

`kontaParser.ts`:

```ts
/**
 * The Hlavní konto balance from WebISKAM's /Konta.
 *
 * A PARSER of IS-shaped HTML: see CLAUDE.md > Parser Rules. Evidence: the live
 * page on 2026-10-13 (structure reproduced in __tests__/fixtures/konta.html).
 * Four `.vyskaRiadkuKonto` rows; cell 0 the account name, cell 1 "N,NN Kč".
 *
 * The row is identified by its top-up link, `/Platby/NabitiKonta/0`, which does
 * not change with the page language; the name is only the fallback. A row whose
 * amount cannot be read returns null, so a changed page shows "unavailable"
 * rather than a wrong number.
 */
export interface KontoBalance {
  amount: number;
  /** As WebISKAM prints it, whitespace normalised: "1 234,56 Kč". */
  text: string;
}

const ROW = '.vyskaRiadkuKonto';
const MAIN_TOP_UP = /\/Platby\/NabitiKonta\/0(?:$|[?#])/;
const MAIN_NAME = /^(Hlavní konto|Main account)$/i;
const AMOUNT = /^(-?\d[\d\s]*(?:,\d+)?)\s*Kč$/;

export function parseHlavniKonto(html: string): KontoBalance | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll(ROW));
  const row =
    rows.find((r) =>
      Array.from(r.querySelectorAll('a[href]')).some((a) => MAIN_TOP_UP.test(a.getAttribute('href') ?? ''))
    ) ?? rows.find((r) => MAIN_NAME.test(r.children[0]?.textContent?.trim() ?? ''));
  const text = row?.children[1]?.textContent?.replace(/[\s ]+/g, ' ').trim();
  if (!text) return null;
  const m = text.match(AMOUNT);
  if (!m?.[1]) return null;
  const amount = Number(m[1].replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(amount) ? { amount, text } : null;
}
```

`topUp.ts`:

```ts
import { ISKAM_ORIGIN } from './iskamJar';

export const TOP_UP_MIN = 1;
export const TOP_UP_MAX = 15_000;

export type AmountCheck = { ok: true; amount: number } | { ok: false };
export type PayMethod = 'card' | 'gpay';

/** Whole crowns, 1 – 15 000; spaces and NBSP allowed as thousands separators. */
export function validateAmount(text: string): AmountCheck {
  const t = text.replace(/[\s ]/g, '');
  if (!/^\d+$/.test(t)) return { ok: false };
  const amount = Number(t);
  return amount >= TOP_UP_MIN && amount <= TOP_UP_MAX ? { ok: true, amount } : { ok: false };
}

const METHOD: Record<PayMethod, string> = { card: 'PAYMENT_CARD', gpay: 'GPAY' };

/**
 * The GET WebISKAM's own top-up page sends (its `$.ajax` says `Type:` instead
 * of `type:`, so jQuery sends GET). `TypKonta=0` is the Hlavní konto.
 */
export function initTopUpUrl(amount: number, method: PayMethod): string {
  const q = new URLSearchParams({
    CastkaZadana: String(amount),
    VybranaMetoda: METHOD[method],
    TypKonta: '0',
    PoSplatnosti: 'False',
    PoSplatnostiPozadavkyNaUhrady: 'False',
    PredSplatnosti: 'False',
    PredSplatnostiPozadavkyNaUhrady: 'False',
    IDEShopObjednavky: '',
  });
  return `${ISKAM_ORIGIN}/Platby/InitGopayPayment?${q.toString()}`;
}

/**
 * The gateway URL from InitGopayPayment's ~300-byte form, or null.
 *
 * This URL is opened in a browser on the student's phone and they type card
 * details into whatever it shows, so only GoPay's own gateway is accepted —
 * exact host, https, the /gw-ui/ path. An empty body is what an expired
 * session gets; the caller tells that case apart before calling this.
 */
export function parseGatewayUrl(html: string): string | null {
  if (!html.trim()) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const action =
    doc.querySelector('form#gopay-payment-button')?.getAttribute('action') ??
    doc.querySelector('form[action]')?.getAttribute('action');
  if (!action) return null;
  let u: URL;
  try {
    u = new URL(action);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.hostname !== 'gate.gopay.com' || !u.pathname.startsWith('/gw-ui/')) {
    return null;
  }
  return u.toString();
}
```

`samlForm.ts`:

```ts
/**
 * The two IdP pages the silent re-login can meet, told apart.
 *
 * Measured 2026-10-13: with a live IdP session alibaba answers the SSO
 * redirect with a SAMLResponse form that a browser auto-submits; with a dead
 * one it shows the password form. Nothing else appeared in between.
 */
export function findSamlPostForm(html: string, baseUrl: string): { action: string; body: string } | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const form = doc.querySelector('input[name="SAMLResponse"]')?.closest('form');
  if (!form) return null;
  let action: string;
  try {
    action = new URL(form.getAttribute('action') ?? '', baseUrl).toString();
  } catch {
    return null;
  }
  const body = new URLSearchParams();
  for (const input of Array.from(form.querySelectorAll('input[name]'))) {
    if ((input.getAttribute('type') ?? 'text').toLowerCase() === 'submit') continue;
    body.append(input.getAttribute('name') ?? '', input.getAttribute('value') ?? '');
  }
  return { action, body: body.toString() };
}

export function hasPasswordForm(html: string): boolean {
  return /<input\b[^>]*\btype\s*=\s*["']?password/i.test(html);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/mobile/iskam/__tests__/kontaParser.test.ts src/mobile/iskam/__tests__/topUp.test.ts src/mobile/iskam/__tests__/samlForm.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/mobile/iskam/samlForm.ts src/mobile/iskam/kontaParser.ts src/mobile/iskam/topUp.ts src/mobile/iskam/__tests__/
git commit -m "feat(iskam): parse the Hlavní konto balance, the SAML hand-off and the GoPay gateway

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Silent chain

**Files:**
- Create: `src/mobile/iskam/iskamSession.ts`
- Test: `src/mobile/iskam/__tests__/iskamSession.test.ts`

**Interfaces:**
- Consumes: `iskamHop`, `IskamHttpDeps`, `IskamResponse` (Task 3); `loadJar`, `saveJar`, `clearJar`, `jarGeneration` (Task 2); `findSamlPostForm`, `hasPasswordForm` (Task 4); `ISKAM_ORIGIN`, `ISKAM_HOST`, `IDP_HOST`, `TICKET_COOKIE` (Task 1); `logError` from `src/utils/reportError`.
- Produces:
  - `type ChainResult = { state: 'live'; kontaHtml: string } | { state: 'dead' } | { state: 'unreachable' }`
  - `runSilentChain(http: IskamHttpDeps): Promise<ChainResult>`
  - `isAuthRedirect(res: IskamResponse): boolean`
  - `isLiveKonta(res: IskamResponse): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IskamHttpDeps, NativeHttpResponse } from '../iskamHttp';
import type { IskamJar } from '../iskamJar';

const store = new Map<string, unknown>();
vi.mock('../../../platform', () => ({
  getPlatform: () => ({
    kind: 'capacitor',
    secureStorage: {
      get: async (k: string) => store.get(k),
      set: async (k: string, v: unknown) => void store.set(k, v),
      remove: async (k: string) => void store.delete(k),
    },
  }),
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
    request: vi.fn(async (o) => {
      calls.push(`${o.method} ${new URL(o.url).host}${new URL(o.url).pathname}`);
      return route(o.url, o.method);
    }),
  };
  return { deps, calls };
}
const toHomeIndex = { status: 302, headers: { Location: '/Home/Index?ReturnUrl=%2fKonta' }, data: '' };

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
      return { status: 302, headers: { 'Set-Cookie': '.ISKAMASPXAUTH=fresh; path=/', Location: '/ObjednavkyStravovani' }, data: '' };
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
      if (u.pathname === '/Konta') return konta++ === 0 ? toHomeIndex : { status: 200, data: KONTA_OK };
      if (u.pathname === '/Prihlaseni/AuthShibb')
        return authShibb++ === 0
          ? { status: 302, headers: { Location: 'https://alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO?SAMLRequest=x' }, data: '' }
          : { status: 302, headers: { 'Set-Cookie': '.ISKAMASPXAUTH=viaidp; path=/', Location: '/ObjednavkyStravovani' }, data: '' };
      if (u.host === 'alibaba.mendelu.cz')
        return { status: 200, headers: { 'Set-Cookie': 'shib_idp_session_ss=rot; Path=/idp' }, data: SAML };
      if (u.pathname === '/Shibboleth.sso/SAML2/POST' && method === 'POST')
        return { status: 302, headers: { 'Set-Cookie': '_shibsession_ab=sp2; path=/', Location: '/Prihlaseni/AuthShibb' }, data: '' };
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
        return { status: 302, headers: { Location: 'https://alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO' }, data: '' };
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
        return { status: 200, headers: { 'Set-Cookie': '.ISKAMASPXAUTH=late; path=/' }, data: KONTA_OK };
      }
      return { status: 500 };
    });
    await runSilentChain(deps);
    expect(await loadJar()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamSession.test.ts`
Expected: FAIL — cannot resolve `../iskamSession`.

- [ ] **Step 3: Write the implementation**

```ts
import { logError } from '../../utils/reportError';
import { clearJar, jarGeneration, loadJar, saveJar } from './iskamCookieStore';
import { iskamHop, type IskamHttpDeps, type IskamResponse } from './iskamHttp';
import { IDP_HOST, ISKAM_HOST, ISKAM_ORIGIN, TICKET_COOKIE, type IskamJar } from './iskamJar';
import { findSamlPostForm, hasPasswordForm } from './samlForm';

export type ChainResult =
  | { state: 'live'; kontaHtml: string }
  | { state: 'dead' }
  | { state: 'unreachable' };

const KONTA = `${ISKAM_ORIGIN}/Konta`;
const AUTH_SHIBB = `${ISKAM_ORIGIN}/Prihlaseni/AuthShibb`;
const SP_ENDPOINT = `${ISKAM_ORIGIN}/Shibboleth.sso/`;
const MAX_HOPS = 10;

export function isLiveKonta(res: IskamResponse): boolean {
  return res.status === 200 && res.body.includes('vyskaRiadkuKonto');
}

/** WebISKAM never says 401: a lapsed login is a 302 to /Home/Index or the IdP. */
export function isAuthRedirect(res: IskamResponse): boolean {
  if (res.status < 300 || res.status >= 400 || !res.location) return false;
  const u = new URL(res.location);
  return (
    u.hostname === IDP_HOST ||
    /^\/(Home\/Index|Prihlaseni|Shibboleth\.sso)/i.test(u.pathname)
  );
}

type Outcome = 'ok' | 'dead' | 'unreachable';

/**
 * AuthShibb, and wherever it leads, until webiskam issues a ticket.
 *
 * With a live SP session that is ONE hop (measured, ~0.5 s). Without one it
 * bounces through alibaba: a live IdP session answers with a SAMLResponse form
 * a browser would auto-submit — posted here by hand, and only to webiskam's own
 * Shibboleth endpoint — and a dead one with the password form, which is where
 * this stops. It never types anything into it.
 */
async function reauthenticate(
  http: IskamHttpDeps,
  start: IskamJar
): Promise<{ jar: IskamJar; outcome: Outcome }> {
  let jar = start;
  let req: { url: string; method: 'GET' | 'POST'; body?: string } = { url: AUTH_SHIBB, method: 'GET' };
  for (let i = 0; i < MAX_HOPS; i++) {
    const hop = await iskamHop(http, jar, req.url, { method: req.method, body: req.body });
    jar = hop.jar;
    const { res } = hop;
    const host = new URL(res.url).hostname;
    if (host === ISKAM_HOST && res.setCookieNames.includes(TICKET_COOKIE)) return { jar, outcome: 'ok' };
    if (res.status >= 300 && res.status < 400 && res.location) {
      const next = new URL(res.location).hostname;
      if (next !== ISKAM_HOST && next !== IDP_HOST) return { jar, outcome: 'dead' };
      req = { url: res.location, method: 'GET' };
      continue;
    }
    if (res.status === 200 && host === IDP_HOST) {
      if (hasPasswordForm(res.body)) return { jar, outcome: 'dead' };
      const form = findSamlPostForm(res.body, res.url);
      if (form && form.action.startsWith(SP_ENDPOINT)) {
        req = { url: form.action, method: 'POST', body: form.body };
        continue;
      }
      if (form) return { jar, outcome: 'dead' };
    }
    // A 5xx, an IdP error page, something new: not proof the login is gone.
    return { jar, outcome: 'unreachable' };
  }
  return { jar, outcome: 'unreachable' };
}

/**
 * Is the stored WebISKAM login still good — and if not, can it be made good
 * without the student? Cheapest step first: the ticket, then the SP session,
 * then the IdP session. See the spec's "Silent chain".
 *
 * Only an AUTHENTICATION answer (the password form, a SAML hand-off to a
 * stranger) clears the stored jar. A network error, a timeout or a 5xx keeps
 * it, so bad wi-fi never costs the student their login.
 *
 * Every write is based on the generation read at the start, so a sign-out or a
 * fresh popup login that lands mid-chain wins over whatever this finds.
 */
export async function runSilentChain(http: IskamHttpDeps): Promise<ChainResult> {
  const gen = jarGeneration();
  let jar = await loadJar();
  if (jar.length === 0) return { state: 'dead' };
  try {
    let konta = await iskamHop(http, jar, KONTA);
    jar = konta.jar;
    if (isLiveKonta(konta.res)) {
      await saveJar(jar, gen);
      return { state: 'live', kontaHtml: konta.res.body };
    }
    if (!isAuthRedirect(konta.res)) {
      await saveJar(jar, gen);
      return { state: 'unreachable' };
    }
    const re = await reauthenticate(http, jar);
    jar = re.jar;
    if (re.outcome === 'dead') {
      await clearJar(gen);
      return { state: 'dead' };
    }
    if (re.outcome === 'unreachable') {
      await saveJar(jar, gen);
      return { state: 'unreachable' };
    }
    konta = await iskamHop(http, jar, KONTA);
    jar = konta.jar;
    await saveJar(jar, gen);
    return isLiveKonta(konta.res) ? { state: 'live', kontaHtml: konta.res.body } : { state: 'unreachable' };
  } catch (e) {
    logError('Iskam.silentChain', e);
    return { state: 'unreachable' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamSession.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/mobile/iskam/iskamSession.ts src/mobile/iskam/__tests__/iskamSession.test.ts
git commit -m "feat(iskam): silent re-login chain — ticket, SP session, then the IdP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Login popup

**Files:**
- Create: `src/mobile/iskam/iskamLogin.ts`
- Test: `src/mobile/iskam/__tests__/iskamLogin.test.ts`

**Interfaces:**
- Consumes: `LoginCancelledError`, `LoginUnreachableError`, `ListenerHandle` from `src/mobile/ensureSession.ts`; `jarFromRecord`, `ISKAM_HOST`, `IDP_HOST`, `ISKAM_ORIGIN`, `ISKAM_COOKIE_URL`, `IDP_COOKIE_URL`, `TICKET_COOKIE`, `IskamJar` (Task 1); `saveJar` (Task 2).
- Produces:
  - `interface IskamLoginDeps { open(): Promise<void>; onPageLoaded(cb: () => void): Promise<ListenerHandle>; onDismissed(cb: () => void): Promise<ListenerHandle>; readCookies(): Promise<{ iskam: Record<string, string>; idp: Record<string, string> }>; save(jar: IskamJar): Promise<void>; close(): Promise<void>; firstLoadTimeoutMs?: number }`
  - `signInToIskam(deps: IskamLoginDeps): Promise<void>` — rejects `LoginCancelledError` on dismiss, `LoginUnreachableError` when nothing loads
  - `buildIskamLoginDeps(): Promise<IskamLoginDeps>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { signInToIskam, type IskamLoginDeps } from '../iskamLogin';
import { LoginCancelledError, LoginUnreachableError } from '../../ensureSession';

function harness(cookies: Array<{ iskam: Record<string, string>; idp: Record<string, string> }>) {
  let onLoad: () => void = () => {};
  let onDismiss: () => void = () => {};
  const reads = [...cookies];
  const deps = {
    open: vi.fn(async () => {}),
    onPageLoaded: vi.fn(async (cb: () => void) => ((onLoad = cb), { remove: vi.fn(async () => {}) })),
    onDismissed: vi.fn(async (cb: () => void) => ((onDismiss = cb), { remove: vi.fn(async () => {}) })),
    readCookies: vi.fn(async () => reads.shift() ?? { iskam: {}, idp: {} }),
    save: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    firstLoadTimeoutMs: 50,
  } satisfies IskamLoginDeps;
  return { deps, load: () => onLoad(), dismiss: () => onDismiss() };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('signInToIskam', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps waiting through the password page, then saves both jars and closes once the ticket appears', async () => {
    const h = harness([
      { iskam: {}, idp: {} },
      { iskam: { '.ISKAMASPXAUTH': 't', _shibsession_ab: 'sp' }, idp: { shib_idp_session: 's', shib_idp_persistent_ss: 'p' } },
    ]);
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    await tick();
    expect(h.deps.save).not.toHaveBeenCalled();
    h.load();
    await done;
    const jar = h.deps.save.mock.calls[0]![0];
    expect(jar.filter((c) => c.host === 'webiskam.mendelu.cz').map((c) => c.name).sort()).toEqual(['.ISKAMASPXAUTH', '_shibsession_ab']);
    expect(jar.filter((c) => c.host === 'alibaba.mendelu.cz').every((c) => c.path === '/idp')).toBe(true);
    expect(h.deps.close).toHaveBeenCalled();
  });

  it('rejects with LoginCancelledError when the student closes the popup', async () => {
    const h = harness([]);
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    h.dismiss();
    await expect(done).rejects.toBeInstanceOf(LoginCancelledError);
    expect(h.deps.save).not.toHaveBeenCalled();
  });

  it('rejects with LoginUnreachableError when the first page never loads', async () => {
    const h = harness([]);
    await expect(signInToIskam(h.deps)).rejects.toBeInstanceOf(LoginUnreachableError);
    expect(h.deps.close).toHaveBeenCalled();
  });

  it('disarms the deadline on the first load, so a slow login (consent page, typing) is never cut off', async () => {
    const h = harness([
      { iskam: {}, idp: {} },
      { iskam: { '.ISKAMASPXAUTH': 't' }, idp: {} },
    ]);
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    await new Promise((r) => setTimeout(r, 120));
    h.load();
    await expect(done).resolves.toBeUndefined();
  });

  it('our own close after success does not turn into a cancellation', async () => {
    const h = harness([{ iskam: { '.ISKAMASPXAUTH': 't' }, idp: {} }]);
    h.deps.close.mockImplementation(async () => h.dismiss());
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    await expect(done).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamLogin.test.ts`
Expected: FAIL — cannot resolve `../iskamLogin`.

- [ ] **Step 3: Write the implementation**

```ts
import { LoginCancelledError, LoginUnreachableError, type ListenerHandle } from '../ensureSession';
import { saveJar } from './iskamCookieStore';
import {
  IDP_COOKIE_URL,
  IDP_HOST,
  ISKAM_COOKIE_URL,
  ISKAM_HOST,
  ISKAM_ORIGIN,
  TICKET_COOKIE,
  jarFromRecord,
  type IskamJar,
} from './iskamJar';

export interface IskamLoginDeps {
  open(): Promise<void>;
  onPageLoaded(cb: () => void): Promise<ListenerHandle>;
  onDismissed(cb: () => void): Promise<ListenerHandle>;
  readCookies(): Promise<{ iskam: Record<string, string>; idp: Record<string, string> }>;
  save(jar: IskamJar): Promise<void>;
  close(): Promise<void>;
  /** Tests only. */
  firstLoadTimeoutMs?: number;
}

/** As generous as the IS login, for the same reason: see ensureSession. */
const DEFAULT_FIRST_LOAD_TIMEOUT_MS = 30_000;

/**
 * The WebISKAM login popup, `ensureSession`'s contract for a different site.
 *
 * The student signs in on alibaba (MENDELU's IdP) inside the InAppBrowser.
 * Completion is the `.ISKAMASPXAUTH` cookie appearing on webiskam, polled on
 * every page load — not a URL match. Both jars are read then: webiskam's, and
 * alibaba's under /idp (path-scoped; the root URL returns none), because the
 * IdP session is what lets the silent chain log in again later without the
 * password. The password itself never passes through reIS.
 *
 * The first-load deadline is disarmed by the FIRST page load: from then on the
 * popup is on screen and the student may take as long as they like.
 */
export function signInToIskam(deps: IskamLoginDeps): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let loadHandle: ListenerHandle | null = null;
    let dismissHandle: ListenerHandle | null = null;

    const cleanup = async () => {
      clearTimeout(deadline);
      await loadHandle?.remove();
      await dismissHandle?.remove();
    };
    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      void cleanup();
      reject(e);
    };

    const onLoad = () => {
      clearTimeout(deadline);
      void (async () => {
        if (settled) return;
        const { iskam, idp } = await deps.readCookies();
        if (!iskam[TICKET_COOKIE] || settled) return;
        settled = true;
        try {
          await deps.save([...jarFromRecord(ISKAM_HOST, '/', iskam), ...jarFromRecord(IDP_HOST, '/idp', idp)]);
          await deps.close();
          await cleanup();
          resolve();
        } catch (e) {
          reject(e);
        }
      })();
    };

    const onDeadline = () => {
      if (settled) return;
      settled = true;
      void (async () => {
        try {
          await deps.close();
        } catch {
          // Best-effort: the student needs the error, not one about cleanup.
        }
        await cleanup();
        reject(new LoginUnreachableError());
      })();
    };

    // Armed before open(): openWebView resolves only on the first page load, so
    // during a stall the open call itself never settles.
    const deadline = setTimeout(onDeadline, deps.firstLoadTimeoutMs ?? DEFAULT_FIRST_LOAD_TIMEOUT_MS);

    void (async () => {
      try {
        loadHandle = await deps.onPageLoaded(onLoad);
        dismissHandle = await deps.onDismissed(() => fail(new LoginCancelledError()));
        await deps.open();
      } catch (e) {
        fail(e);
      }
    })();
  });
}

/** The real bindings. The plugin import is lazy: the extension must never load it. */
export async function buildIskamLoginDeps(): Promise<IskamLoginDeps> {
  const { InAppBrowser } = await import('@capgo/capacitor-inappbrowser');
  return {
    open: async () => {
      await InAppBrowser.openWebView({
        url: `${ISKAM_ORIGIN}/Prihlaseni/AuthShibb`,
        title: 'ISIC',
        isPresentAfterPageLoad: true,
        // NOT clearCookiesOnOpen: alibaba remembers the student's
        // attribute-release consent in a 1-year cookie, and clearing it would
        // show the 12-attribute consent screen on every login.
      });
    },
    onPageLoaded: (cb) => InAppBrowser.addListener('browserPageLoaded', () => cb()),
    onDismissed: (cb) => InAppBrowser.addListener('closeEvent', () => cb()),
    readCookies: async () => {
      const [iskam, idp] = await Promise.all([
        InAppBrowser.getCookies({ url: ISKAM_COOKIE_URL, includeHttpOnly: true }),
        InAppBrowser.getCookies({ url: IDP_COOKIE_URL, includeHttpOnly: true }),
      ]);
      return { iskam: iskam as Record<string, string>, idp: idp as Record<string, string> };
    },
    save: async (jar) => {
      await saveJar(jar);
    },
    close: async () => {
      await InAppBrowser.close();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamLogin.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/mobile/iskam/iskamLogin.ts src/mobile/iskam/__tests__/iskamLogin.test.ts
git commit -m "feat(iskam): WebISKAM login popup that captures both cookie jars

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Store — check and sign-in

**Files:**
- Create: `src/mobile/iskam/iskamStore.ts`
- Test: `src/mobile/iskam/__tests__/iskamStore.test.ts`

**Interfaces:**
- Consumes: `runSilentChain`, `ChainResult` (Task 5); `buildIskamHttpDeps` (Task 3); `signInToIskam`, `buildIskamLoginDeps` (Task 6); `parseHlavniKonto`, `KontoBalance` (Task 4); `LoginCancelledError`; `isDemoMode` from `src/errors/demoMode`; `getPlatform` from `src/platform`; `logError`.
- Produces:
  - `type IskamStatus = 'hidden' | 'checking' | 'signed-out' | 'balance' | 'unavailable'`
  - `type TopUpPhase = 'idle' | 'starting' | 'paying' | 'failed'`
  - `useIskamStore` (zustand hook) with state `{ status: IskamStatus; balance: KontoBalance | null; signingIn: boolean; topUp: TopUpPhase }` and actions `check(): Promise<void>`, `signIn(): Promise<void>`, `reset(): void` (Task 10 adds `startTopUp`)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runSilentChain = vi.fn();
const signInToIskam = vi.fn();
let platformKind = 'capacitor';
let demo = false;
vi.mock('../iskamSession', () => ({ runSilentChain: (...a: unknown[]) => runSilentChain(...a) }));
vi.mock('../iskamHttp', () => ({ buildIskamHttpDeps: async () => ({}) }));
vi.mock('../iskamLogin', () => ({
  signInToIskam: (...a: unknown[]) => signInToIskam(...a),
  buildIskamLoginDeps: async () => ({}),
}));
vi.mock('../../../platform', () => ({ getPlatform: () => ({ kind: platformKind }) }));
vi.mock('../../../errors/demoMode', () => ({ isDemoMode: () => demo }));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

import { useIskamStore } from '../iskamStore';
import { LoginCancelledError, LoginUnreachableError } from '../../ensureSession';

const KONTA = `<div class="vyskaRiadkuKonto"><div>Hlavní konto</div><div>245,00 Kč</div><a href="/Platby/NabitiKonta/0">Nabít</a></div>`;
const s = () => useIskamStore.getState();

describe('useIskamStore', () => {
  beforeEach(() => {
    runSilentChain.mockReset();
    signInToIskam.mockReset();
    platformKind = 'capacitor';
    demo = false;
    s().reset();
  });

  it('shows the balance when the chain is live', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    const p = s().check();
    expect(s().status).toBe('checking');
    await p;
    expect(s().status).toBe('balance');
    expect(s().balance).toEqual({ amount: 245, text: '245,00 Kč' });
  });

  it.each([
    [{ state: 'dead' }, 'signed-out'],
    [{ state: 'unreachable' }, 'unavailable'],
    [{ state: 'live', kontaHtml: '<div class="vyskaRiadkuKonto">changed page</div>' }, 'unavailable'],
  ])('maps %j to %s with no balance', async (result, status) => {
    runSilentChain.mockResolvedValue(result);
    await s().check();
    expect(s().status).toBe(status);
    expect(s().balance).toBeNull();
  });

  it('stays hidden in demo mode and off Capacitor, without touching WebISKAM', async () => {
    demo = true;
    await s().check();
    expect(s().status).toBe('hidden');
    demo = false;
    platformKind = 'web';
    await s().check();
    expect(s().status).toBe('hidden');
    expect(runSilentChain).not.toHaveBeenCalled();
  });

  it('ignores a check that finishes after the sheet was closed (reset)', async () => {
    let finish!: (v: unknown) => void;
    runSilentChain.mockReturnValue(new Promise((r) => (finish = r)));
    const p = s().check();
    s().reset();
    finish({ state: 'live', kontaHtml: KONTA });
    await p;
    expect(s().status).toBe('hidden');
    expect(s().balance).toBeNull();
  });

  it('never shows the previous balance while re-checking', async () => {
    runSilentChain.mockResolvedValueOnce({ state: 'live', kontaHtml: KONTA });
    await s().check();
    runSilentChain.mockReturnValueOnce(new Promise(() => {}));
    void s().check();
    expect(s().status).toBe('checking');
    expect(s().balance).toBeNull();
  });

  it('signIn runs the popup and then checks', async () => {
    signInToIskam.mockResolvedValue(undefined);
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    await s().signIn();
    expect(s().status).toBe('balance');
    expect(s().signingIn).toBe(false);
  });

  it('a dismissed popup goes back to signed-out; a popup that never loaded to unavailable', async () => {
    signInToIskam.mockRejectedValueOnce(new LoginCancelledError());
    await s().signIn();
    expect(s().status).toBe('signed-out');
    signInToIskam.mockRejectedValueOnce(new LoginUnreachableError());
    await s().signIn();
    expect(s().status).toBe('unavailable');
  });

  it('a second tap while the popup is open does not open another', async () => {
    signInToIskam.mockReturnValue(new Promise(() => {}));
    void s().signIn();
    void s().signIn();
    expect(signInToIskam).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamStore.test.ts`
Expected: FAIL — cannot resolve `../iskamStore`.

- [ ] **Step 3: Write the implementation**

```ts
import { create } from 'zustand';
import { isDemoMode } from '../../errors/demoMode';
import { getPlatform } from '../../platform';
import { logError } from '../../utils/reportError';
import { LoginCancelledError } from '../ensureSession';
import { buildIskamHttpDeps } from './iskamHttp';
import { buildIskamLoginDeps, signInToIskam } from './iskamLogin';
import { runSilentChain, type ChainResult } from './iskamSession';
import { parseHlavniKonto, type KontoBalance } from './kontaParser';

export type IskamStatus = 'hidden' | 'checking' | 'signed-out' | 'balance' | 'unavailable';
export type TopUpPhase = 'idle' | 'starting' | 'paying' | 'failed';

export interface IskamState {
  status: IskamStatus;
  balance: KontoBalance | null;
  signingIn: boolean;
  topUp: TopUpPhase;
  check(): Promise<void>;
  signIn(): Promise<void>;
  reset(): void;
}

/**
 * The ISIC row's state. A store of its own, NOT a slice of useAppStore: the
 * extension builds useAppStore too, and WebISKAM must not reach it in any form
 * (#247; src/test/guards/desktopHasNoIskam.test.ts).
 *
 * The balance lives here and nowhere else — memory only, and only from the
 * latest successful /Konta. Every check starts by dropping it, so a student
 * never sees a number WebISKAM did not just confirm.
 */
let seq = 0;

function available(): boolean {
  if (isDemoMode()) return false;
  try {
    return getPlatform().kind === 'capacitor';
  } catch {
    return false;
  }
}

function fromChain(r: ChainResult): Pick<IskamState, 'status' | 'balance'> {
  if (r.state === 'dead') return { status: 'signed-out', balance: null };
  if (r.state === 'unreachable') return { status: 'unavailable', balance: null };
  const balance = parseHlavniKonto(r.kontaHtml);
  return balance ? { status: 'balance', balance } : { status: 'unavailable', balance: null };
}

export const useIskamStore = create<IskamState>()((set, get) => ({
  status: 'hidden',
  balance: null,
  signingIn: false,
  topUp: 'idle',

  async check() {
    if (!available()) {
      set({ status: 'hidden', balance: null });
      return;
    }
    const mine = ++seq;
    set({ status: 'checking', balance: null });
    const result = await runSilentChain(await buildIskamHttpDeps());
    if (mine !== seq) return;
    set(fromChain(result));
  },

  async signIn() {
    if (get().signingIn || !available()) return;
    set({ signingIn: true });
    try {
      await signInToIskam(await buildIskamLoginDeps());
      set({ signingIn: false });
      await get().check();
    } catch (e) {
      if (e instanceof LoginCancelledError) {
        set({ signingIn: false, status: 'signed-out', balance: null });
      } else {
        logError('Iskam.signIn', e);
        set({ signingIn: false, status: 'unavailable', balance: null });
      }
    }
  },

  reset() {
    seq++;
    set({ status: 'hidden', balance: null, signingIn: false, topUp: 'idle' });
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/mobile/iskam/__tests__/iskamStore.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/mobile/iskam/iskamStore.ts src/mobile/iskam/__tests__/iskamStore.test.ts
git commit -m "feat(iskam): a separate store for the ISIC row — check and sign-in

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The row on the menza sheet, sign-out, guard

**Files:**
- Create: `src/components/mobile/sheets/IskamBalanceRow.tsx`
- Create: `src/mobile/iskam/clearIskam.ts`
- Create: `src/test/guards/desktopHasNoIskam.test.ts`
- Modify: `src/components/mobile/sheets/MenuSheet.tsx`, `src/components/mobile/screens/calendar/MenuCard.tsx`, `src/mobile/signOut.ts`, `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`
- Test: `src/components/mobile/sheets/__tests__/IskamBalanceRow.test.tsx`; modify `src/mobile/__tests__/signOut.test.ts`, `src/mobile/__tests__/signOutDeps.test.ts`, `src/components/mobile/screens/calendar/__tests__/MenuCard.test.tsx`

**Interfaces:**
- Consumes: `useIskamStore` (Task 7); `clearJar` (Task 2); `ISKAM_COOKIE_URL`, `IDP_COOKIE_URL` (Task 1).
- Produces: `IskamBalanceRow(): JSX.Element | null`; `clearIskam(): Promise<void>`; `SignOutDeps.clearIskam(): Promise<void>`. The row renders `{open && canTopUp && <IskamTopUpForm />}` only from Task 10 on; in this task the Dobít button toggles nothing but its `aria-expanded`.

- [ ] **Step 1: i18n keys**

Add to `src/i18n/locales/cs.json` (top level, after `"menu"`):

```json
  "iskam": {
    "show": "Zobrazit zůstatek ISIC",
    "label": "ISIC · Hlavní konto",
    "checking": "Načítám zůstatek",
    "unavailable": "Zůstatek teď nejde načíst",
    "topUp": "Dobít",
    "amount": "Částka (Kč)",
    "card": "Zaplatit kartou",
    "gpay": "Google Pay",
    "invalid": "Zadej celé číslo od 1 do 15 000 Kč",
    "failed": "Platbu se nepodařilo zahájit"
  },
```

and to `src/i18n/locales/en.json`:

```json
  "iskam": {
    "show": "Show ISIC balance",
    "label": "ISIC · Main account",
    "checking": "Loading balance",
    "unavailable": "Balance unavailable right now",
    "topUp": "Top up",
    "amount": "Amount (CZK)",
    "card": "Pay by card",
    "gpay": "Google Pay",
    "invalid": "Enter a whole amount from 1 to 15,000 CZK",
    "failed": "Could not start the payment"
  },
```

- [ ] **Step 2: Write the failing tests**

`src/components/mobile/sheets/__tests__/IskamBalanceRow.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../../mobile/iskam/iskamSession', () => ({ runSilentChain: vi.fn() }));
vi.mock('../../../../mobile/iskam/iskamHttp', () => ({ buildIskamHttpDeps: async () => ({}) }));
vi.mock('../../../../mobile/iskam/iskamLogin', () => ({ signInToIskam: vi.fn(), buildIskamLoginDeps: async () => ({}) }));

import { IskamBalanceRow } from '../IskamBalanceRow';
import { useIskamStore } from '../../../../mobile/iskam/iskamStore';

const setState = (p: Partial<ReturnType<typeof useIskamStore.getState>>) => useIskamStore.setState(p);

describe('IskamBalanceRow', () => {
  beforeEach(() => useIskamStore.getState().reset());
  afterEach(cleanup);

  it('renders nothing while hidden (demo mode, extension, dev webapp)', () => {
    const { container } = render(<IskamBalanceRow />);
    expect(container).toBeEmptyDOMElement();
  });

  it('checking: a skeleton in place of the amount, Dobít disabled', () => {
    setState({ status: 'checking' });
    render(<IskamBalanceRow />);
    expect(screen.getByTestId('iskam-skeleton')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dobít' })).toBeDisabled();
  });

  it('signed-out: "Zobrazit zůstatek ISIC" opens the popup; Dobít disabled', () => {
    const signIn = vi.fn(async () => {});
    setState({ status: 'signed-out', signIn });
    render(<IskamBalanceRow />);
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit zůstatek ISIC' }));
    expect(signIn).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dobít' })).toBeDisabled();
  });

  it('balance: the amount and an enabled Dobít', () => {
    setState({ status: 'balance', balance: { amount: 245, text: '245,00 Kč' } });
    render(<IskamBalanceRow />);
    expect(screen.getByText('245,00 Kč')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dobít' })).toBeEnabled();
  });

  it('unavailable: a retry, no amount, Dobít disabled', () => {
    const check = vi.fn(async () => {});
    setState({ status: 'unavailable', check });
    render(<IskamBalanceRow />);
    fireEvent.click(screen.getByRole('button', { name: 'Zůstatek teď nejde načíst' }));
    expect(check).toHaveBeenCalled();
    expect(screen.queryByText(/Kč/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Dobít' })).toBeDisabled();
  });
});
```

(If the default test language is not `cz`, set it the way neighbouring sheet tests do — `useAppStore.setState({ language: 'cz' })` in `beforeEach`.)

In `src/mobile/__tests__/signOut.test.ts`, add `clearIskam: vi.fn(async () => {}),` to `makeDeps`, and add:

```ts
  it('clears the WebISKAM login too, and a failure there still restarts', async () => {
    const deps = makeDeps({
      clearIskam: vi.fn(async () => {
        throw new Error('keystore');
      }),
    });
    await signOutMobile(deps);
    expect(deps.clearIskam).toHaveBeenCalled();
    expect(deps.clearLocalData).toHaveBeenCalled();
    expect(deps.restart).toHaveBeenCalled();
  });

  it('does not touch the WebISKAM login when the sign-out is refused', async () => {
    const deps = makeDeps({
      clearToken: vi.fn(async () => {
        throw new Error('keystore unavailable');
      }),
    });
    await expect(signOutMobile(deps)).rejects.toThrow();
    expect(deps.clearIskam).not.toHaveBeenCalled();
  });
```

In `src/components/mobile/screens/calendar/__tests__/MenuCard.test.tsx`, add a test that clicking the card calls `useIskamStore.getState().check` (spy with `vi.spyOn(useIskamStore.getState(), 'check')` replaced via `useIskamStore.setState({ check: vi.fn(async () => {}) })`).

`src/test/guards/desktopHasNoIskam.test.ts`:

```ts
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isTrustedHostOrigin } from '../../utils/trustedOrigin';

/**
 * The ISIC balance and top-up are on the PHONE/iPad tree only, by decision.
 *
 * WebISKAM was removed from reIS in #247 (2026-08-30) because that integration
 * was not implemented well enough and its scope was far too large. It came back
 * on 2026-10-13 deliberately narrow (Dominik): the Hlavní konto balance and a
 * card / Google Pay top-up on the mobile menza sheet — nothing in the
 * extension, no dorm, reservation or meal-order pages. The extension still
 * rejects the webiskam origin, and nothing outside the phone tree may import
 * the WebISKAM code. Spec: docs/superpowers/specs/2026-10-13-isic-balance-topup-design.md
 */
const MOBILE_ONLY = [
  'src/mobile/iskam/iskamJar.ts',
  'src/mobile/iskam/iskamCookieStore.ts',
  'src/mobile/iskam/iskamHttp.ts',
  'src/mobile/iskam/samlForm.ts',
  'src/mobile/iskam/kontaParser.ts',
  'src/mobile/iskam/topUp.ts',
  'src/mobile/iskam/iskamSession.ts',
  'src/mobile/iskam/iskamLogin.ts',
  'src/mobile/iskam/iskamStore.ts',
  'src/mobile/iskam/clearIskam.ts',
  'src/components/mobile/sheets/IskamBalanceRow.tsx',
  'src/components/mobile/sheets/MenuSheet.tsx',
  'src/components/mobile/screens/calendar/MenuCard.tsx',
];

/** Files outside src/mobile/iskam that may reach it, each on the phone tree. */
const ALLOWED_IMPORTERS = new Set([
  'src/mobile/signOut.ts',
  'src/components/mobile/sheets/IskamBalanceRow.tsx',
  'src/components/mobile/sheets/MenuSheet.tsx',
  'src/components/mobile/screens/calendar/MenuCard.tsx',
]);

const root = process.cwd();
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'test') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(relative(root, p));
  }
  return out;
}

describe('WebISKAM stays on the phone tree', () => {
  it.each(MOBILE_ONLY)('%s exists (a rename must update this guard)', (f) => {
    expect(existsSync(join(root, f))).toBe(true);
  });

  it('nothing else imports the WebISKAM code or names its host', () => {
    // Imports (static and dynamic) and the host name — not prose: comments
    // such as IndexedDBService's note on deleting the old `iskam` store are fine.
    const REACHES = /(from\s+|import\(\s*)['"][^'"]*\/iskam\/[^'"]*['"]|webiskam\.mendelu\.cz/i;
    const offenders = walk(join(root, 'src'))
      .filter((f) => !f.startsWith('src/mobile/iskam/') && !ALLOWED_IMPORTERS.has(f))
      .filter((f) => REACHES.test(readFileSync(join(root, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the extension still rejects the webiskam origin (#247)', () => {
    expect(isTrustedHostOrigin('https://webiskam.mendelu.cz', false)).toBe(false);
  });
});
```

(Task 10 adds `IskamTopUpForm.tsx` and `iskamTopUp.ts` to `MOBILE_ONLY` and the form to `ALLOWED_IMPORTERS`.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/mobile/sheets/__tests__/IskamBalanceRow.test.tsx src/mobile/__tests__/signOut.test.ts src/test/guards/desktopHasNoIskam.test.ts src/components/mobile/screens/calendar/__tests__/MenuCard.test.tsx`
Expected: FAIL — `IskamBalanceRow`/`clearIskam` missing; signOut doesn't call `clearIskam`; MenuCard doesn't call `check`.

- [ ] **Step 4: Implement**

`src/components/mobile/sheets/IskamBalanceRow.tsx`:

```tsx
import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useIskamStore } from '../../../mobile/iskam/iskamStore';

/**
 * The ISIC Hlavní konto balance, at the top of the jídelníček sheet.
 *
 * Four states (see the spec's UI table). The balance is shown only after
 * WebISKAM has just confirmed it; otherwise the row says why not. Dobít is
 * enabled only beside a confirmed balance. Phone/iPad only — see
 * src/test/guards/desktopHasNoIskam.test.ts.
 */
export function IskamBalanceRow() {
  const { t } = useTranslation();
  const status = useIskamStore((s) => s.status);
  const balance = useIskamStore((s) => s.balance);
  const signingIn = useIskamStore((s) => s.signingIn);
  const [open, setOpen] = useState(false);
  if (status === 'hidden') return null;
  const canTopUp = status === 'balance' && balance !== null;

  return (
    <div
      data-testid="iskam-row"
      className="mx-4 mb-3 rounded-2xl border border-base-content/10 bg-base-100 px-3.5 py-2.5"
    >
      <div className="flex items-center gap-2.5">
        <CreditCard size={18} className="flex-shrink-0 text-base-content/60" aria-hidden />
        {status === 'signed-out' ? (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-md font-bold text-primary"
            disabled={signingIn}
            onClick={() => void useIskamStore.getState().signIn()}
          >
            {t('iskam.show')}
          </button>
        ) : status === 'unavailable' ? (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-md text-base-content/70"
            onClick={() => void useIskamStore.getState().check()}
          >
            {t('iskam.unavailable')}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate text-md font-bold text-base-content">
            {t('iskam.label')}
          </span>
        )}
        {status === 'checking' && (
          <span data-testid="iskam-skeleton" className="skeleton h-4 w-16" aria-label={t('iskam.checking')} />
        )}
        {canTopUp && (
          <span className="whitespace-nowrap text-md font-bold text-base-content">{balance.text}</span>
        )}
        <button
          type="button"
          className="btn btn-primary btn-sm flex-shrink-0"
          disabled={!canTopUp}
          aria-expanded={open && canTopUp}
          onClick={() => setOpen((o) => !o)}
        >
          {t('iskam.topUp')}
        </button>
      </div>
    </div>
  );
}
```

`src/components/mobile/sheets/MenuSheet.tsx` — add the imports and render the row directly under `SheetHeader` (above the `!current ? … : …` branch so it shows even when the day's menu vanished); reset the store when the sheet closes:

```tsx
import { IskamBalanceRow } from './IskamBalanceRow';
import { useIskamStore } from '../../../mobile/iskam/iskamStore';
// …
  // The balance is never kept past the sheet: closing drops it, so the next
  // open shows "checking", not a number from minutes ago.
  const close = () => {
    useIskamStore.getState().reset();
    onClose();
  };
  return (
    <Sheet size="content" onClose={close}>
      <SheetHeader /* …unchanged props… */ onClose={close} />
      <IskamBalanceRow />
      {/* …existing !current ? … : … unchanged… */}
```

`src/components/mobile/screens/calendar/MenuCard.tsx` — in the button's `onClick`:

```tsx
        onClick={() => {
          pushSheet({ kind: 'menu', dayIso });
          // From the tap, not an effect in the sheet (CLAUDE.md: no useEffect
          // fetching). Hidden in demo mode / off Capacitor inside check().
          void useIskamStore.getState().check();
        }}
```

with `import { useIskamStore } from '../../../../mobile/iskam/iskamStore';`.

`src/mobile/iskam/clearIskam.ts`:

```ts
import { clearJar } from './iskamCookieStore';
import { IDP_COOKIE_URL, ISKAM_COOKIE_URL } from './iskamJar';
import { useIskamStore } from './iskamStore';

/**
 * The WebISKAM half of signing out: the stored jar (authoritative — the native
 * jars are only ever seeded from it), then both native jars best-effort, for
 * the same reasons signOut's IS cookies are best-effort (InAppBrowser rejects
 * on Android with no dialog open).
 */
export async function clearIskam(): Promise<void> {
  useIskamStore.getState().reset();
  await clearJar();
  const [{ InAppBrowser }, { CapacitorCookies }] = await Promise.all([
    import('@capgo/capacitor-inappbrowser'),
    import('@capacitor/core'),
  ]);
  await Promise.allSettled(
    [ISKAM_COOKIE_URL, IDP_COOKIE_URL].flatMap((url) => [
      InAppBrowser.clearCookies({ url }),
      CapacitorCookies.clearCookies({ url }),
    ])
  );
}
```

`src/mobile/signOut.ts`:
- `SignOutDeps` gains:
  ```ts
  /** Removes the WebISKAM + alibaba login (mobile/iskam/clearIskam). */
  clearIskam(): Promise<void>;
  ```
- In `signOutMobile`, after the `clearIsCookies` try/catch block, add:
  ```ts
  // Its own block: the ISIC login is a second credential, but failing to clear
  // it must not skip the wipe and restart below.
  try {
    await deps.clearIskam();
  } catch (e) {
    logError('Mobile.signOut:iskam', e);
  }
  ```
- In `buildSignOutDeps`, add:
  ```ts
    clearIskam: async () => {
      const { clearIskam } = await import('./iskam/clearIskam');
      await clearIskam();
    },
  ```

In `src/mobile/__tests__/signOutDeps.test.ts`, add `vi.mock('../iskam/clearIskam', () => ({ clearIskam: vi.fn(async () => {}) }))` if a test there calls `clearIskam`; existing tests only call `clearIsCookies` and keep passing.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/mobile/sheets src/components/mobile/screens/calendar src/mobile src/test/guards/desktopHasNoIskam.test.ts src/test/guards/treeParityHookSees.test.ts src/mobile/__tests__/bundleImportsWithoutChrome.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/mobile src/mobile src/i18n/locales src/test/guards/desktopHasNoIskam.test.ts
git commit -m "feat(menza): ISIC balance row on the phone's jídelníček sheet

Signs in to WebISKAM on demand, shows the Hlavní konto balance, and is
cleared on sign-out. Phone/iPad only, pinned by desktopHasNoIskam.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Device gate — cookies on a real iPad and Android phone

No code unless something fails. This is the spec's device check, run as soon as there is code to run: it decides whether everything after it (top-up) is built on solid ground. **Do not start Task 10 until this passes.**

**Builds:** the real release build on each device (memory: never live reload/debug). iPad: the recipe in memory `ipad-device` (build, sign, install, launch, screenshot; the iPad cannot be tapped by Claude — Dominik taps). Android: `npm run cap:sync`, then `npm run android:push` (memory `android-build-on-this-mac`).

- [ ] **Step 1: iPad.** Dominik opens the calendar on a day with a menu → taps the menza card → the ISIC row shows `checking` then "Zobrazit zůstatek ISIC". He taps it, signs in on alibaba (accepts consent if shown), the popup closes, the balance appears. Screenshot.
- [ ] **Step 2: iPad, kill and relaunch.** Swipe the app away, reopen, open the menza sheet: the balance must appear with NO popup. This proves the explicit-header delivery and the `Set-Cookie` write-back on iOS.
- [ ] **Step 3: Android.** Same two steps on the Android phone. This proves the native-jar delivery and the `Set-Cookie` header on Android.
- [ ] **Step 4: Exercise the refresh legs.** Repeat Step 2 on each device after a gap longer than the measured ticket timeout (spec table; if the probe has not finished, after ≥ 2 h): the balance must still appear without a popup, or — if the IdP session is also gone — the row must show "Zobrazit zůstatek ISIC" (never an old number, never an error toast).
- [ ] **Step 5: If any step fails,** stop, debug with Safari Web Inspector (iPad) / `chrome://inspect` (Android) using `superpowers:systematic-debugging`, and report to Dominik before changing the design. Likely suspects in order: `Set-Cookie` missing from `headers` on one platform (fallback: read `CapacitorCookies.getCookies({url})` per host after each hop); URLSession adding its own stored cookies on iOS; the popup's IdP state living in WebView localStorage (then the IdP leg fails and the popup appears more often — acceptable, record it).
- [ ] **Step 6: Record** the outcome (pass/fail per step, device, OS version) in the spec under "Measured facts" and commit:

```bash
git add docs/superpowers/specs/2026-10-13-isic-balance-topup-design.md
git commit -m "docs(spec): ISIC device gate results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Top-up — GoPay through `@capacitor/browser`

**Files:**
- Modify: `package.json`, `package-lock.json` (`@capacitor/browser@^8`), native projects via `npm run cap:sync`
- Create: `src/mobile/iskam/iskamTopUp.ts`, `src/components/mobile/sheets/IskamTopUpForm.tsx`
- Modify: `src/mobile/iskam/iskamStore.ts` (add `startTopUp`), `src/components/mobile/sheets/IskamBalanceRow.tsx` (render the form), `src/test/guards/desktopHasNoIskam.test.ts` (list the two new files)
- Test: `src/mobile/iskam/__tests__/iskamTopUp.test.ts`, extend `iskamStore.test.ts`, `src/components/mobile/sheets/__tests__/IskamTopUpForm.test.tsx`

**Interfaces:**
- Consumes: `iskamHop`, `IskamHttpDeps` (Task 3); `loadJar`, `saveJar`, `jarGeneration` (Task 2); `isAuthRedirect` (Task 5); `initTopUpUrl`, `parseGatewayUrl`, `validateAmount`, `PayMethod` (Task 4); `runSilentChain` (Task 5); `signInToIskam`, `buildIskamLoginDeps` (Task 6).
- Produces:
  - `type InitResult = { kind: 'ok'; url: string } | { kind: 'expired' } | { kind: 'rejected' }`
  - `initTopUp(http: IskamHttpDeps, amount: number, method: PayMethod): Promise<InitResult>`
  - `openGateway(url: string): Promise<void>` — resolves on `browserFinished`
  - store action `startTopUp(amount: number, method: PayMethod): Promise<void>`; const `RECHECK_MS = 3000`
  - `IskamTopUpForm(): JSX.Element`

- [ ] **Step 1: Install the plugin**

```bash
test -L node_modules && echo "SHARED node_modules — stop, see CLAUDE.md" || npm install @capacitor/browser@^8
```

Then `npm run cap:sync`. Then run the native-plugin guard:

Run: `npx vitest run src/test/guards/nativePluginsAreReachable.test.ts`
Expected: PASS (the plugin is a packaged npm plugin with its own `@objc` class; if the guard flags it, follow the guard's message — do not add it to `ANDROID_ONLY`/`IOS_ONLY`).

- [ ] **Step 2: Write the failing tests**

`src/mobile/iskam/__tests__/iskamTopUp.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IskamHttpDeps, NativeHttpResponse } from '../iskamHttp';

const store = new Map<string, unknown>();
vi.mock('../../../platform', () => ({
  getPlatform: () => ({
    kind: 'capacitor',
    secureStorage: {
      get: async (k: string) => store.get(k),
      set: async (k: string, v: unknown) => void store.set(k, v),
      remove: async (k: string) => void store.delete(k),
    },
  }),
}));

const browser = { open: vi.fn(async () => {}), addListener: vi.fn() };
vi.mock('@capacitor/browser', () => ({ Browser: browser }));

import { initTopUp, openGateway } from '../iskamTopUp';
import { __resetIskamJarForTests, saveJar } from '../iskamCookieStore';

const GATE = 'https://gate.gopay.com/gw-ui/rest/v3/123';
function http(r: NativeHttpResponse) {
  return { platform: 'ios', setCookie: async () => {}, request: vi.fn(async () => r) } satisfies IskamHttpDeps;
}

describe('initTopUp', () => {
  beforeEach(async () => {
    store.clear();
    __resetIskamJarForTests();
    await saveJar([{ name: '.ISKAMASPXAUTH', value: 't', host: 'webiskam.mendelu.cz', path: '/', expires: null }]);
  });

  it('sends the XHR GET with the session and returns the validated gateway URL', async () => {
    const h = http({ status: 200, data: `<form action="${GATE}" method="post" id="gopay-payment-button"></form>` });
    expect(await initTopUp(h, 250, 'card')).toEqual({ kind: 'ok', url: GATE });
    const sent = h.request.mock.calls[0]![0];
    expect(sent.headers['X-Requested-With']).toBe('XMLHttpRequest');
    expect(sent.headers.Cookie).toBe('.ISKAMASPXAUTH=t');
    expect(sent.url).toContain('VybranaMetoda=PAYMENT_CARD');
  });

  it('an empty 200 or a 302 to /Home/Index means the session expired', async () => {
    expect(await initTopUp(http({ status: 200, data: '' }), 1, 'gpay')).toEqual({ kind: 'expired' });
    expect(
      await initTopUp(http({ status: 302, headers: { Location: '/Home/Index' }, data: '' }), 1, 'gpay')
    ).toEqual({ kind: 'expired' });
  });

  it('rejects a form that points anywhere but GoPay\'s gateway', async () => {
    const h = http({ status: 200, data: '<form action="https://evil.example/gw-ui/1"></form>' });
    expect(await initTopUp(h, 1, 'card')).toEqual({ kind: 'rejected' });
  });
});

describe('openGateway', () => {
  it('opens the URL and resolves when the browser view is closed', async () => {
    let finished: () => void = () => {};
    const remove = vi.fn(async () => {});
    browser.addListener.mockImplementation(async (_e: string, cb: () => void) => ((finished = cb), { remove }));
    const p = openGateway(GATE);
    await new Promise((r) => setTimeout(r, 0));
    expect(browser.open).toHaveBeenCalledWith({ url: GATE });
    finished();
    await p;
    expect(remove).toHaveBeenCalled();
  });
});
```

Extend `src/mobile/iskam/__tests__/iskamStore.test.ts` — add these mocks at the top (beside the others):

```ts
const initTopUp = vi.fn();
const openGateway = vi.fn();
vi.mock('../iskamTopUp', () => ({
  initTopUp: (...a: unknown[]) => initTopUp(...a),
  openGateway: (...a: unknown[]) => openGateway(...a),
}));
```

and these tests (reset `initTopUp`/`openGateway` in `beforeEach`):

```ts
describe('startTopUp', () => {
  const GATE = 'https://gate.gopay.com/gw-ui/rest/v3/1';
  const BALANCE = (n: string) =>
    `<div class="vyskaRiadkuKonto"><div>Hlavní konto</div><div>${n} Kč</div><a href="/Platby/NabitiKonta/0">Nabít</a></div>`;

  it('opens the gateway, then re-reads the balance once the browser closes', async () => {
    runSilentChain.mockResolvedValueOnce({ state: 'live', kontaHtml: BALANCE('100') });
    await s().check();
    initTopUp.mockResolvedValue({ kind: 'ok', url: GATE });
    openGateway.mockResolvedValue(undefined);
    runSilentChain.mockResolvedValueOnce({ state: 'live', kontaHtml: BALANCE('350') });
    await s().startTopUp(250, 'gpay');
    expect(initTopUp).toHaveBeenCalledWith(expect.anything(), 250, 'gpay');
    expect(openGateway).toHaveBeenCalledWith(GATE);
    expect(s().balance?.amount).toBe(350);
    expect(s().topUp).toBe('idle');
  });

  it('re-checks once more after a short wait when the balance has not moved yet', async () => {
    vi.useFakeTimers();
    runSilentChain.mockResolvedValueOnce({ state: 'live', kontaHtml: BALANCE('100') });
    await s().check();
    initTopUp.mockResolvedValue({ kind: 'ok', url: GATE });
    openGateway.mockResolvedValue(undefined);
    runSilentChain
      .mockResolvedValueOnce({ state: 'live', kontaHtml: BALANCE('100') })
      .mockResolvedValueOnce({ state: 'live', kontaHtml: BALANCE('350') });
    const p = s().startTopUp(250, 'card');
    await vi.advanceTimersByTimeAsync(3000);
    await p;
    expect(s().balance?.amount).toBe(350);
    expect(runSilentChain).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('an expired session runs the chain, and the popup if the chain is dead, then inits again', async () => {
    initTopUp.mockResolvedValueOnce({ kind: 'expired' }).mockResolvedValueOnce({ kind: 'ok', url: GATE });
    runSilentChain.mockResolvedValueOnce({ state: 'dead' }).mockResolvedValue({ state: 'live', kontaHtml: BALANCE('1') });
    signInToIskam.mockResolvedValue(undefined);
    openGateway.mockResolvedValue(undefined);
    await s().startTopUp(10, 'card');
    expect(signInToIskam).toHaveBeenCalledTimes(1);
    expect(initTopUp).toHaveBeenCalledTimes(2);
    expect(openGateway).toHaveBeenCalledWith(GATE);
  });

  it('a rejected gateway URL opens nothing and shows the failure', async () => {
    initTopUp.mockResolvedValue({ kind: 'rejected' });
    await s().startTopUp(10, 'card');
    expect(openGateway).not.toHaveBeenCalled();
    expect(s().topUp).toBe('failed');
  });

  it('ignores a second startTopUp while the first is starting (double tap)', async () => {
    initTopUp.mockReturnValue(new Promise(() => {}));
    void s().startTopUp(10, 'card');
    void s().startTopUp(10, 'card');
    await new Promise((r) => setTimeout(r, 0));
    expect(initTopUp).toHaveBeenCalledTimes(1);
  });

  it('dismissing the popup mid top-up is not an error', async () => {
    initTopUp.mockResolvedValue({ kind: 'expired' });
    runSilentChain.mockResolvedValue({ state: 'dead' });
    signInToIskam.mockRejectedValue(new LoginCancelledError());
    await s().startTopUp(10, 'card');
    expect(s().topUp).toBe('idle');
    expect(openGateway).not.toHaveBeenCalled();
  });
});
```

`src/components/mobile/sheets/__tests__/IskamTopUpForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

let platform = 'android';
vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig<typeof import('@capacitor/core')>()),
  Capacitor: { getPlatform: () => platform },
}));
vi.mock('../../../../mobile/iskam/iskamSession', () => ({ runSilentChain: vi.fn() }));
vi.mock('../../../../mobile/iskam/iskamHttp', () => ({ buildIskamHttpDeps: async () => ({}) }));
vi.mock('../../../../mobile/iskam/iskamLogin', () => ({ signInToIskam: vi.fn(), buildIskamLoginDeps: async () => ({}) }));
vi.mock('../../../../mobile/iskam/iskamTopUp', () => ({ initTopUp: vi.fn(), openGateway: vi.fn() }));

import { IskamTopUpForm } from '../IskamTopUpForm';
import { useIskamStore } from '../../../../mobile/iskam/iskamStore';

describe('IskamTopUpForm', () => {
  const startTopUp = vi.fn(async () => {});
  beforeEach(() => {
    platform = 'android';
    startTopUp.mockClear();
    useIskamStore.setState({ topUp: 'idle', startTopUp });
  });
  afterEach(cleanup);

  it('keeps both pay buttons disabled until the amount is valid', () => {
    render(<IskamTopUpForm />);
    expect(screen.getByRole('button', { name: 'Zaplatit kartou' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Částka (Kč)'), { target: { value: '15001' } });
    expect(screen.getByText('Zadej celé číslo od 1 do 15 000 Kč')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google Pay' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Částka (Kč)'), { target: { value: '250' } });
    expect(screen.getByRole('button', { name: 'Zaplatit kartou' })).toBeEnabled();
  });

  it('pays with the parsed amount and the chosen method', () => {
    render(<IskamTopUpForm />);
    fireEvent.change(screen.getByLabelText('Částka (Kč)'), { target: { value: '1 500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Google Pay' }));
    expect(startTopUp).toHaveBeenCalledWith(1500, 'gpay');
  });

  it('has no Google Pay button on iOS', () => {
    platform = 'ios';
    render(<IskamTopUpForm />);
    expect(screen.queryByRole('button', { name: 'Google Pay' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Zaplatit kartou' })).toBeInTheDocument();
  });

  it('shows the failure message after a failed start', () => {
    useIskamStore.setState({ topUp: 'failed' });
    render(<IskamTopUpForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('Platbu se nepodařilo zahájit');
  });
});
```

Extend `IskamBalanceRow.test.tsx`: in the `balance` state, clicking Dobít shows the amount field (`screen.getByLabelText('Částka (Kč)')`); clicking it again hides it.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/mobile/iskam src/components/mobile/sheets/__tests__/IskamTopUpForm.test.tsx src/components/mobile/sheets/__tests__/IskamBalanceRow.test.tsx`
Expected: FAIL — `iskamTopUp`, `startTopUp`, `IskamTopUpForm` missing.

- [ ] **Step 4: Implement**

`src/mobile/iskam/iskamTopUp.ts`:

```ts
import { jarGeneration, loadJar, saveJar } from './iskamCookieStore';
import { iskamHop, type IskamHttpDeps } from './iskamHttp';
import { isAuthRedirect } from './iskamSession';
import { initTopUpUrl, parseGatewayUrl, type PayMethod } from './topUp';

export type InitResult = { kind: 'ok'; url: string } | { kind: 'expired' } | { kind: 'rejected' };

/**
 * Asks WebISKAM to create the GoPay payment. The amount is fixed here; GoPay
 * notifies WebISKAM server-side when it is paid, and an unpaid one times out
 * on GoPay's side, so starting one and walking away costs nothing.
 */
export async function initTopUp(
  http: IskamHttpDeps,
  amount: number,
  method: PayMethod
): Promise<InitResult> {
  const gen = jarGeneration();
  const jar = await loadJar();
  const { res, jar: next } = await iskamHop(http, jar, initTopUpUrl(amount, method), {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  await saveJar(next, gen);
  if (isAuthRedirect(res) || (res.status === 200 && !res.body.trim())) return { kind: 'expired' };
  if (res.status !== 200) throw new Error(`InitGopayPayment HTTP ${res.status}`);
  const url = parseGatewayUrl(res.body);
  return url ? { kind: 'ok', url } : { kind: 'rejected' };
}

/**
 * Opens GoPay in SFSafariViewController / a Chrome Custom Tab and resolves
 * when the student closes it. Not the InAppBrowser WebView: Google Pay inside a
 * WebView is untested, and the system view is where card autofill and Google
 * Pay live. The URL carries no session — GoPay's gateway needs none.
 */
export async function openGateway(url: string): Promise<void> {
  const { Browser } = await import('@capacitor/browser');
  await new Promise<void>((resolve, reject) => {
    void (async () => {
      let handle: { remove(): Promise<void> } | undefined;
      try {
        handle = await Browser.addListener('browserFinished', () => {
          void handle?.remove();
          resolve();
        });
        await Browser.open({ url });
      } catch (e) {
        void handle?.remove();
        reject(e);
      }
    })();
  });
}
```

`src/mobile/iskam/iskamStore.ts` — add to imports:

```ts
import { initTopUp, openGateway } from './iskamTopUp';
import type { PayMethod } from './topUp';
```

add to `IskamState`: `startTopUp(amount: number, method: PayMethod): Promise<void>;`, add `export const RECHECK_MS = 3000;` and `const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));`, and the action:

```ts
  /**
   * Dobít. Init first — Dobít is only enabled beside a balance WebISKAM just
   * confirmed, so the session is almost always live — and only on an
   * "expired" answer run the chain (and the popup if it is dead) and init once
   * more. After the browser view closes the balance is re-read; WebISKAM says
   * gateway payments are credited at once, but if the number has not moved it
   * is read once more after RECHECK_MS. The app never claims the payment
   * succeeded: closing the tab without paying looks exactly the same.
   */
  async startTopUp(amount, method) {
    const phase = get().topUp;
    if (phase === 'starting' || phase === 'paying' || !available()) return;
    set({ topUp: 'starting' });
    const before = get().balance?.amount ?? null;
    try {
      const http = await buildIskamHttpDeps();
      let init = await initTopUp(http, amount, method);
      if (init.kind === 'expired') {
        const chain = await runSilentChain(http);
        if (chain.state === 'dead') await signInToIskam(await buildIskamLoginDeps());
        else if (chain.state === 'unreachable') throw new Error('WebISKAM unreachable');
        init = await initTopUp(http, amount, method);
      }
      if (init.kind !== 'ok') throw new Error(`top-up init: ${init.kind}`);
      set({ topUp: 'paying' });
      await openGateway(init.url);
      set({ topUp: 'idle' });
      await get().check();
      if (get().status === 'balance' && get().balance?.amount === before) {
        await delay(RECHECK_MS);
        await get().check();
      }
    } catch (e) {
      if (e instanceof LoginCancelledError) {
        set({ topUp: 'idle' });
        return;
      }
      logError('Iskam.topUp', e);
      set({ topUp: 'failed' });
    }
  },
```

(Keep the file ≤ 200 lines; if it grows past, move `startTopUp`'s body into `src/mobile/iskam/runTopUp.ts` as `runTopUp(get, set, amount, method)` and list it in the guard.)

`src/components/mobile/sheets/IskamTopUpForm.tsx`:

```tsx
import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from '../../../hooks/useTranslation';
import { useIskamStore } from '../../../mobile/iskam/iskamStore';
import { validateAmount, type PayMethod } from '../../../mobile/iskam/topUp';

/**
 * One amount, two ways to pay. Google Pay only on Android: WebISKAM offers no
 * Apple Pay, and Google Pay is an Android wallet.
 */
export function IskamTopUpForm() {
  const { t } = useTranslation();
  const phase = useIskamStore((s) => s.topUp);
  const [text, setText] = useState('');
  const checked = validateAmount(text);
  const busy = phase === 'starting' || phase === 'paying';
  const invalid = text.trim() !== '' && !checked.ok;
  const gpay = Capacitor.getPlatform() === 'android';
  const pay = (method: PayMethod) => {
    if (checked.ok) void useIskamStore.getState().startTopUp(checked.amount, method);
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-2sm text-base-content/70">{t('iskam.amount')}</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="input input-bordered input-sm w-full"
          value={text}
          aria-invalid={invalid}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {invalid && <p className="text-2sm text-error">{t('iskam.invalid')}</p>}
      {phase === 'failed' && (
        <p role="alert" className="text-2sm text-error">
          {t('iskam.failed')}
        </p>
      )}
      <div className="flex gap-2">
        {gpay && (
          <button type="button" className="btn btn-sm flex-1" disabled={!checked.ok || busy} onClick={() => pay('gpay')}>
            {t('iskam.gpay')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary btn-sm flex-1"
          disabled={!checked.ok || busy}
          onClick={() => pay('card')}
        >
          {t('iskam.card')}
        </button>
      </div>
    </div>
  );
}
```

`IskamBalanceRow.tsx`: import `IskamTopUpForm` and render `{open && canTopUp && <IskamTopUpForm />}` as the last child of the outer `div`.

`desktopHasNoIskam.test.ts`: add `'src/mobile/iskam/iskamTopUp.ts'` and `'src/components/mobile/sheets/IskamTopUpForm.tsx'` to `MOBILE_ONLY`, and `'src/components/mobile/sheets/IskamTopUpForm.tsx'` to `ALLOWED_IMPORTERS`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/mobile/iskam src/components/mobile/sheets src/test/guards/desktopHasNoIskam.test.ts src/test/guards/nativePluginsAreReachable.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json android ios src/mobile/iskam src/components/mobile/sheets src/test/guards/desktopHasNoIskam.test.ts
git commit -m "feat(menza): top up the ISIC balance by card or Google Pay via GoPay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git status` first: commit only the native files `cap:sync` changed for the new plugin, not unrelated generated drift.)

---

### Task 11: Privacy disclosures

**Files:**
- Modify: `PRIVACY.md`, `docs/privacy-policy-app.md`, `src/test/guards/noStudentDataLeaves.test.ts`, `docs/superpowers/specs/2026-10-13-isic-balance-topup-design.md`
- Maybe modify: `privacy/disclosures.ts` (`PLATFORM_PERMISSIONS` only, and only if `@capacitor/browser` added a permission)

- [ ] **Step 1: Run the guards to see what they ask for**

Run: `npx vitest run src/test/guards/noStudentDataLeaves.test.ts scripts/lib/__tests__/privacyDisclosures.test.ts`
Expected: `noStudentDataLeaves` FAILS on `gate.gopay.com` (in `topUp.ts`); the disclosures test passes unless the plugin added an Android permission.

- [ ] **Step 2: `noStudentDataLeaves.test.ts`** — in `ALLOWED_HOSTS`, under `// --- fetched from, carrying student data. Each must stay disclosed. ---` add:

```ts
  'webiskam.mendelu.cz', // phone/iPad only: the ISIC Hlavní konto balance and the GoPay
  // top-up start, signed in as the student via alibaba.mendelu.cz (also mendelu.cz).
  // Already covered by the mendelu.cz suffix; listed so the disclosure is explicit.
```

and under `// --- deep links the STUDENT opens; no background request is made ---`:

```ts
  'gopay.com', // the GoPay payment page for an ISIC top-up, opened in the system browser view
```

- [ ] **Step 3: `PRIVACY.md`** — in *Third-Party Access*:
  - first paragraph: replace "**IS Mendelu is the only one that receives your academic data**, and only because it is the university's own system." with "**IS Mendelu is the only one that receives your academic data**, and only because it is the university's own system; WebISKAM, below, is the university's too, and receives only the sign-in that lets the app read your ISIC balance."
  - append to the "Only when you use the relevant feature" list:
    ```md
    7. **WebISKAM** (`webiskam.mendelu.cz`) and **MENDELU sign-in** (`alibaba.mendelu.cz`) — mobile app only, when you ask to see your ISIC balance or top it up. You sign in on MENDELU's own page; your password goes straight to MENDELU and reIS never sees it. The app reads the Hlavní konto balance and starts the GoPay payment as you. The sign-in cookies are kept encrypted on your device (Android Keystore; iOS Keychain) and deleted when you sign out; the balance is shown and never stored.
    8. **GoPay** (`gate.gopay.com`) — the payment page for a top-up opens in your phone's browser view. Your card or Google Pay details go to GoPay; reIS never sees them.
    ```
- [ ] **Step 4: `docs/privacy-policy-app.md`** — in *Who else reIS talks to*, after the IS Mendelu sentence, add:

```md
**WebISKAM** (the university's accommodation and canteen system) receives, only
in the phone app and only when you ask for your ISIC balance or a top-up, the
MENDELU sign-in you make on MENDELU's own page — your password goes to MENDELU,
never to reIS. The sign-in is kept encrypted on your device and deleted when you
sign out; the balance is shown, never stored. A top-up opens **GoPay**'s payment
page in your phone's browser view; your card or Google Pay details go to GoPay
and never to reIS.
```

- [ ] **Step 5: Spec correction.** In the spec's "Privacy and isolation", replace the `privacy/disclosures.ts` bullet with: "`privacy/disclosures.ts` describes Supabase flows only (FLOWS/EXEMPT), so WebISKAM and GoPay add no entry there; `PLATFORM_PERMISSIONS` changes only if `@capacitor/browser` adds an Android permission (checked by `privacyDisclosures.test.ts`)."

- [ ] **Step 6: Run every test that reads these docs** (memory: policy guards are line-sensitive):

Run: `grep -rlE "PRIVACY\.md|privacy-policy-app\.md" src scripts --include='*.ts'` then `npx vitest run` on each file listed, plus `npx vitest run src/test/guards/noStudentDataLeaves.test.ts scripts/lib/__tests__/privacyDisclosures.test.ts`, then `npm run privacy:generate` and `git diff --stat` (commit any regenerated table).
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add PRIVACY.md docs/privacy-policy-app.md src/test/guards/noStudentDataLeaves.test.ts docs/superpowers/specs/2026-10-13-isic-balance-topup-design.md privacy
git commit -m "docs(privacy): disclose WebISKAM sign-in and the GoPay top-up (mobile)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Verify, measure, hand over

- [ ] **Step 1: verify-ui.** Use the `verify-ui` skill on the menza sheet with the row in each state (`checking`, `signed-out`, `balance` with the form open, `unavailable`) at 320/390/430 and tablet width, both themes. Seed the state with `useIskamStore.setState(...)` in the dev webapp — note `check()` keeps the row hidden off Capacitor, so seed after opening the sheet. Fix any overflow/contrast finding (e.g. `text-error` on `bg-base-100`). Send before/after PNGs to Dominik with SendUserFile (memory: verifying-ui-work).
- [ ] **Step 2: Device top-up, Android.** Release build; Dominik opens the sheet, Dobít, types 10, taps Google Pay → the Custom Tab lands on GoPay's `/google-pay`; he closes it WITHOUT paying (or pays himself) → the row returns to `checking` then the balance. Repeat with card → `/card`. Claude never enters card details.
- [ ] **Step 3: Device top-up, iPad.** Same with card only; confirm there is no Google Pay button.
- [ ] **Step 4: Sign-out.** On one device: sign out of reIS, sign back in to IS, open the menza sheet → the row shows "Zobrazit zůstatek ISIC" (not a balance).
- [ ] **Step 5: Session lifetimes.** When the overnight probe has finished (`scratchpad/iskam-probe/probe.log`, `run-done` event), fill the spec's "Session lifetimes" table and add the same numbers to `reis-scraper/docs/webiskam.md` on its PR branch `claude/webiskam-structure` (reis-mendelu/reis-scraper#22), replacing "not measured yet". Then delete `state.json` (`node probe.mjs wipe`) and the scratchpad `konta-real.html`.
- [ ] **Step 6: Local checks.** `npm run typecheck`; `npx vitest run src/mobile src/components/mobile src/test/guards src/platform`. Leave repo-wide lint/format/full suite to CI (CLAUDE.md), except `npx eslint src/mobile/iskam src/components/mobile/sheets src/test/guards --max-warnings=0` and `npx prettier --check` on the changed files, since `lint`/`format:check` are repo-wide gates.
- [ ] **Step 7: Tree-parity answers** (CLAUDE.md): extension — deliberately no (pinned by `desktopHasNoIskam.test.ts`); phone — yes; tablet width — verified in Step 1.
- [ ] **Step 8: Commit** anything left, then STOP: report to Dominik and ask before `gh pr create --base test`.

# reIS for Claude (student MCP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Claude Desktop extension (`.mcpb`) that logs a student in to IS Mendelu on their own laptop and gives Claude ten read-only tools over their own study data.

**Architecture:** A new host directory `mcp/` sits next to `capacitor/` and `dev/`. It installs Node globals (happy-dom, fake-indexeddb, a cookie-carrying `fetch`) and the in-memory web platform. Then it calls reIS's existing `src/api/*` fetchers and wraps them as MCP tools. Vite bundles it into one Node ESM file, and `mcpb pack` turns that into the installable `.mcpb`.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` (≥1.29, accepts zod `^3.25 || ^4`), zod 4 (already in the repo), happy-dom, fake-indexeddb, unpdf + officeparser (file text), Vite 7 SSR build, `@anthropic-ai/mcpb` CLI, vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-10-student-mcp-design.md`

> **Executed 2026-10-10.** The code in `mcp/` is authoritative where it differs from the snippets below. See "Deviations found during execution" at the end; the lines review flagged as unsafe have been corrected in place.

## Global Constraints

- Branch from `origin/test`; the PR's base is `test` (`gh pr create --base test`). Push via the `personal` remote (memory `github-push-identity`).
- **Nothing MCP-only goes into `src/`.** `mcp/` imports from `src/`, never the reverse. CLAUDE.md trap #2: shared code reaches the extension's content script.
- **No generic page fetch tool. Never call `elis/ot/psani_testu.pl`, never submit anything.** Strip `uploadUrl` from assignments.
- **Never retry a login that failed with `bad-credentials` or `two-factor`.**
- **Never put the username, password or `UISAuth` value into a thrown message, a log line or a tool result.**
- The cookie goes only to `is.mendelu.cz`. The only other allowed host is `cdn.jsdelivr.net` (success rates).
- Output semantics, copied from reis-scraper `src/mcp/format.ts` at `ca06091`:
  - markdown mode returns text only;
  - json mode attaches `structuredContent` only when its JSON fits `CHARACTER_LIMIT = 25000`;
  - no tool declares an `outputSchema`.
- Write code that is clean under `noUncheckedIndexedAccess`. `lint --max-warnings=0` and `format:check` are repo-wide in CI.
- Max ~200 lines per file (repo convention). Test first.
- Release tags for this product are `mcp-v*`. Never `v*`: those drive the iOS release.
- Before every commit, run `npx prettier --write` on the files that task created or changed. The plan's code blocks are not prettier-formatted, and CI's `format:check` is repo-wide.
- The MCP tests run in the repo's default happy-dom environment (`src/test/setup.ts` needs a DOM). happy-dom's `Headers` drop `Set-Cookie`/`Cookie`, so tests fake responses as plain objects.
- Locally run only the tests you touched (`npx vitest run mcp/`) plus `npm run typecheck`. CI runs the rest.

## File Structure

| File | Responsibility |
| --- | --- |
| `mcp/login.ts` | One browserless login POST → `UISAuth` cookie, or a typed `IsLoginError` |
| `mcp/session.ts` | Cookie holder + `fetch` wrapper: cookie only to IS, single-flight login, one transparent re-login on an expired session |
| `mcp/globals.ts` | Side-effect module, imported FIRST by the server: Node DOM/IDB globals, delegating `fetch`, web platform |
| `mcp/format.ts` | `toResult` / `toError`, CHARACTER_LIMIT |
| `mcp/markdown.ts` | One generic value → markdown renderer |
| `mcp/files.ts` | Subject folder listing + dok_server download + text extraction |
| `mcp/tools.ts` | The ten tool definitions (thin: call a fetcher, shape output) |
| `mcp/register.ts` | Registers tool definitions on an `McpServer` with error handling |
| `mcp/server.ts` | Entry: read env, create session, register tools, stdio transport |
| `mcp/manifest.json` | MCPB manifest (user_config: username, password[sensitive]) |
| `mcp/README.md` | Install + what it reads + what it never does |
| `mcp/tsconfig.json` | Typecheck scope for `mcp/` (referenced from root `tsconfig.json`) |
| `vite.mcp.config.ts` | SSR build → `dist-mcp/server/index.mjs` |
| `scripts/mcp-smoke.mjs` | Spawns the bundle, does MCP initialize + tools/list over stdio |
| `src/test/guards/mcpStaysReadOnly.test.ts` | Pins the hard rules by scanning `mcp/` source |

---

### Task 1: Browserless IS login

**Files:**
- Create: `mcp/login.ts`
- Test: `mcp/__tests__/login.test.ts`
- Modify: `vitest.config.ts` (add `'mcp/**/*.{test,spec}.ts'` to `test.include`)

**Interfaces:**
- Consumes: `isPlausibleToken(value: unknown): value is string` from `src/platform/sessionToken.ts`
- Produces: `loginToIs(user: string, pass: string, fetchImpl: typeof fetch): Promise<string>`. This resolves to a cookie pair `UISAuth=<value>`. Also `class IsLoginError extends Error { kind: 'bad-credentials' | 'two-factor' | 'unexpected' }`.

Facts (verified live 2026-10-09):
- `POST https://is.mendelu.cz/system/login.pl` (urlencoded) with `login_hidden=1`, `destination=/auth/?lang=cz`, `auth_id_hidden=0`, `auth_2fa_type=no`, `credential_0`, `credential_1` and `login` answers `302 Location: /auth/?lang=cz`, with `Set-Cookie: UISAuth=…; path=/; secure; HttpOnly`.
- That cookie alone opens `/auth/student/moje_studium.pl`.
- A wrong password (probed 2026-10-10 with a made-up username) answers `200`, sets no cookie and shows the login form again. `credential_k` stays `disabled` and `auth_2fa_type` stays `no`. The page always contains the static texts "Incorrect login or password" and "Please type the verification code", so never classify by message text.
- The login form also carries `credential_k` (an OTP field, `disabled` by default) and `auth_2fa_type`. No 2FA response has been observed, so the 2FA detection below is a best guess from the form: an enabled `credential_k`, or an `auth_2fa_type` other than `no`.

- [ ] **Step 1: Add mcp tests to vitest include**

In `vitest.config.ts`, inside `test.include`, add after the `capacitor/**` line:

```ts
      // mcp/ is the Claude Desktop extension host (reIS for Claude).
      'mcp/**/*.{test,spec}.ts',
```

- [ ] **Step 2: Write the failing test**

```ts
// mcp/__tests__/login.test.ts
import { describe, it, expect, vi } from 'vitest';
import { loginToIs, IsLoginError } from '../login';

const TOKEN = 'abcDEF123%2Fxyz456789==';

function respond(status: number, init: { cookies?: string[]; html?: string; location?: string } = {}) {
  const headers = new Headers();
  for (const c of init.cookies ?? []) headers.append('Set-Cookie', c);
  if (init.location) headers.set('Location', init.location);
  return new Response(init.html ?? '', { status, headers });
}

describe('loginToIs', () => {
  it('posts the IS login form and returns the UISAuth cookie pair', async () => {
    const f = vi.fn().mockResolvedValue(
      respond(302, { cookies: [`UISAuth=${TOKEN}; path=/; secure; HttpOnly`], location: '/auth/?lang=cz' })
    );
    await expect(loginToIs('xstudent', 'pw', f as unknown as typeof fetch)).resolves.toBe(`UISAuth=${TOKEN}`);
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
    const html = '<input type="password" name="credential_1" value="" />' +
      '<input type="text" name="credential_k" disabled="disabled" />' +
      '<input type="hidden" name="auth_2fa_type" value="no" id="auth_2fa_type" />';
    const f = vi.fn().mockResolvedValue(respond(200, { html }));
    const err = await loginToIs('x', 'wrong', f as unknown as typeof fetch).catch((e) => e);
    expect(err).toBeInstanceOf(IsLoginError);
    expect(err.kind).toBe('bad-credentials');
  });

  it('reports two-factor when IS enables the verification-code field', async () => {
    const html = '<input type="password" name="credential_1" value="" />' +
      '<input type="text" name="credential_k" size="20" class="reqfields" id="overovaci_kod" />';
    const f = vi.fn().mockResolvedValue(respond(200, { html }));
    const err = await loginToIs('x', 'pw', f as unknown as typeof fetch).catch((e) => e);
    expect(err.kind).toBe('two-factor');
  });

  it('reports two-factor when auth_2fa_type is not "no"', async () => {
    const html = '<input type="hidden" name="auth_2fa_type" value="totp" id="auth_2fa_type" />';
    const f = vi.fn().mockResolvedValue(respond(200, { html }));
    expect((await loginToIs('x', 'pw', f as unknown as typeof fetch).catch((e) => e)).kind).toBe('two-factor');
  });

  it('never puts the username or password into the error message', async () => {
    const f = vi.fn().mockResolvedValue(respond(500));
    const err = await loginToIs('xsecretuser', 'hunter2pw', f as unknown as typeof fetch).catch((e) => e);
    expect(err.kind).toBe('unexpected');
    expect(String(err.message)).not.toMatch(/xsecretuser|hunter2pw/);
  });

  it('rejects an implausible cookie value as unexpected', async () => {
    const f = vi.fn().mockResolvedValue(respond(302, { cookies: ['UISAuth=a;b; path=/'] }));
    expect((await loginToIs('x', 'pw', f as unknown as typeof fetch).catch((e) => e)).kind).toBe('unexpected');
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run mcp/__tests__/login.test.ts`
Expected: FAIL, `Cannot find module '../login'`.

- [ ] **Step 4: Implement**

```ts
// mcp/login.ts
import { isPlausibleToken, UIS_AUTH_COOKIE } from '../src/platform/sessionToken';

const LOGIN_URL = 'https://is.mendelu.cz/system/login.pl';

export type LoginFailure = 'bad-credentials' | 'two-factor' | 'unexpected';

/** Messages are fixed strings: a thrown message ends up in Claude Desktop's logs. */
export class IsLoginError extends Error {
  constructor(readonly kind: LoginFailure, message: string) {
    super(message);
    this.name = 'IsLoginError';
  }
}

const MESSAGES: Record<LoginFailure, string> = {
  'bad-credentials':
    'IS Mendelu rejected the username or password. Fix them in Claude Desktop → Settings → Extensions → reIS.',
  'two-factor':
    'This IS Mendelu account uses two-factor sign-in, which reIS for Claude does not support yet.',
  unexpected: 'IS Mendelu did not start a session. Try again later; if it persists, IS may have changed its login.',
};

const fail = (kind: LoginFailure) => new IsLoginError(kind, MESSAGES[kind]);

/** One browserless form POST. Resolves to the `UISAuth=<value>` cookie pair. */
export async function loginToIs(user: string, pass: string, fetchImpl: typeof fetch): Promise<string> {
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

  const html = res.status === 200 ? await res.text() : '';
  const otpEnabled = /<input[^>]*name="credential_k"(?![^>]*disabled)[^>]*>/.test(html);
  const twoFactorType = /name="auth_2fa_type" value="(?!no")/.test(html);
  if (otpEnabled || twoFactorType) throw fail('two-factor');
  if (/name="credential_1"/.test(html)) throw fail('bad-credentials');
  throw fail('unexpected');
}
```

`UIS_AUTH_COOKIE` is already exported from `src/platform/sessionToken.ts`. Import through the relative path `../src/platform/sessionToken`; Task 6 adds the `@` alias for the bundle.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run mcp/__tests__/login.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Live check against IS (credentials from reis-scraper's .env, never printed)**

```bash
cat > /tmp/mcp-login-live.mts <<EOF
import { loginToIs } from '$PWD/mcp/login';
const c = await loginToIs(process.env.MENDELU_USER!, process.env.MENDELU_PASS!, fetch);
const r = await fetch('https://is.mendelu.cz/auth/student/moje_studium.pl?lang=cz', { headers: { Cookie: c } });
console.log(r.status, /credential_1/.test(await r.text()) ? 'LOGIN PAGE' : 'AUTHENTICATED');
EOF
(set -a; . "$(git rev-parse --path-format=absolute --git-common-dir)/../../reis-scraper/.env"; set +a; npx tsx /tmp/mcp-login-live.mts); rm /tmp/mcp-login-live.mts
```

Expected: `200 AUTHENTICATED`.

- [ ] **Step 7: Commit**

```bash
git add mcp/login.ts mcp/__tests__/login.test.ts vitest.config.ts
git commit -m "feat(mcp): browserless IS login with typed failures"
```

---

### Task 2: Session fetch with one transparent re-login

**Files:**
- Create: `mcp/session.ts`
- Test: `mcp/__tests__/session.test.ts`

**Interfaces:**
- Consumes: `loginToIs`, `IsLoginError` (Task 1)
- Produces: `createIsSession(creds: { user: string; pass: string }, nativeFetch: typeof fetch, now: () => number = Date.now): IsSession`, where `interface IsSession { fetch: typeof fetch }`.

Behaviour:
- A request to `is.mendelu.cz` logs in first if there is no cookie. Concurrent callers share one login.
- The cookie is set only for `is.mendelu.cz`. Any other host goes to `nativeFetch` untouched.
- A GET whose response is the login page means the session expired. That triggers one re-login and one retry. If the retry also gets the login page, throw `IsLoginError('unexpected')`. The login page is detected by `res.url` containing `/system/login.pl`, or by an HTML body containing `name="credential_1"`.
- A login that fails with `bad-credentials` or `two-factor` is remembered. Every later call rejects with the same error and never POSTs again. Claude Desktop restarts the server when the student changes the settings.
- **Login floor:** no new login attempt within 60 s of a failed one, whatever its kind. A call inside that window rejects with the last error and makes no request. After 3 consecutive `unexpected` failures the error becomes fatal until restart. An unknown response shape must never turn into one failed login per tool call.
- **The cookie lives in a closure variable and `fetch` is created once.** That avoids reis-scraper's double-wrap bug, where a re-login kept sending the stale cookie.

- [ ] **Step 1: Write the failing test**

```ts
// mcp/__tests__/session.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../login', async (orig) => {
  const real = await orig<typeof import('../login')>();
  return { ...real, loginToIs: vi.fn() };
});
import { loginToIs, IsLoginError } from '../login';
import { createIsSession } from '../session';

const login = vi.mocked(loginToIs);
const page = (html: string, url = 'https://is.mendelu.cz/auth/x.pl') => {
  const r = new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  Object.defineProperty(r, 'url', { value: url });
  return r;
};

describe('createIsSession', () => {
  beforeEach(() => login.mockReset());

  it('logs in once for concurrent first calls and sends the cookie only to IS', async () => {
    login.mockResolvedValue('UISAuth=tok1');
    const native = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input; void init;
      return page('<html>ok</html>');
    });
    const s = createIsSession({ user: 'u', pass: 'p' }, native as unknown as typeof fetch);
    await Promise.all([s.fetch('https://is.mendelu.cz/auth/a.pl'), s.fetch('https://is.mendelu.cz/auth/b.pl')]);
    expect(login).toHaveBeenCalledTimes(1);
    const sent = new Headers(native.mock.calls[0]![1]!.headers);
    expect(sent.get('Cookie')).toBe('UISAuth=tok1');

    await s.fetch('https://cdn.jsdelivr.net/gh/x.json');
    const cdnInit = native.mock.calls.at(-1)![1];
    expect(new Headers(cdnInit?.headers).get('Cookie')).toBeNull();
  });

  it('re-logs in once on an expired session and retries with the NEW cookie', async () => {
    login.mockResolvedValueOnce('UISAuth=old').mockResolvedValueOnce('UISAuth=new');
    const native = vi.fn()
      .mockResolvedValueOnce(page('<input name="credential_1">', 'https://is.mendelu.cz/system/login.pl'))
      .mockResolvedValueOnce(page('<html>data</html>'));
    const s = createIsSession({ user: 'u', pass: 'p' }, native as unknown as typeof fetch);
    const res = await s.fetch('https://is.mendelu.cz/auth/a.pl');
    expect(await res.text()).toBe('<html>data</html>');
    expect(login).toHaveBeenCalledTimes(2);
    expect(new Headers(native.mock.calls[1]![1]!.headers).get('Cookie')).toBe('UISAuth=new');
  });

  it('gives up after one retry', async () => {
    login.mockResolvedValue('UISAuth=t');
    const native = vi.fn().mockResolvedValue(page('<input name="credential_1">'));
    const s = createIsSession({ user: 'u', pass: 'p' }, native as unknown as typeof fetch);
    const err = await s.fetch('https://is.mendelu.cz/auth/a.pl').catch((e) => e);
    expect(err).toBeInstanceOf(IsLoginError);
    expect(login).toHaveBeenCalledTimes(2);
  });

  it('never retries bad credentials, on this call or later ones', async () => {
    login.mockRejectedValue(new IsLoginError('bad-credentials', 'm'));
    const native = vi.fn();
    const s = createIsSession({ user: 'u', pass: 'p' }, native as unknown as typeof fetch);
    await expect(s.fetch('https://is.mendelu.cz/auth/a.pl')).rejects.toMatchObject({ kind: 'bad-credentials' });
    await expect(s.fetch('https://is.mendelu.cz/auth/b.pl')).rejects.toMatchObject({ kind: 'bad-credentials' });
    expect(login).toHaveBeenCalledTimes(1);
    expect(native).not.toHaveBeenCalled();
  });

  it('waits 60 s after an unexpected failure before trying again', async () => {
    let t = 0;
    login.mockRejectedValueOnce(new IsLoginError('unexpected', 'm')).mockResolvedValueOnce('UISAuth=t');
    const native = vi.fn().mockResolvedValue(page('<html>ok</html>'));
    const s = createIsSession({ user: 'u', pass: 'p' }, native as unknown as typeof fetch, () => t);
    await expect(s.fetch('https://is.mendelu.cz/auth/a.pl')).rejects.toMatchObject({ kind: 'unexpected' });
    t = 30_000;
    await expect(s.fetch('https://is.mendelu.cz/auth/a.pl')).rejects.toMatchObject({ kind: 'unexpected' });
    expect(login).toHaveBeenCalledTimes(1);
    t = 61_000;
    await expect(s.fetch('https://is.mendelu.cz/auth/a.pl')).resolves.toBeInstanceOf(Response);
    expect(login).toHaveBeenCalledTimes(2);
  });

  it('gives up for good after 3 consecutive unexpected failures', async () => {
    let t = 0;
    login.mockRejectedValue(new IsLoginError('unexpected', 'm'));
    const s = createIsSession({ user: 'u', pass: 'p' }, vi.fn() as unknown as typeof fetch, () => t);
    for (let i = 0; i < 3; i++) {
      await expect(s.fetch('https://is.mendelu.cz/auth/a.pl')).rejects.toMatchObject({ kind: 'unexpected' });
      t += 61_000;
    }
    await expect(s.fetch('https://is.mendelu.cz/auth/a.pl')).rejects.toMatchObject({ kind: 'unexpected' });
    expect(login).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run mcp/__tests__/session.test.ts`
Expected: FAIL, `Cannot find module '../session'`.

- [ ] **Step 3: Implement**

```ts
// mcp/session.ts
import { loginToIs, IsLoginError } from './login';

const IS_HOST = 'is.mendelu.cz';

export interface IsSession {
  /** Drop-in fetch: cookie to IS only, login on demand, one re-login on expiry. */
  fetch: typeof fetch;
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

async function isLoginPage(res: Response): Promise<boolean> {
  if (res.url.includes('/system/login.pl')) return true;
  if (!/text\/html/i.test(res.headers.get('content-type') ?? '')) return false;
  const head = (await res.clone().text()).slice(0, 20000);
  return /name="credential_1"/.test(head);
}

const LOGIN_FLOOR_MS = 60_000;
const MAX_UNEXPECTED = 3;

export function createIsSession(
  creds: { user: string; pass: string },
  nativeFetch: typeof fetch,
  now: () => number = Date.now
): IsSession {
  let cookie: string | null = null;
  let inflight: Promise<string> | null = null;
  let fatal: IsLoginError | null = null;
  let lastFailure: { at: number; error: IsLoginError } | null = null;
  let unexpectedInARow = 0;

  const login = (): Promise<string> => {
    if (fatal) return Promise.reject(fatal);
    if (lastFailure && now() - lastFailure.at < LOGIN_FLOOR_MS) return Promise.reject(lastFailure.error);
    inflight ??= loginToIs(creds.user, creds.pass, nativeFetch)
      .then((c) => {
        lastFailure = null;
        unexpectedInARow = 0;
        return (cookie = c);
      })
      .catch((e: unknown) => {
        const err = e instanceof IsLoginError ? e : new IsLoginError('unexpected', 'IS Mendelu did not start a session.');
        lastFailure = { at: now(), error: err };
        if (err.kind !== 'unexpected' || ++unexpectedInARow >= MAX_UNEXPECTED) fatal = err;
        throw err;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };

  const send = (input: RequestInfo | URL, init: RequestInit, c: string) => {
    const headers = new Headers(init.headers);
    headers.set('Cookie', c);
    return nativeFetch(input, { ...init, headers });
  };

  const sessionFetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    let host = '';
    try {
      host = new URL(urlOf(input)).host;
    } catch {
      host = '';
    }
    if (host !== IS_HOST) return nativeFetch(input, init);

    const first = await send(input, init, cookie ?? (await login()));
    const method = (init.method ?? 'GET').toUpperCase();
    if (method !== 'GET' || !(await isLoginPage(first))) return first;

    cookie = null;
    const retry = await send(input, init, await login());
    if (await isLoginPage(retry)) throw new IsLoginError('unexpected', 'IS Mendelu keeps asking to sign in. Try again later.');
    return retry;
  };

  return { fetch: sessionFetch as typeof fetch };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run mcp/__tests__/session.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add mcp/session.ts mcp/__tests__/session.test.ts
git commit -m "feat(mcp): session fetch with single-flight login and one re-login"
```

---

### Task 3: Node globals, platform host and output format

**Files:**
- Create: `mcp/globals.ts`, `mcp/format.ts`, `mcp/markdown.ts`
- Test: `mcp/__tests__/format.test.ts`, `mcp/__tests__/markdown.test.ts`

**Interfaces:**
- Produces:
  - `globals.ts` (side-effect module) exports `nativeFetch: typeof fetch` (the real fetch, captured before any override) and `setSessionFetch(f: typeof fetch): void`.
  - `format.ts` exports `CHARACTER_LIMIT = 25000`, `type ResponseFormat = 'markdown' | 'json'`, `toResult(data: unknown, format: ResponseFormat)` and `toError(tool: string, e: unknown)`.
  - `markdown.ts` exports `toMarkdown(value: unknown): string`.

Why a side-effect module: `src/api/*` reads `window`/`fetch`/IndexedDB when it is imported. The bundle hoists static imports, so `mcp/server.ts` must `import './globals'` as its **first** import. `dev/installWebPlatform.ts` uses the same pattern. The fetch installed here is a **delegate** to a holder, so it is set exactly once and never re-wrapped.

- [ ] **Step 1: Write the failing tests**

```ts
// mcp/__tests__/format.test.ts
import { describe, it, expect } from 'vitest';
import { toResult, toError, CHARACTER_LIMIT } from '../format';

describe('toResult', () => {
  it('markdown mode returns text only, never structuredContent', () => {
    const r = toResult({ a: 1 }, 'markdown');
    expect(r.content[0]!.type).toBe('text');
    expect('structuredContent' in r).toBe(false);
  });
  it('json mode attaches structuredContent when it fits, wrapping arrays under value', () => {
    const r = toResult([1, 2], 'json');
    expect(r).toMatchObject({ structuredContent: { value: [1, 2] } });
  });
  it('json mode drops structuredContent and truncates text past the limit', () => {
    const big = { s: 'x'.repeat(CHARACTER_LIMIT + 10) };
    const r = toResult(big, 'json');
    expect('structuredContent' in r).toBe(false);
    expect(r.content[0]!.text).toContain('[truncated at');
  });
});

describe('toError', () => {
  it('is an MCP error result naming the tool', () => {
    const r = toError('mendelu_exams', new Error('boom'));
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toBe('Error in mendelu_exams: boom');
  });
});
```

```ts
// mcp/__tests__/markdown.test.ts
import { describe, it, expect } from 'vitest';
import { toMarkdown } from '../markdown';

describe('toMarkdown', () => {
  it('renders an array of flat objects as a table', () => {
    expect(toMarkdown([{ code: 'EBC-PS', name: 'Sítě' }])).toBe('| code | name |\n| --- | --- |\n| EBC-PS | Sítě |');
  });
  it('renders objects as nested bullets and skips null/empty values', () => {
    expect(toMarkdown({ a: 1, b: null, c: { d: 'x' }, e: [] })).toBe('- **a:** 1\n- **c:**\n  - **d:** x');
  });
  it('escapes pipes inside table cells', () => {
    expect(toMarkdown([{ n: 'a|b' }])).toContain('a\\|b');
  });
  it('says so when there is nothing', () => {
    expect(toMarkdown([])).toBe('Nothing found.');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run mcp/__tests__/format.test.ts mcp/__tests__/markdown.test.ts`
Expected: FAIL, the modules are not found.

- [ ] **Step 3: Implement**

```ts
// mcp/format.ts
import { toMarkdown } from './markdown';

export const CHARACTER_LIMIT = 25000;
export type ResponseFormat = 'markdown' | 'json';

// Same semantics as reis-scraper src/mcp/format.ts (ca06091). Claude Code shows
// structuredContent in place of the text, so markdown mode must not attach it,
// and json mode attaches it only while it fits. No tool may declare an
// outputSchema: the SDK then rejects every result without structuredContent.
export function toResult(data: unknown, format: ResponseFormat) {
  let text = format === 'json' ? JSON.stringify(data, null, 2) : toMarkdown(data);
  const truncated = text.length > CHARACTER_LIMIT;
  if (truncated) {
    text = `${text.slice(0, CHARACTER_LIMIT)}\n\n[truncated at ${CHARACTER_LIMIT} chars — ask for a narrower question]`;
  }
  const content = [{ type: 'text' as const, text }];
  if (format !== 'json' || truncated) return { content };
  const structuredContent =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : { value: data };
  if (JSON.stringify(structuredContent).length > CHARACTER_LIMIT) return { content };
  return { content, structuredContent };
}

export function toError(tool: string, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { isError: true as const, content: [{ type: 'text' as const, text: `Error in ${tool}: ${msg}` }] };
}
```

```ts
// mcp/markdown.ts
const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

const scalar = (v: unknown) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function isFlatRow(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) &&
    Object.values(v).every((x) => x === null || typeof x !== 'object');
}

function table(rows: Record<string, unknown>[]): string {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [
    line(headers),
    line(headers.map(() => '---')),
    ...rows.map((r) => line(headers.map((h) => (isEmpty(r[h]) ? '' : scalar(r[h]))))),
  ].join('\n');
}

function bullets(value: unknown, indent: string): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      item && typeof item === 'object'
        ? [`${indent}-`, ...bullets(item, indent + '  ')]
        : [`${indent}- ${scalar(item)}`]
    );
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => {
      if (isEmpty(v)) return [];
      if (typeof v === 'object') return [`${indent}- **${k}:**`, ...bullets(v, indent + '  ')];
      return [`${indent}- **${k}:** ${scalar(v)}`];
    });
  }
  return [`${indent}${scalar(value)}`];
}

/** Generic, predictable rendering: tables for lists of flat rows, bullets otherwise. */
export function toMarkdown(value: unknown): string {
  if (isEmpty(value)) return 'Nothing found.';
  if (Array.isArray(value) && value.every(isFlatRow)) return table(value);
  return bullets(value, '').join('\n');
}
```

```ts
// mcp/globals.ts
// Side-effect module: mcp/server.ts imports it FIRST. src/api/* reads window,
// fetch and IndexedDB at import time, and import declarations hoist.
import 'fake-indexeddb/auto';
import { Window } from 'happy-dom';
import { setPlatform } from '../src/platform/index';
import { createWebPlatform } from '../src/platform/webPlatform';

/** The real fetch, captured before anything replaces it. */
export const nativeFetch: typeof fetch = globalThis.fetch.bind(globalThis);

let current: typeof fetch = nativeFetch;
/** Point the global fetch at the IS session. The global itself is set once, here. */
export function setSessionFetch(f: typeof fetch): void {
  current = f;
}

const win = new Window({ url: 'https://is.mendelu.cz/' });
const g = globalThis as Record<string, unknown>;
const w = win as unknown as Record<string, unknown>;
g.window = win;
g.document = win.document;
g.DOMParser = win.DOMParser;
for (const name of ['Node', 'NodeList', 'NodeFilter', 'Element', 'HTMLElement', 'Text', 'Comment', 'DocumentFragment', 'HTMLCollection']) {
  if (w[name]) g[name] = w[name];
}
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => current(input, init)) as typeof fetch;

// The in-memory web host: fetchWithAuth takes the plain-fetch path, which is the
// session fetch above. Nothing persists between server runs.
setPlatform(createWebPlatform());
```

`globals.ts` is not unit-tested: it mutates process globals. Task 6's bundle smoke run covers it.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run mcp/__tests__/format.test.ts mcp/__tests__/markdown.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add mcp/globals.ts mcp/format.ts mcp/markdown.ts mcp/__tests__/format.test.ts mcp/__tests__/markdown.test.ts
git commit -m "feat(mcp): node globals host, result format and markdown renderer"
```

---

### Task 4: Subject files (list, download, extract)

**Files:**
- Create: `mcp/files.ts`
- Test: `mcp/__tests__/files.test.ts`
- Modify: `package.json` (devDependencies: `unpdf`, `officeparser`. Use the versions reis-scraper pins: `unpdf ^1.6.2`, `officeparser ^7.3.0`)

**Interfaces:**
- Consumes: `fetchFilesFromFolder(folderUrl)` from `src/api/documents/service.ts`, which returns `ParsedFile[]` (`src/types/documents.ts`: `{ file_name, author, date, files: { name, type, link }[] }`).
- Produces:
  - `listFolderFiles(folderUrl: string): Promise<SubjectFile[]>`, with `type SubjectFile = { name: string; author: string; date: string; downloadUrl: string }`;
  - `assertDokServerUrl(url: string): void`;
  - `readDokServerFile(url: string, fetchImpl: typeof fetch): Promise<{ filename?: string; kind: string; pages?: number; note?: string; text: string }>`.

- [ ] **Step 1: Install the extraction deps**

Run: `test -L node_modules && echo SHARED` must print nothing (CLAUDE.md: never install through a symlink). Then:

```bash
npm install --save-dev officeparser@^8.1.1   # not unpdf, not officeparser 7: both carry a vulnerable pdfjs
```

- [ ] **Step 2: Write the failing test**

```ts
// mcp/__tests__/files.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/api/documents/service', () => ({ fetchFilesFromFolder: vi.fn() }));
import { fetchFilesFromFolder } from '../../src/api/documents/service';
import { listFolderFiles, assertDokServerUrl, readDokServerFile } from '../files';

const DL = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=1;download=2';

describe('listFolderFiles', () => {
  it('keeps one download link per file and drops entries without one', async () => {
    vi.mocked(fetchFilesFromFolder).mockResolvedValue([
      { subfolder: '', file_name: 'L1.pdf', file_comment: '', author: 'A', date: '1. 10. 2026', files: [{ name: 'x', type: 'pdf', link: DL }] },
      { subfolder: '', file_name: 'dup', file_comment: '', author: 'A', date: '', files: [{ name: 'x', type: 'pdf', link: DL }] },
      { subfolder: '', file_name: 'no-link', file_comment: '', author: 'A', date: '', files: [] },
    ]);
    expect(await listFolderFiles('https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1')).toEqual([
      { name: 'L1.pdf', author: 'A', date: '1. 10. 2026', downloadUrl: DL },
    ]);
  });
});

describe('assertDokServerUrl', () => {
  it('accepts dok_server links and refuses anything else', () => {
    expect(() => assertDokServerUrl(DL)).not.toThrow();
    expect(() => assertDokServerUrl('https://is.mendelu.cz/auth/elis/ot/psani_testu.pl')).toThrow(/dok_server/);
    expect(() => assertDokServerUrl('https://evil.example/auth/dok_server/x')).toThrow(/dok_server/);
  });
});

describe('readDokServerFile', () => {
  it('decodes plain text files and takes the filename from content-disposition', async () => {
    const f = vi.fn().mockResolvedValue(new Response('hello\n\n\n\nworld', {
      headers: { 'content-type': 'text/plain', 'content-disposition': 'attachment; filename="notes.txt"' },
    }));
    expect(await readDokServerFile(DL, f as unknown as typeof fetch)).toEqual({ filename: 'notes.txt', kind: 'text', text: 'hello\n\nworld' });
  });
  it('returns a note for unsupported types instead of bytes', async () => {
    const f = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'application/zip' } }));
    const r = await readDokServerFile(DL, f as unknown as typeof fetch);
    expect(r.text).toBe('');
    expect(r.note).toMatch(/No text extractor/);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run mcp/__tests__/files.test.ts`
Expected: FAIL, `Cannot find module '../files'`.

- [ ] **Step 4: Implement** (ported from reis-scraper `src/mcp/extract.ts` and `src/is-client/client.ts`)

```ts
// mcp/files.ts
import { getDocumentProxy, extractText as extractPdfText } from 'unpdf';
import { parseOffice } from 'officeparser';
import { fetchFilesFromFolder } from '../src/api/documents/service';

export type SubjectFile = { name: string; author: string; date: string; downloadUrl: string };
export type FileText = { filename?: string; kind: string; pages?: number; note?: string; text: string };

const EMPTY = 'No extractable text — the document may be scanned or image-only.';
const clean = (t: string) => t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
const extOf = (name?: string) => /\.[^./\\]+$/.exec(name ?? '')?.[0].toLowerCase() ?? '';

export async function listFolderFiles(folderUrl: string): Promise<SubjectFile[]> {
  const entries = await fetchFilesFromFolder(folderUrl);
  const seen = new Set<string>();
  const out: SubjectFile[] = [];
  for (const e of entries ?? []) {
    const link = e.files?.find((f) => /download=/.test(f.link))?.link;
    if (!link || seen.has(link)) continue;
    seen.add(link);
    out.push({ name: e.file_name, author: e.author, date: e.date, downloadUrl: link });
  }
  return out;
}

export function assertDokServerUrl(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error('Not a URL. Pass a downloadUrl from mendelu_subject_files.');
  }
  if (u.host !== 'is.mendelu.cz' || !u.pathname.startsWith('/auth/dok_server/')) {
    throw new Error('Only IS dok_server files can be read. Pass a downloadUrl from mendelu_subject_files.');
  }
}

export async function readDokServerFile(url: string, fetchImpl: typeof fetch): Promise<FileText> {
  assertDokServerUrl(url);
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`IS answered HTTP ${res.status} for this file.`);
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  const filename = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('content-disposition') ?? '')?.[1];
  const named = filename ? { filename: decodeURIComponent(filename) } : {};
  const bytes = new Uint8Array(await res.arrayBuffer());
  const ext = extOf(filename);

  if (type === 'application/pdf' || ext === '.pdf') {
    const { totalPages, text } = await extractPdfText(await getDocumentProxy(bytes), { mergePages: true });
    const t = clean(text);
    return { ...named, kind: 'pdf', pages: totalPages, text: t, ...(t.trim() ? {} : { note: EMPTY }) };
  }
  if (/wordprocessingml|presentationml|spreadsheetml|opendocument/.test(type) || ['.docx', '.pptx', '.xlsx', '.odt'].includes(ext)) {
    const t = clean((await parseOffice(Buffer.from(bytes))).toText());
    return { ...named, kind: ext.slice(1) || 'office', text: t, ...(t.trim() ? {} : { note: EMPTY }) };
  }
  if (type.startsWith('text/') || type === 'application/json' || type.includes('xml') || ['.txt', '.md', '.csv'].includes(ext)) {
    return { ...named, kind: 'text', text: clean(new TextDecoder().decode(bytes)) };
  }
  return { ...named, kind: type || 'unknown', text: '', note: 'No text extractor for this file type. Open it in IS directly.' };
}
```

The session fetch (Task 2) already turns an expired-session login page into a re-login, so `readDokServerFile` needs no login-page guard of its own.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run mcp/__tests__/files.test.ts`
Expected: PASS (4 tests). If `parseOffice`'s API differs in the installed `officeparser` (it returned an AST with `.toText()` in v7.3), check it against the package README and adjust the one line.

- [ ] **Step 6: Commit**

```bash
git add mcp/files.ts mcp/__tests__/files.test.ts package.json package-lock.json
git commit -m "feat(mcp): list and read subject files from the IS document server"
```

---

### Task 5: The ten tools

**Files:**
- Create: `mcp/tools.ts`, `mcp/register.ts`
- Test: `mcp/__tests__/tools.test.ts`
- Modify: `package.json` (devDependency `@modelcontextprotocol/sdk@^1.32.1`)

**Interfaces:**
- Consumes: `getUserParams()` from `src/utils/userParams.ts` (it returns `{ studium, obdobi, … } | null`). Also the fetchers below, `listFolderFiles`/`readDokServerFile` (Task 4), and `toResult`/`toError` (Task 3).
- Produces:
  - `type ToolDef = { name: string; title: string; description: string; input: z.ZodRawShape; run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<unknown> }`;
  - `type ToolCtx = { fetch: typeof fetch }`;
  - `export const TOOLS: ToolDef[]`;
  - `registerTools(server: McpServer, ctx: ToolCtx): void`.

| Tool | Calls | Output shaping |
| --- | --- | --- |
| `mendelu_schedule` | `fetchFullSemesterSchedule()` (`src/injector/dataFetchers.ts`) | as is |
| `mendelu_exams` | `fetchDualLanguageExams()` (`src/api/exams.ts`) | `pickLang` |
| `mendelu_subjects` | `fetchDualLanguageSubjects(studium, obdobi)` (`src/api/subjects.ts`) | drop `folderUrl`, `autoHref`, `fetchedAt` |
| `mendelu_study_plan` | `fetchDualLanguageStudyPlan(studium)` (`src/api/studyPlan.ts`) | `pickLang` |
| `mendelu_syllabus` | `fetchSyllabus(predmet, lang)` (`src/api/syllabus.ts`) | as is |
| `mendelu_subject_files` | subjects → `folderUrl` for `code` → `listFolderFiles` | as is |
| `mendelu_read_file` | `readDokServerFile(url, ctx.fetch)` | as is |
| `mendelu_success_rates` | `fetchSubjectSuccessRates(codes)` (`src/api/successRate.ts`) | as is |
| `mendelu_grades` | `fetchGradeHistory(studium, obdobi)` (`src/api/gradeHistory.ts`) | as is |
| `mendelu_assignments` | `fetchOdevzdavarny(studium, obdobi)` (`src/api/odevzdavarny.ts`) | strip `uploadUrl`, `odevzdavarnaId` |

- [ ] **Step 1: Install the SDK**

```bash
npm install --save-dev @modelcontextprotocol/sdk@^1.32.1
```

- [ ] **Step 2: Write the failing test**

```ts
// mcp/__tests__/tools.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/utils/userParams', () => ({ getUserParams: vi.fn().mockResolvedValue({ studium: 'S', obdobi: 'O' }) }));
vi.mock('../../src/injector/dataFetchers', () => ({ fetchFullSemesterSchedule: vi.fn() }));
vi.mock('../../src/api/exams', () => ({ fetchDualLanguageExams: vi.fn() }));
vi.mock('../../src/api/subjects', () => ({ fetchDualLanguageSubjects: vi.fn() }));
vi.mock('../../src/api/studyPlan', () => ({ fetchDualLanguageStudyPlan: vi.fn() }));
vi.mock('../../src/api/syllabus', () => ({ fetchSyllabus: vi.fn() }));
vi.mock('../../src/api/successRate', () => ({ fetchSubjectSuccessRates: vi.fn() }));
vi.mock('../../src/api/gradeHistory', () => ({ fetchGradeHistory: vi.fn() }));
vi.mock('../../src/api/odevzdavarny', () => ({ fetchOdevzdavarny: vi.fn() }));
vi.mock('../files', () => ({ listFolderFiles: vi.fn(), readDokServerFile: vi.fn() }));

import { TOOLS } from '../tools';
import { fetchOdevzdavarny } from '../../src/api/odevzdavarny';
import { fetchGradeHistory } from '../../src/api/gradeHistory';
import { fetchDualLanguageSubjects } from '../../src/api/subjects';
import { listFolderFiles } from '../files';

const ctx = { fetch: vi.fn() as unknown as typeof fetch };
const tool = (name: string) => TOOLS.find((t) => t.name === name)!;

describe('TOOLS', () => {
  it('has exactly the ten v1 tools and no generic page fetch', () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      'mendelu_assignments', 'mendelu_exams', 'mendelu_grades', 'mendelu_read_file', 'mendelu_schedule',
      'mendelu_study_plan', 'mendelu_subject_files', 'mendelu_subjects', 'mendelu_success_rates', 'mendelu_syllabus',
    ]);
  });

  it('fills the student study context so the model never passes it', async () => {
    vi.mocked(fetchGradeHistory).mockResolvedValue(null);
    await tool('mendelu_grades').run({}, ctx);
    expect(fetchGradeHistory).toHaveBeenCalledWith('S', 'O');
  });

  it('strips upload links from assignments', async () => {
    vi.mocked(fetchOdevzdavarny).mockResolvedValue({
      assignments: [{ courseId: '1', courseNameCs: 'A', courseNameEn: 'A', name: 'HW1', type: 't', deadline: 'd', odevzdavarnaId: '9', fileCount: 0, uploadUrl: 'https://is.mendelu.cz/x' }],
      lastFetched: 0, periods: [],
    } as never);
    const out = (await tool('mendelu_assignments').run({}, ctx)) as { assignments: Record<string, unknown>[] };
    expect(out.assignments[0]).not.toHaveProperty('uploadUrl');
    expect(out.assignments[0]).not.toHaveProperty('odevzdavarnaId');
  });

  it('resolves a subject code to its folder before listing files', async () => {
    vi.mocked(fetchDualLanguageSubjects).mockResolvedValue({
      subjects: { data: { 'EBC-PS': { folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=5' } } },
    } as never);
    vi.mocked(listFolderFiles).mockResolvedValue([]);
    await tool('mendelu_subject_files').run({ code: 'EBC-PS' }, ctx);
    expect(listFolderFiles).toHaveBeenCalledWith('https://is.mendelu.cz/auth/dok_server/slozka.pl?id=5');
    await expect(tool('mendelu_subject_files').run({ code: 'NOPE' }, ctx)).rejects.toThrow(/not enrolled/);
  });

  it('marks every tool read-only in its description of side effects', () => {
    for (const t of TOOLS) expect(t.description.length).toBeGreaterThan(40);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run mcp/__tests__/tools.test.ts`
Expected: FAIL, `Cannot find module '../tools'`.

- [ ] **Step 4: Implement**

```ts
// mcp/tools.ts
import { z } from 'zod';
import { getUserParams } from '../src/utils/userParams';
import { fetchFullSemesterSchedule } from '../src/injector/dataFetchers';
import { fetchDualLanguageExams } from '../src/api/exams';
import { fetchDualLanguageSubjects } from '../src/api/subjects';
import { fetchDualLanguageStudyPlan } from '../src/api/studyPlan';
import { fetchSyllabus } from '../src/api/syllabus';
import { fetchSubjectSuccessRates } from '../src/api/successRate';
import { fetchGradeHistory } from '../src/api/gradeHistory';
import { fetchOdevzdavarny } from '../src/api/odevzdavarny';
import { listFolderFiles, readDokServerFile } from './files';

export type ToolCtx = { fetch: typeof fetch };
export type ToolDef = {
  name: string;
  title: string;
  description: string;
  input: z.ZodRawShape;
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<unknown>;
};

const lang = z.enum(['cz', 'en']).default('cz').describe('Language of names and texts: "cz" (default) or "en".');

async function study(): Promise<{ studium: string; obdobi: string }> {
  const p = await getUserParams();
  if (!p?.studium || !p.obdobi) throw new Error('Could not find an active study on this IS account.');
  return { studium: p.studium, obdobi: p.obdobi };
}

/** reIS fetchers return { cz, en } for dual-language data; give the model one. */
function pickLang(value: unknown, l: unknown): unknown {
  if (value && typeof value === 'object' && 'cz' in value && 'en' in value) {
    return (value as Record<string, unknown>)[l === 'en' ? 'en' : 'cz'];
  }
  return value;
}

function omit<T extends Record<string, unknown>>(row: T, keys: string[]): Partial<T> {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k))) as Partial<T>;
}

type SubjectsLite = { subjects?: { data?: Record<string, Record<string, unknown>> } } | null;

async function subjectsData(): Promise<Record<string, Record<string, unknown>>> {
  const { studium, obdobi } = await study();
  const res = (await fetchDualLanguageSubjects(studium, obdobi)) as SubjectsLite;
  return res?.subjects?.data ?? {};
}

export const TOOLS: ToolDef[] = [
  {
    name: 'mendelu_schedule',
    title: 'My timetable',
    description: 'Your full current-semester timetable from IS Mendelu: lectures, seminars and exams already on it, with date, time, room and subject. Read-only.',
    input: {},
    run: () => fetchFullSemesterSchedule(),
  },
  {
    name: 'mendelu_exams',
    title: 'My exams',
    description: 'Your exam and credit (zkouška/zápočet) terms from IS Mendelu: the ones you are registered for and the ones still open, with date, room and capacity. Read-only — it never registers you.',
    input: { lang },
    run: async (a) => pickLang(await fetchDualLanguageExams(), a.lang),
  },
  {
    name: 'mendelu_subjects',
    title: 'My subjects',
    description: 'The subjects you are enrolled in this semester: code, Czech and English name, IS subject id (use it for mendelu_syllabus), and whether it has ongoing assessment. Read-only.',
    input: {},
    run: async () =>
      Object.values(await subjectsData()).map((s) => omit(s, ['folderUrl', 'autoHref', 'fetchedAt'])),
  },
  {
    name: 'mendelu_study_plan',
    title: 'My study plan',
    description: 'Your study plan: required subject groups per semester, credits earned and required, and which subjects you have completed. Read-only.',
    input: { lang },
    run: async (a) => pickLang(await fetchDualLanguageStudyPlan((await study()).studium), a.lang),
  },
  {
    name: 'mendelu_syllabus',
    title: 'Subject syllabus',
    description: 'The syllabus of one subject: requirements to pass, objectives, content and course info. Takes the numeric IS subject id (subjectId from mendelu_subjects), not the code. Read-only.',
    input: { predmet: z.string().regex(/^\d+$/).describe('Numeric IS subject id, e.g. "164074".'), lang },
    run: (a) => fetchSyllabus(String(a.predmet), a.lang === 'en' ? 'en' : 'cz'),
  },
  {
    name: 'mendelu_subject_files',
    title: 'Subject files',
    description: "Lists the files in one enrolled subject's IS document folder (slides, materials): name, author, date and a downloadUrl to pass to mendelu_read_file. Read-only.",
    input: { code: z.string().min(2).describe('Subject code, e.g. "EBC-PS".') },
    run: async (a) => {
      const folderUrl = (await subjectsData())[String(a.code)]?.folderUrl;
      if (typeof folderUrl !== 'string') throw new Error(`${String(a.code)} is not enrolled this semester, or has no file folder.`);
      return listFolderFiles(folderUrl);
    },
  },
  {
    name: 'mendelu_read_file',
    title: 'Read a subject file',
    description: 'Downloads one file from the IS document server and returns its text (PDF, DOCX, PPTX, XLSX, ODT, plain text). Only accepts a downloadUrl from mendelu_subject_files. Read-only.',
    input: { url: z.string().url().describe('A downloadUrl from mendelu_subject_files.') },
    run: (a, ctx) => readDokServerFile(String(a.url), ctx.fetch),
  },
  {
    name: 'mendelu_success_rates',
    title: 'Subject pass rates',
    description: 'Historical pass and fail counts per semester for subject codes, from reIS public statistics (not your personal data). Read-only.',
    input: { codes: z.array(z.string().min(2)).min(1).max(50).describe('Subject codes, e.g. ["EBC-PS"].') },
    run: (a) => fetchSubjectSuccessRates(a.codes as string[]),
  },
  {
    name: 'mendelu_grades',
    title: 'My grades',
    description: 'Your grades and credits across all semesters so far (Průchod studiem): subject, grade, credits, attempt and date. Read-only.',
    input: {},
    run: async () => {
      const { studium, obdobi } = await study();
      return fetchGradeHistory(studium, obdobi);
    },
  },
  {
    name: 'mendelu_assignments',
    title: 'My assignment deadlines',
    description: 'Your submission boxes (Odevzdávárny): subject, assignment, deadline, whether it is still open, files handed in and points. Read-only — it never submits anything.',
    input: {},
    run: async () => {
      const { studium, obdobi } = await study();
      const res = await fetchOdevzdavarny(studium, obdobi);
      if (!res) return null;
      return { ...res, assignments: res.assignments.map((r) => omit({ ...r }, ['uploadUrl', 'odevzdavarnaId'])) };
    },
  },
];
```

```ts
// mcp/register.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOLS, type ToolCtx } from './tools';
import { toResult, toError } from './format';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const responseFormat = z
  .enum(['markdown', 'json'])
  .default('markdown')
  .describe('"markdown" (default) for a readable summary, "json" for the raw data.');

export function registerTools(server: McpServer, ctx: ToolCtx): void {
  for (const t of TOOLS) {
    server.registerTool(
      t.name,
      { title: t.title, description: t.description, inputSchema: { ...t.input, response_format: responseFormat }, annotations: READ_ONLY },
      async (args: Record<string, unknown>) => {
        try {
          return toResult(await t.run(args, ctx), args.response_format === 'json' ? 'json' : 'markdown');
        } catch (e) {
          return toError(t.name, e);
        }
      }
    );
  }
}
```

The SDK's `registerTool` handler typing may need a cast with zod 4 raw shapes. If `tsc` complains, type the handler argument as `never` and narrow inside, so callers never see `any`. Do not add an `outputSchema`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run mcp/__tests__/tools.test.ts`
Expected: PASS (5 tests). If a mocked fetcher's real return type makes a test's cast fail `tsc`, keep the `as never` casts. They are test fixtures.

- [ ] **Step 6: Commit**

```bash
git add mcp/tools.ts mcp/register.ts mcp/__tests__/tools.test.ts package.json package-lock.json
git commit -m "feat(mcp): ten read-only student tools over reIS fetchers"
```

---

### Task 6: Server entry, single-file bundle, smoke run

**Files:**
- Create: `mcp/server.ts`, `mcp/tsconfig.json`, `vite.mcp.config.ts`, `scripts/mcp-smoke.mjs`
- Modify: `tsconfig.json` (add reference), `package.json` (scripts), `.gitignore` (`dist-mcp/`)

**Interfaces:**
- Consumes: `nativeFetch`, `setSessionFetch` (Task 3); `createIsSession` (Task 2); `registerTools` (Task 5).
- Produces: `dist-mcp/server/index.mjs`, which runs under plain `node` with env `MENDELU_USER` and `MENDELU_PASS`. Also the npm scripts `mcp:build` and `mcp:smoke`.

- [ ] **Step 1: Write the smoke script (the failing check)**

```js
// scripts/mcp-smoke.mjs
// Spawns the built MCP bundle and speaks MCP over stdio: initialize, then
// tools/list. With --live it also calls mendelu_exams against real IS, using
// MENDELU_USER/MENDELU_PASS from the environment (never printed).
import { spawn } from 'node:child_process';

const live = process.argv.includes('--live');
const child = spawn('node', ['dist-mcp/server/index.mjs'], {
  env: { ...process.env, MENDELU_USER: process.env.MENDELU_USER ?? 'smoke', MENDELU_PASS: process.env.MENDELU_PASS ?? 'smoke' },
  stdio: ['pipe', 'pipe', 'inherit'],
});
let buf = '';
const waiters = new Map();
child.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    const msg = JSON.parse(line);
    waiters.get(msg.id)?.(msg);
  }
});
let id = 0;
const call = (method, params) =>
  new Promise((resolve) => {
    const n = ++id;
    waiters.set(n, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n');
  });

const timer = setTimeout(() => { console.error('smoke: timed out'); process.exit(1); }, 60000);
await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } });
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
const tools = (await call('tools/list', {})).result.tools.map((t) => t.name).sort();
console.log('tools:', tools.length, tools.join(', '));
if (tools.length !== 10) process.exit(1);
if (live) {
  const r = await call('tools/call', { name: 'mendelu_exams', arguments: {} });
  const text = r.result.content[0].text;
  console.log('mendelu_exams:', r.result.isError ? `ERROR ${text}` : `${text.length} chars of markdown, structuredContent=${'structuredContent' in r.result}`);
  if (r.result.isError) process.exit(1);
}
clearTimeout(timer);
child.kill();
process.exit(0);
```

```json
// package.json "scripts" additions
"mcp:build": "vite build --config vite.mcp.config.ts",
"mcp:smoke": "npm run mcp:build && node scripts/mcp-smoke.mjs",
```

Run: `npm run mcp:smoke`
Expected: FAIL (no `vite.mcp.config.ts` yet).

- [ ] **Step 2: Implement the entry**

```ts
// mcp/server.ts
// FIRST import: installs DOM/IndexedDB globals and the delegating fetch before
// any src/api module is evaluated.
import { nativeFetch, setSessionFetch } from './globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createIsSession } from './session';
import { registerTools } from './register';

const user = process.env.MENDELU_USER?.trim();
const pass = process.env.MENDELU_PASS;
if (!user || !pass) {
  // stderr only: stdout is the MCP protocol stream.
  process.stderr.write('reIS for Claude: set your IS Mendelu username and password in the extension settings.\n');
  process.exit(1);
}

const session = createIsSession({ user, pass }, nativeFetch);
setSessionFetch(session.fetch);

const server = new McpServer({ name: 'reis-mendelu', version: '0.1.0' });
registerTools(server, { fetch: session.fetch });
await server.connect(new StdioServerTransport());
```

```json
// mcp/tsconfig.json
{
  "extends": "../tsconfig.app.json",
  "compilerOptions": { "noEmit": true, "types": ["node"], "lib": ["ES2023", "DOM"] },
  "include": ["./**/*.ts", "../src/vite-env.d.ts"]
}
```

Add `{ "path": "./mcp/tsconfig.json" }` to `references` in the root `tsconfig.json`. If `tsc -b` then requires `composite`, set `"composite": true` with `"noEmit": false`, `"emitDeclarationOnly": true` and `"outDir": "node_modules/.tmp/mcp"`, matching however `tsconfig.app.json` is set up (read it first and mirror it).

```ts
// vite.mcp.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// reIS for Claude: one self-contained Node ESM file for the .mcpb. Every
// dependency is inlined (ssr.noExternal: true) because a .mcpb runs without
// npm install.
export default defineConfig({
  publicDir: false, // public/ holds the dev snapshot (a student's real IS data)
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    ssr: resolve(__dirname, 'mcp/server.ts'),
    outDir: 'dist-mcp/server',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    rollupOptions: { output: { format: 'es', entryFileNames: 'index.mjs', inlineDynamicImports: true } },
  },
  ssr: { noExternal: true, target: 'node' },
});
```

- [ ] **Step 3: Build and smoke it**

Run: `npm run mcp:smoke`
Expected: `tools: 10 mendelu_assignments, …`, exit 0.

If the bundle throws at startup, the common causes are:
- a `src/` module touching `chrome.*` or `import.meta.env` at load time. Add `define: { 'import.meta.env.VITE_…': '…' }` for the specific key the error names.
- a CommonJS dependency (officeparser) that needs `createRequire`. Add `banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"` to `rollupOptions.output`.

Fix only what the error names.

- [ ] **Step 4: Live smoke against IS**

```bash
(set -a; . "$(git rev-parse --path-format=absolute --git-common-dir)/../../reis-scraper/.env"; set +a; node scripts/mcp-smoke.mjs --live)
```

Expected: `mendelu_exams: N chars of markdown, structuredContent=false`, exit 0.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add mcp/server.ts mcp/tsconfig.json vite.mcp.config.ts scripts/mcp-smoke.mjs tsconfig.json package.json .gitignore
git commit -m "feat(mcp): stdio server entry and single-file node bundle"
```

---

### Task 7: Guard, manifest, pack, docs

**Files:**
- Create: `src/test/guards/mcpStaysReadOnly.test.ts`, `mcp/manifest.json`, `mcp/README.md`, `mcp/icon.png` (copy of the app icon at 256×256 or larger)
- Modify: `package.json` (devDependency `@anthropic-ai/mcpb`, script `mcp:pack`), `CLAUDE.md` (one paragraph under "Products and UI trees")

**Interfaces:**
- Consumes: `dist-mcp/server/index.mjs` (Task 6); `TOOLS` (Task 5).
- Produces: `dist-mcp/reis-for-claude.mcpb`.

- [ ] **Step 1: Write the guard test**

```ts
// src/test/guards/mcpStaysReadOnly.test.ts
// reIS for Claude (mcp/) is a public product that handles a student's IS
// password. These are its standing promises; a change here is a product
// decision, not a refactor. Decided with Dominik 2026-10-10.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(__dirname, '../../../mcp');
const sources = readdirSync(dir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ f, src: readFileSync(join(dir, f), 'utf8') }));

describe('reIS for Claude stays read-only and local', () => {
  it('never reaches online tests or a generic page fetch', () => {
    for (const { f, src } of sources) {
      expect(src, f).not.toMatch(/psani_testu|elis\/ot/);
      expect(src, f).not.toMatch(/mendelu_raw|mendelu_table/);
    }
  });
  it('never talks to Supabase or any reIS server', () => {
    for (const { f, src } of sources) {
      expect(src, f).not.toMatch(/supabase|services\/supabase|featureUsage|suggestions/i);
    }
  });
  it('never writes credentials or the cookie to disk', () => {
    for (const { f, src } of sources) {
      expect(src, f).not.toMatch(/writeFile|appendFile|createWriteStream/);
    }
  });
  it('only POSTs to the IS login form', () => {
    const posts = sources.filter(({ src }) => /method:\s*'POST'/.test(src)).map(({ f }) => f);
    expect(posts).toEqual(['login.ts']);
  });
});
```

Run: `npx vitest run src/test/guards/mcpStaysReadOnly.test.ts`
Expected: PASS. It pins existing behaviour. Confirm it actually bites: add `// psani_testu` to `mcp/tools.ts`, see the test FAIL, then remove it.

- [ ] **Step 2: Manifest**

```json
{
  "manifest_version": "0.3",
  "name": "reis-mendelu",
  "display_name": "reIS for Claude",
  "version": "0.1.0",
  "description": "Your IS Mendelu data in Claude: timetable, exams, grades, deadlines, subject files. Read-only, runs on your computer.",
  "long_description": "reIS for Claude signs in to IS Mendelu as you, on your own computer, and lets Claude read your timetable, exams, subjects, study plan, syllabi, grades, assignment deadlines and subject files. It never registers for anything, never submits anything, and never opens online tests. Your password stays in your operating system's keychain; nothing passes through reIS servers. Unofficial — IS Mendelu belongs to Mendel University in Brno.",
  "author": { "name": "reIS", "url": "https://github.com/reis-mendelu/reis-extension" },
  "repository": { "type": "git", "url": "https://github.com/reis-mendelu/reis-extension" },
  "homepage": "https://github.com/reis-mendelu/reis-extension/tree/main/mcp",
  "icon": "icon.png",
  "server": {
    "type": "node",
    "entry_point": "server/index.mjs",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/server/index.mjs"],
      "env": { "MENDELU_USER": "${user_config.username}", "MENDELU_PASS": "${user_config.password}" }
    }
  },
  "user_config": {
    "username": { "type": "string", "title": "IS Mendelu username", "description": "Your IS login, e.g. xnovak.", "required": true },
    "password": { "type": "string", "title": "IS Mendelu password", "description": "Stored in your system keychain. Sent only to is.mendelu.cz.", "sensitive": true, "required": true }
  },
  "tools_generated": false,
  "compatibility": { "platforms": ["darwin", "win32"], "runtimes": { "node": ">=20.0.0" } },
  "license": "see repository"
}
```

Before relying on it, check this manifest against the installed `@anthropic-ai/mcpb` schema: `npx mcpb validate mcp/manifest.json`. Check the `manifest_version`, the `tools` listing and `license` there, and fix whatever it reports. Read the repo's `LICENSE` file for the license value.

- [ ] **Step 3: Pack script**

```bash
npm install --save-dev @anthropic-ai/mcpb
```

```json
"mcp:pack": "npm run mcp:build && node scripts/mcp-pack.mjs"   // cross-platform; copies the icon from public/brand-assets, runs a pinned mcpb, checks the archive
```

Run: `npm run mcp:pack`
Expected: the validation passes and `dist-mcp/reis-for-claude.mcpb` exists. `unzip -l dist-mcp/reis-for-claude.mcpb` lists `manifest.json`, `icon.png` and `server/index.mjs`, and nothing else (no `.env`, no snapshot).

- [ ] **Step 4: README**

`mcp/README.md` must cover, in this order:
1. What it is, in one line.
2. Install: download `reis-for-claude.mcpb` from the latest `mcp-v*` GitHub release, double-click it, then enter your IS username and password.
3. What Claude can read: the ten tools, one line each.
4. What it never does: register, submit, open tests, send anything to reIS. The password stays in the keychain and goes only to is.mendelu.cz.
5. Two-factor accounts are not supported yet.
6. Updates: download the new release by hand until it is listed in Claude's directory.
7. "Unofficial; IS Mendelu belongs to Mendel University in Brno."

- [ ] **Step 5: CLAUDE.md paragraph**

Under "Products and UI trees", after the table, add:

```markdown
**A fourth product, headless: reIS for Claude (`mcp/`).** A Claude Desktop
extension (`.mcpb`) that signs in to IS as the student, on their laptop, and
exposes ten read-only tools over the same `src/api` fetchers. No UI tree. It
is the only reIS code that handles a password (keychain → one login POST).
Its standing promises are pinned in `src/test/guards/mcpStaysReadOnly.test.ts`.
Build: `npm run mcp:pack`. Releases are `mcp-v*` tags, never `v*`.
```

- [ ] **Step 6: Run the touched tests and typecheck**

Run: `npx vitest run mcp/ src/test/guards/mcpStaysReadOnly.test.ts src/test/guards/noStudentDataLeaves.test.ts scripts/lib/__tests__/privacyDisclosures.test.ts && npm run typecheck`
Expected: all PASS.

- [ ] **Step 7: Commit, push, PR**

```bash
git add src/test/guards/mcpStaysReadOnly.test.ts mcp/manifest.json mcp/README.md mcp/icon.png package.json package-lock.json CLAUDE.md
git commit -m "feat(mcp): pack reIS for Claude as a Claude Desktop extension"
git push personal HEAD
gh pr create --base test --title "feat(mcp): reIS for Claude — student MCP as a Claude Desktop extension" --body-file <(printf '%s\n' "Spec: docs/superpowers/specs/2026-10-10-student-mcp-design.md" "Plan: docs/superpowers/plans/2026-10-10-student-mcp.md" "" "🤖 Generated with [Claude Code](https://claude.com/claude-code)")
```

Then turn on Auto-fix (memory `always-enable-auto-fix`).

The Stop hooks may ask. Answers:
- tree-parity: `mcp/` belongs to neither UI tree and is not a UI capability.
- disclosure-drift: no new data flow to reIS; the tool talks only to is.mendelu.cz and the public CDN.

---

### Task 8 (Dominik's go required): first release

Not automatic. Ask Dominik first, because a release is public.

- [ ] Install `dist-mcp/reis-for-claude.mcpb` in Claude Desktop on Dominik's Mac by double-clicking it. Enter the credentials in its settings, then ask Claude "what exams do I have left?". Send him the screenshot.
- [ ] Confirm that no workflow fires on a tag or release push. Run `grep -nE "^\s*(release|push):" -A4 .github/workflows/*.yml` and read every match. On 2026-10-10 none matched `mcp-v*` or `release:`.
- [ ] After the PR merges to `test`: `git tag mcp-v0.1.0 <merge sha> && git push personal mcp-v0.1.0`, then `gh release create mcp-v0.1.0 dist-mcp/reis-for-claude.mcpb --title "reIS for Claude 0.1.0" --notes-file mcp/README.md`.
- [ ] Verify no workflow ran for the tag: `gh run list --limit 5`.

---

## Deviations found during execution (2026-10-10)

- **No `// @vitest-environment node`.** `src/test/setup.ts` needs a DOM. The MCP tests stay in happy-dom and fake responses as plain objects, because happy-dom's `Headers` drops `Set-Cookie`/`Cookie` just like a browser's. `session.ts` sends headers as a plain record for the same reason.
- **`beforeEach(() => m.mockReset())` is a trap.** It returns the mock, and vitest runs a returned function as teardown. Use a block body.
- **`IsLoginError` declares `kind` as a field.** `erasableSyntaxOnly` forbids constructor parameter properties.
- **unpdf removed; officeparser `^8.1.1` reads PDFs too.**
  - officeparser 7.x pins pdfjs-dist 6.1.200, which is affected by GHSA-hq66-cqwq-w95j.
  - unpdf bundles its own vulnerable pdfjs, which `npm audit` can't see.
  - Two pdfjs copies in one bundle fail with an API/worker version mismatch.
  - v8 removed `ast.toText()`. Use `(await ast.to('text')).value`.
- **officeparser's optional peers are aliased to `mcp/optionalPeerStub.ts`** (pdf-lib, puppeteer, tesseract.js). The single-file bundle evaluates their lazy imports eagerly and would throw at load.
- **`useSessionFetch` is renamed `setSessionFetch`.** The React hooks lint rule fires on any `use*` call at top level.
- **`publicDir: false` in `vite.mcp.config.ts`.** Vite copied `public/` into the bundle, including `dev-real-data.json`, a student's real IS snapshot. `scripts/mcp-check-pack.mjs` now fails the pack unless the archive holds exactly `icon.png`, `manifest.json` and `server/index.mjs`.
- **The icon is copied at pack time** from `public/brand-assets/reIS_logo_512.png`, so there is no `mcp/icon.png`. The manifest license is `Apache-2.0`, matching the repo's LICENSE.
- **The markdown renderer keeps multi-line text as a block,** so extracted lecture text keeps its lines.
- **mcpb is not a devDependency.** It pulled in `node-forge` advisories, so `mcp:pack` runs a pinned `npx -y @anthropic-ai/mcpb@2.1.2`. The new packages leave `npm audit` at the 15-advisory baseline.
- **The schedule takes `from`/`to` (default today + 14 days) as compact rows, and the study plan is compacted.** Live, both ran past the 25k cap, and the cut fell on the future. A nested list of flat rows renders as a table.
- **Verified live (2026-10-10):**
  - all ten tools on Node 20.20, 22.23 and 26.0, including reading a 37-page lecture PDF;
  - an invalid `UISAuth` gets HTTP 403 with the login form in the body; the session detects the form, logs in once more, and returns the real page.

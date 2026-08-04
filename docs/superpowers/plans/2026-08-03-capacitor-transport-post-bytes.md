# Capacitor transport: POST + raw bytes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Capacitor transport POST and raw-bytes support, and make eduroam its first real consumer.

**Architecture:** `fetchViaCapacitor` gains an options bag (`method`/`body`/`headers`) and an `httpPost` dependency; POST dispatches to `CapacitorHttp.post`, everything else is unchanged. Bytes get a separate `fetchAuthedBytes(url)` in `client.ts` that routes to the already device-verified `fetchIsBinary` on Capacitor and to a bare credentialed `fetch` everywhere else. `src/api/eduroam.ts`'s four bare `fetch` calls then move onto both.

**Tech Stack:** TypeScript, Vitest (happy-dom), Capacitor 8 (`@capacitor/core` — `CapacitorHttp`, `CapacitorCookies`), WXT.

**Spec:** `docs/superpowers/specs/2026-08-03-capacitor-transport-post-bytes-design.md`

## Global Constraints

- **Test first.** Write the failing test, watch it fail, then implement (repo Iron Rule).
- **Never collapse the per-platform cookie asymmetry.** Android = seed the native jar, no `Cookie` header. iOS = explicit `Cookie` header, no jar. Both measured on device; doing both at once is *not* known safe (`src/api/capacitorTransport.ts:20-30`).
- **Cookie-delivery headers are applied LAST**, so a caller can never overwrite `Cookie` and detach the session on iOS.
- **Do not perturb GET request headers.** Sync makes ~236 GETs through this path and is device-verified. See Task 2 for the precise rule.
- **The `logout.pl` auth check must never run against binary.** A `.p12` cannot contain it; applying it reports a fake expired session.
- **No `vi.mock`** in these tests — this codebase tests transports by dependency injection (`src/api/__tests__/capacitorTransport.test.ts`).
- **Before pushing**, all four gates must exit 0: changed-files `eslint --max-warnings=0`, `prettier --check`, `npm run typecheck` (this is `tsc -b`, it covers tests — a bare `tsc --noEmit` does not), and `npm run nuia:gate`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/api/capacitorTransport.ts` | Native HTML/text transport, cookie delivery, auth detection | Modify — add POST |
| `src/api/__tests__/capacitorTransport.test.ts` | Its tests | Modify |
| `src/api/client.ts` | `fetchWithAuth` platform dispatch; new `fetchAuthedBytes` | Modify |
| `src/api/__tests__/authedBytes.test.ts` | Tests for the bytes path | Create |
| `src/api/capacitorBinary.ts` | Native binary fetch (already exists, device-verified) | Modify — add `toBytes` |
| `src/api/__tests__/capacitorBinary.test.ts` | Its tests | Modify |
| `src/api/eduroam.ts` | Cert page + cert material | Modify — drop 4 bare `fetch` calls |

---

### Task 1: POST axis in the native transport

**Files:**
- Modify: `src/api/capacitorTransport.ts`
- Test: `src/api/__tests__/capacitorTransport.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `CapacitorRequestOptions = { method?: string; body?: string; headers?: Record<string, string> }`
  - `CapacitorTransportDeps` gains `httpPost(o: { url: string; headers?: Record<string, string>; data?: string }): Promise<CapacitorHttpResponse>`
  - `fetchViaCapacitor(url: string, token: string, deps: CapacitorTransportDeps, options?: CapacitorRequestOptions): Promise<Response>`

- [ ] **Step 1: Write the failing tests**

Add to `src/api/__tests__/capacitorTransport.test.ts`. Also add `httpPost` to the existing `deps()` helper in the `fetchViaCapacitor` describe block, so existing tests keep compiling:

```ts
// inside the existing deps() helper, alongside httpGet:
      httpPost: vi.fn(async () => ({
        status: 200,
        data: '<a href="/system/logout.pl">x</a>',
        headers: { 'Content-Type': 'text/html' },
      })),
```

```ts
  it('sends a POST through httpPost with the body as data', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/wifi/certifikat.pl', TOKEN, d, {
      method: 'POST',
      body: 'lang=cz&gen=x',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(d.httpPost).toHaveBeenCalledWith({
      url: 'https://is.mendelu.cz/auth/wifi/certifikat.pl',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: 'lang=cz&gen=x',
    });
    expect(d.httpGet).not.toHaveBeenCalled();
  });

  it('still routes a GET through httpGet, never httpPost', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
    expect(d.httpGet).toHaveBeenCalled();
    expect(d.httpPost).not.toHaveBeenCalled();
  });

  it('treats a lowercase method as POST', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, { method: 'post', body: 'a=1' });
    expect(d.httpPost).toHaveBeenCalled();
  });

  it('applies the iOS Cookie header LAST so a caller cannot detach the session', async () => {
    const d = deps({ platform: 'ios' });
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
      method: 'POST',
      body: 'a=1',
      headers: { Cookie: 'UISAuth=attacker-supplied' },
    });
    const sent = (d.httpPost as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      headers: Record<string, string>;
    };
    expect(sent.headers.Cookie).toBe(`UISAuth=${TOKEN}`);
  });

  it('seeds the native jar for a POST on android too', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, { method: 'POST', body: 'a=1' });
    expect(d.setCookie).toHaveBeenCalled();
  });

  it('refuses a POST to a non-IS origin before sending anything', async () => {
    const d = deps();
    await expect(
      fetchViaCapacitor('https://evil.example.com/x', TOKEN, d, { method: 'POST', body: 'a=1' })
    ).rejects.toThrow(/refusing to send the IS session/);
    expect(d.httpPost).not.toHaveBeenCalled();
  });

  it('applies the sessionExpired rule to a POST as well', async () => {
    const d = deps({ httpPost: vi.fn(async () => ({ status: 403, data: '' })) });
    await expect(
      fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, { method: 'POST', body: 'a=1' })
    ).rejects.toMatchObject({ sessionExpired: true });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/api/__tests__/capacitorTransport.test.ts`
Expected: FAIL — `httpPost` is not a property of `CapacitorTransportDeps`, and `fetchViaCapacitor` takes 3 arguments.

- [ ] **Step 3: Implement**

In `src/api/capacitorTransport.ts`, extend the deps interface (add below the existing `httpGet` line):

```ts
  httpPost(o: {
    url: string;
    headers?: Record<string, string>;
    data?: string;
  }): Promise<CapacitorHttpResponse>;
```

Add the options type next to `CapacitorHttpResponse`:

```ts
/** The request shape fetchWithAuth forwards. `headers` are the CALLER's own —
 *  see client.ts, which deliberately does not forward DEFAULT_HEADERS here. */
export interface CapacitorRequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}
```

Change the `fetchViaCapacitor` signature and the request dispatch. Replace:

```ts
export async function fetchViaCapacitor(
  url: string,
  token: string,
  deps: CapacitorTransportDeps
): Promise<Response> {
```

with:

```ts
export async function fetchViaCapacitor(
  url: string,
  token: string,
  deps: CapacitorTransportDeps,
  options: CapacitorRequestOptions = {}
): Promise<Response> {
```

Then replace this line:

```ts
  const res = await deps.httpGet({ url, headers: delivery.headers });
```

with:

```ts
  // Cookie delivery goes LAST: on iOS the Cookie header IS the authentication,
  // so a caller must not be able to overwrite it and silently detach the
  // session. On Android that map is empty and the jar was seeded above.
  const headers = { ...options.headers, ...delivery.headers };
  const isPost = (options.method ?? 'GET').toUpperCase() === 'POST';
  const res = isPost
    ? await deps.httpPost({ url, headers, data: options.body ?? '' })
    : await deps.httpGet({ url, headers });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/api/__tests__/capacitorTransport.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add src/api/capacitorTransport.ts src/api/__tests__/capacitorTransport.test.ts
git commit -m "feat(mobile): POST support in the native Capacitor transport"
```

---

### Task 2: Forward method and body from fetchWithAuth

**Files:**
- Modify: `src/api/client.ts:37-46`

**Interfaces:**
- Consumes: `fetchViaCapacitor(url, token, deps, options)` and the `httpPost` dep from Task 1.
- Produces: `fetchWithAuth(url, { method: 'POST', body, headers })` works on Capacitor.

**The header rule — read before editing.** `fetchWithAuth` merges `DEFAULT_HEADERS` into a local `headers` const at the top. **Do not forward that merged map to Capacitor.** Today the Capacitor branch sends no caller headers at all, and sync's ~236 GETs are device-verified with exactly that shape. Forward `options.headers` — the caller's own headers only — so GET traffic is unchanged and only an explicit caller (eduroam's POST) adds anything.

- [ ] **Step 1: Implement**

In `src/api/client.ts`, replace the Capacitor branch body:

```ts
  if (getPlatform().kind === 'capacitor') {
    const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');
    const token = await loadStoredToken();
    return fetchViaCapacitor(url, token, {
      platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
      setCookie: (o) => CapacitorCookies.setCookie(o),
      httpGet: (o) => CapacitorHttp.get(o),
      httpPost: (o) => CapacitorHttp.post(o),
    }, {
      method: options.method,
      body: options.body as string | undefined,
      // Deliberately options.headers, NOT the DEFAULT_HEADERS-merged `headers`
      // above: sync's GETs are device-verified with no caller headers, and
      // changing what they put on the wire is a risk with no upside here.
      headers: options.headers as Record<string, string> | undefined,
    });
  }
```

- [ ] **Step 2: Verify the whole suite still passes**

Run: `npx vitest run`
Expected: PASS. No test asserts on the old 3-argument call, so nothing should break; if something does, it is a real regression — fix it rather than adjusting the assertion.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/api/client.ts
git commit -m "feat(mobile): forward method and body to the Capacitor transport"
```

---

### Task 3: `toBytes` — reject a page before it becomes a certificate

**Files:**
- Modify: `src/api/capacitorBinary.ts`
- Test: `src/api/__tests__/capacitorBinary.test.ts`

**Interfaces:**
- Consumes: `IsResourceResult` (already exported from `src/api/capacitorBinary.ts`).
- Produces: `toBytes(result: IsResourceResult): Promise<Uint8Array>` — throws a `sessionExpired`-tagged error when the result is a page rather than a file.

- [ ] **Step 1: Write the failing tests**

Add to `src/api/__tests__/capacitorBinary.test.ts` (add `toBytes` to the existing import from `../capacitorBinary`):

```ts
describe('toBytes', () => {
  it('returns the blob contents as bytes', async () => {
    const blob = new Blob([new Uint8Array([0x30, 0x82, 0x01])], { type: 'application/x-pkcs12' });
    const bytes = await toBytes({ kind: 'binary', blob, filename: 'cert.p12' });
    expect(Array.from(bytes)).toEqual([0x30, 0x82, 0x01]);
  });

  it('THROWS on a page — an HTML page must never be written as a certificate', async () => {
    // fetchIsBinary returns kind:'page' for an AUTHENTICATED html response.
    // For a .p12 request that means IS did not serve the file; saving the page
    // would produce a corrupt certificate that fails silently at install time.
    await expect(toBytes({ kind: 'page' })).rejects.toMatchObject({ sessionExpired: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/api/__tests__/capacitorBinary.test.ts`
Expected: FAIL with "toBytes is not a function" (or an import error).

- [ ] **Step 3: Implement**

Append to `src/api/capacitorBinary.ts`:

```ts
/**
 * Narrows an IsResourceResult to raw bytes.
 *
 * The `page` case is the one that matters: `fetchIsBinary` returns it for an
 * authenticated HTML response, which for a certificate request means IS did not
 * serve the file. Writing those bytes would produce a `.p12` that is really a
 * web page — a corruption that only surfaces when the student tries to install
 * it, long after the download "succeeded".
 */
export async function toBytes(result: IsResourceResult): Promise<Uint8Array> {
  if (result.kind !== 'binary') {
    const err = new Error('Expected file bytes, got a page') as Error & {
      sessionExpired?: boolean;
    };
    err.sessionExpired = true;
    throw err;
  }
  return new Uint8Array(await result.blob.arrayBuffer());
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/api/__tests__/capacitorBinary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/capacitorBinary.ts src/api/__tests__/capacitorBinary.test.ts
git commit -m "feat(mobile): toBytes, refusing to hand back a page as file bytes"
```

---

### Task 4: `fetchAuthedBytes` — the platform-agnostic bytes entry point

**Files:**
- Modify: `src/api/client.ts`
- Test: `src/api/__tests__/authedBytes.test.ts` (create)

**Interfaces:**
- Consumes: `toBytes` (Task 3), `fetchIsBinary` (existing), `loadStoredToken` (existing, already imported in `client.ts`).
- Produces: `fetchAuthedBytes(url: string): Promise<Uint8Array>`.

- [ ] **Step 1: Write the failing test**

Create `src/api/__tests__/authedBytes.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchAuthedBytes } from '../client';
import { setPlatform, __resetPlatformForTests } from '../../platform';
import type { ReisPlatform } from '../../platform/types';

function stub(kind: ReisPlatform['kind']): ReisPlatform {
  const bag = new Map<string, unknown>();
  return {
    kind,
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
    getAssetUrl: (p) => `/${p}`,
  };
}

describe('fetchAuthedBytes on the extension', () => {
  afterEach(() => {
    __resetPlatformForTests();
    vi.restoreAllMocks();
  });

  it('returns the response body as bytes, with credentials', async () => {
    setPlatform(stub('extension'));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([0x30, 0x82, 0x04]), {
        status: 200,
        headers: { 'content-type': 'application/x-pkcs12' },
      })
    );
    const bytes = await fetchAuthedBytes('https://is.mendelu.cz/auth/wifi/certifikat.pl?get=user-p12');
    expect(Array.from(bytes)).toEqual([0x30, 0x82, 0x04]);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/wifi/certifikat.pl?get=user-p12',
      { credentials: 'include' }
    );
  });

  it('THROWS on an HTML body — that is a login page, not a certificate', async () => {
    setPlatform(stub('extension'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>login</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=UTF-8' },
      })
    );
    await expect(fetchAuthedBytes('https://is.mendelu.cz/x')).rejects.toThrow(/HTML/i);
  });

  it('THROWS on a non-2xx', async () => {
    setPlatform(stub('extension'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    await expect(fetchAuthedBytes('https://is.mendelu.cz/x')).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/api/__tests__/authedBytes.test.ts`
Expected: FAIL — `fetchAuthedBytes` is not exported from `../client`.

- [ ] **Step 3: Implement**

Append to `src/api/client.ts`:

```ts
/**
 * Fetch an authenticated IS resource as raw bytes.
 *
 * A sibling of fetchWithAuth rather than an option on it: fetchWithAuth imposes
 * DEFAULT_HEADERS (`accept: text/html…`, a form-urlencoded content-type), which
 * are wrong to send when asking for a `.p12` — and adding them would change what
 * the extension puts on the wire today. One function, two contracts.
 *
 * The `logout.pl` auth check is deliberately NOT applied here: binary cannot
 * carry that marker, so the check would report a fake expired session. Expiry is
 * detected the way fetchIsBinary detects it — 401/403, or HTML where a file was
 * expected.
 */
export async function fetchAuthedBytes(url: string): Promise<Uint8Array> {
  if (getPlatform().kind === 'capacitor') {
    const { fetchIsBinary, toBytes } = await import('./capacitorBinary');
    const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');
    const token = await loadStoredToken();
    return toBytes(
      await fetchIsBinary(url, token, {
        platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
        setCookie: (o) => CapacitorCookies.setCookie(o),
        httpGet: (o) => CapacitorHttp.get(o),
      })
    );
  }

  // Extension / iframe / dev webapp: unchanged from what eduroam did before —
  // a direct credentialed fetch, no DEFAULT_HEADERS, no proxy hop.
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw new Error('Expected file bytes, got HTML (session expired?)');
  }
  return new Uint8Array(await res.arrayBuffer());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/api/__tests__/authedBytes.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/api/client.ts src/api/__tests__/authedBytes.test.ts
git commit -m "feat(mobile): fetchAuthedBytes, a platform-agnostic bytes entry point"
```

---

### Task 5: Move eduroam onto the transport

**Files:**
- Modify: `src/api/eduroam.ts:30-60`

**Interfaces:**
- Consumes: `fetchWithAuth` (with POST, Tasks 1-2), `fetchAuthedBytes` (Task 4).
- Produces: no new exports. `fetchEduroamPassword` and `fetchEduroamCertMaterial` keep their existing signatures.

**Two accepted behaviour changes on the extension** (approved during design — do not silently extend them):
1. `getText`/`generateCert` now send `DEFAULT_HEADERS`.
2. A 401/403 now redirects to the IS login page instead of throwing.

**If these ever need reverting**, the change is contained to `getText` and `generateCert` below: restore their bare `fetch` bodies and add an `isNativeHost()` branch. `fetchAuthedBytes` needs no such escape hatch — it is byte-identical on the extension by construction.

- [ ] **Step 1: Implement**

In `src/api/eduroam.ts`, add the import at the top of the file (after the `CERT_URL` const):

```ts
import { fetchWithAuth, fetchAuthedBytes } from './client';
```

Replace `getText`:

```ts
async function getText(url: string): Promise<string> {
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`eduroam: GET ${url} -> ${res.status}`);
  return res.text();
}
```

Replace `getBytes` entirely — the whole function is now one call, so delete it and use `fetchAuthedBytes` at both call sites in `fetchEduroamCertMaterial`:

```ts
  const [rootCaDer, clientP12] = await Promise.all([
    fetchAuthedBytes(`${CERT_URL}?get=root-der;lang=cz`),
    fetchAuthedBytes(`${CERT_URL}?get=user-p12;lang=cz`),
  ]);
```

Replace `generateCert`:

```ts
async function generateCert(): Promise<void> {
  // The only IS write in reIS. It must stay student-initiated: a certificate is
  // valid for 366 days and generating one silently would rotate a credential
  // the student may already have installed on other devices.
  // No explicit Content-Type: both transports already supply it. Adding a
  // differently-cased copy DOUBLES it — DEFAULT_HEADERS uses lowercase
  // `content-type`, both keys survive client.ts's object spread, and `Headers`
  // appends rather than replaces, so IS receives the value twice, fails to
  // parse the body, and silently creates no certificate.
  const res = await fetchWithAuth(CERT_URL, {
    method: 'POST',
    body: `lang=cz&gen=${encodeURIComponent('Vygenerovat certifikát')}`,
  });
  if (!res.ok) throw new Error(`eduroam: generate -> ${res.status}`);
}
```

- [ ] **Step 2: Verify no bare fetch remains**

Run: `grep -n "fetch(" src/api/eduroam.ts`
Expected: no output. (`fetchWithAuth(` and `fetchAuthedBytes(` do not match `fetch(`.)

- [ ] **Step 3: Run the eduroam tests**

Run: `npx vitest run src/api/eduroam.test.ts src/hooks/data/__tests__/useEduroamSetup.test.ts`
Expected: PASS. `parseCertPage` is pure and untouched, and `useEduroamSetup` mocks the whole eduroam module. Verified while writing this plan: **no test in the repo spies on `globalThis.fetch` for eduroam**, so nothing should need rewriting. If one turns up, spy on the `client` module's exports — do not restore the bare `fetch` to satisfy a test.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS (5 ISKAM parser files may fail on missing `.agent/fixtures/**` — that is pre-existing and unrelated).

- [ ] **Step 5: Commit**

```bash
git add src/api/eduroam.ts
git commit -m "refactor(eduroam): route through the transport instead of bare fetch"
```

---

### Task 6: Gates, build, and device verification

**Files:** none modified — this task is verification only.

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: evidence the POST and bytes paths work against live IS.

- [ ] **Step 1: Run all four CI gates locally**

```bash
BASE=$(git merge-base main HEAD)
CHANGED=$(git diff --name-only --diff-filter=ACMR "$BASE" HEAD -- '*.ts' '*.tsx' | grep -vE 'package-lock\.json$')
echo "$CHANGED" | xargs npx eslint --max-warnings=0
echo "$CHANGED" | xargs npx prettier --check
npm run typecheck
npm run nuia:gate
```

Expected: exit 0 from each. `npm run typecheck` is `tsc -b` and covers test files; a bare `tsc --noEmit` does not and will miss errors CI catches.

- [ ] **Step 2: Build and install**

```bash
source ~/android-toolchain/env.sh
npm run build:capacitor && npx cap sync android
cd android && ./gradlew assembleDebug; echo "GRADLE EXIT: $?"
```

Expected: `GRADLE EXIT: 0`. Check `$?` directly — **not** after a pipe, which reports the pipe's last command instead.

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n cz.reis.app/.MainActivity
```

- [ ] **Step 3: Verify the telemetry bug is gone**

```bash
adb logcat -c
# open the app, navigate to Student -> Eduroam
adb logcat -d | grep -i "reIS:error"
```

Expected: **no** `useEduroamSetup.prefetchPassword` error. Before this change the sheet fired one on every open, because `fetchEduroamPassword` was a CORS-blocked bare `fetch`.

- [ ] **Step 4: Verify the password renders and the bytes are real**

Drive from code over CDP rather than tapping — tap coordinates are unreliable, and tapping inside a live authenticated IS WebView once hit the logout link:

```bash
PID=$(adb shell pidof cz.reis.app)
adb forward tcp:9333 localabstract:webview_devtools_remote_$PID
curl -s http://localhost:9333/json    # grab webSocketDebuggerUrl for the https://localhost target
```

Then evaluate in the page:

The app bundle is minified, so its modules are not importable by path. Drive the
real UI and read the bytes off the wire instead — fetch the same two URLs through
the same native plugin the transport uses:

```js
(async () => {
  const H = window.Capacitor.Plugins.CapacitorHttp;
  const CERT = 'https://is.mendelu.cz/auth/wifi/certifikat.pl';
  const out = {};
  for (const [k, q] of [['der', 'get=root-der;lang=cz'], ['p12', 'get=user-p12;lang=cz']]) {
    const r = await H.get({ url: `${CERT}?${q}`, headers: {}, responseType: 'blob' });
    const raw = atob(String(r.data || '').replace(/^data:[^,]*,/, ''));
    out[k] = {
      status: r.status,
      contentType: r.headers['Content-Type'] || r.headers['content-type'],
      len: raw.length,
      head: [raw.charCodeAt(0), raw.charCodeAt(1)].map((x) => x.toString(16)).join(' '),
    };
  }
  return JSON.stringify(out, null, 1);
})()
```

Separately, open the eduroam sheet in the app and confirm the extraction password
chip renders a value rather than its placeholder.

Expected: **both `head` values are `30 82`** — a DER SEQUENCE, which is how both a PKCS#12 and a DER certificate start. Assert the magic bytes, **not** just a non-zero length: an HTML error page is also non-empty, and that is exactly the failure this must catch.

- [ ] **Step 5: Verify the POST specifically**

The POST only runs when no certificate exists yet, so it will not fire for a student who already has one. Exercise it directly over CDP:

```js
(async () => {
  const r = await window.Capacitor.Plugins.CapacitorHttp.post({
    url: 'https://is.mendelu.cz/auth/wifi/certifikat.pl',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: 'lang=cz',   // NOTE: no gen= — this must NOT generate a certificate
  });
  return JSON.stringify({ status: r.status, authed: /logout\.pl/.test(String(r.data || '')) });
})()
```

Expected: `status: 200` and `authed: true` — proving a POST reaches IS authenticated. **Deliberately omit `gen=`**: generating a real certificate rotates a 366-day credential the student may already have installed on other devices, so it must stay student-initiated.

- [ ] **Step 6: Commit any fixes and open the PR**

```bash
git push -u origin claude/capacitor-transport-post
```

Then open the PR with a body covering: the silent-GET bug (dropped `options.method`
meant a POST returned a 200 and an HTML page rather than failing); the `logout.pl`
check being inapplicable to binary; the two accepted extension-side behaviour
changes from Task 5; and the device evidence from Steps 3-5 — no telemetry on
sheet open, `30 82` magic bytes on both downloads, and a 200 authenticated POST.
State plainly that eduroam still does **not** join a network (#159).

---

## Notes for the implementer

- **`CapacitorHttp.post` takes `data`, not `body`.** Passing `body` silently sends nothing — the same class of bug as the dropped `options.method` this plan exists to fix.
- **eduroam is still not functional end-to-end after this.** It downloads cert material correctly; joining a network needs the native Wi-Fi plugin (Task 5 of the parent plan, #159). Do not claim eduroam "works" on the strength of this PR.
- The remaining Task 4 sites (`cvicneTests`, `odevzdavarny`, `kontrola`, `serverTime`) are **out of scope**. Each needs its own judgement about the `DEFAULT_HEADERS` + redirect change; do not sweep them in.

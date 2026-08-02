# Capacitor Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Capacitor app that boots the existing reIS phone UI against a real, restored IS Mendelu session on iOS and Android, with working file downloads and a working Android back button.

**Architecture:** *(settled by Task 1 — Model C.)* The reIS phone UI from #162 runs as a normal app in the Capacitor host WebView. The student logs into real IS inside `@capgo/capacitor-inappbrowser`'s `openWebView`, which exists **only for login and cookie capture**; `UISAuth` is then stored and replayed. All IS data is fetched over **`CapacitorHttp`**, which runs in the native layer and is therefore not subject to IS's blanket CORS denial. All `chrome.*` usage moves behind a thin platform port so the extension, the dev webapp, and the Capacitor app share one codebase.

**Tech Stack:** Capacitor 8, `@capgo/capacitor-inappbrowser` 8.13.2, React 19, Vite, Zustand, vitest + happy-dom.

## Global Constraints

- **Capacitor 8 requires JDK 21.** JDK 17 fails Gradle with `Cannot find a Java installation … matching languageVersion=21`.
- **Capacitor 8 uses SPM, not CocoaPods.** There is no `App.xcworkspace`; build with `-project ios/App/App.xcodeproj`.
- **`openWebView` throws unless `isPresentAfterPageLoad: true` when `preShowScript` is set.**
- **Never commit a session token, `.p12`, `.der`, or passphrase.** Runtime-only, gitignored files.
- **Iron rules from `CLAUDE.md` apply**: no `localStorage`/`sessionStorage`, no proxy/re-export files, no `useEffect` for data fetching, no custom CSS (DaisyUI semantic classes), all state in Zustand slices, max 200 lines per file, direct imports only, test first.
- **Parsers are near-untouchable.** Do not modify `src/api/documents/parser.ts`, `src/api/cvicneTests.ts`, or `src/utils/parsers/` to fix a lint or type error. Suppress the rule instead.
- **Do not escalate the Google Drive OAuth scope past `drive.file`.**
- **The extension must keep working.** Every change here is additive or behind a platform branch; `npm run build` and `npm run test:run` must stay green throughout.

## Measured facts this plan is built on

From `docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md`. Do not re-derive:

- `preShowScript` + `documentStart` runs on IS on **both** platforms, and **re-runs on every navigation**.
- **Both** WKWebView and Android WebView **lose `UISAuth` on app kill** — it is a session cookie. Restore is mandatory on both.
- Restore works via **hybrid**: `headers: { Cookie }` for request #1 + `document.cookie` at `documentStart` for the rest. No native plugin, no `setCookie`.
- **blob + `a[download]` saves nothing and reports no error** on Android; iOS lacks `a[download]` support.
- IS sends **`Access-Control-Allow-Origin: https://localhost.that.never.exists/`** (CORS denied to all), **`X-Frame-Options: SAMEORIGIN`**, and **no CSP**.
- IS session limit is a **sliding inactivity window, default 1 day** — not a 7-day absolute ceiling.
- `UISAuth` is the only auth cookie; name+value+domain+path suffices; no UA binding; concurrent sessions allowed.

## File Structure

| Path | Responsibility |
|---|---|
| `src/platform/types.ts` | The `ReisPlatform` interface — the single seam between app code and host capabilities |
| `src/platform/index.ts` | `getPlatform()` / `setPlatform()` — the live registry |
| `src/platform/extensionPlatform.ts` | Chrome-extension implementation (wraps today's `chrome.*` calls) |
| `src/platform/capacitorPlatform.ts` | Capacitor implementation |
| `src/platform/webPlatform.ts` | Dev-webapp implementation (replaces `dev/chromeShim.ts` behaviour) |
| `src/platform/sessionToken.ts` | Pure token capture/validate logic, no I/O — unit tested |
| `src/mobile/backButton.ts` | Maps a hardware back press onto the sheet stack |
| `src/mobile/saveDocument.ts` | Pure save-strategy decision + the existence assertion (unit tested) |
| `src/mobile/saveDeps.ts` | Wires `saveDocument` to the real host; lazily imports `@capacitor/*` |
| `capacitor/main.capacitor.ts` | Capacitor app entry: installs the platform, boots reIS |
| `vite.capacitor.config.ts` | Build config producing `dist-capacitor/` |
| `capacitor.config.ts` | Capacitor project config |

`saveDocument.ts` and `saveDeps.ts` are split so the branching logic is testable without
a device and the extension bundle never imports `@capacitor/*`.

~~**Task 1 gates the shape of Task 7.**~~ **Resolved → Model C.** `main.capacitor.ts`
renders `MobileApp` directly and `openWebView` is used only for login. No injected
bootstrap is needed. Tasks 2–6 were transport-agnostic and are unaffected.

Model C added one file that the original plan did not have, because it assumed the
question was still open:

| Path | Responsibility |
|---|---|
| `src/api/capacitorTransport.ts` | The `CapacitorHttp` transport + the per-platform cookie mechanism (**new — Task 6b**) |

---

### Task 1: Resolve the data transport — injection vs native HTTP ✅ DONE

> **RESOLVED 2026-08-02 → Model C (`CapacitorHttp`).** Full evidence and rationale:
> `docs/superpowers/specs/2026-08-02-capacitor-transport-decision.md`.
>
> Measured on both platforms with a real session:
>
> | Cookie supplied via | Android | iOS |
> |---|---|---|
> | `CapacitorCookies.setCookie()` | **200 AUTHED** | 403 |
> | explicit `headers: { Cookie }` | 403 | **200 AUTHED** |
>
> **Both work — with opposite mechanisms**, so supplying the cookie needs a
> `Capacitor.getPlatform()` branch. Getting it wrong yields a **silent 403**, not an
> error. Steps below are kept for the record; do not re-run them.

The single decision that changes everything downstream. #158 flags it as unresolved, and the header findings narrowed four candidate models to two. **This task produces a decision with evidence, not code in `src/`.**

Work happens in the existing spike app at `/Users/dominik-personal/Documents/reis-capacitor-spike` (a separate repo, never merged).

**Files:**
- Modify: `<spike>/src/main.ts`
- Create: `docs/superpowers/specs/2026-08-02-capacitor-transport-decision.md`

**Interfaces:**
- Consumes: the spike's existing `loadSession()` and gitignored `src/public/session.local.json`
- Produces: a written decision — **Model A (injected)** or **Model C (CapacitorHttp)** — that Tasks 2–7 assume

- [ ] **Step 1: Add `@capacitor/core`'s native HTTP to the spike**

`CapacitorHttp` ships inside `@capacitor/core`; no extra install. Add a button that fetches an authenticated IS page from the **host** WebView, where CORS would normally block it.

In `<spike>/src/main.ts`, add to the button list:

```html
<button id="nhttp">Model C: CapacitorHttp from host</button>
```

- [ ] **Step 2: Implement the probe**

```ts
import { CapacitorHttp, CapacitorCookies } from '@capacitor/core';

document.querySelector('#nhttp')!.addEventListener('click', async () => {
  try {
    const s = await loadSession();
    if (!s) return;
    // Seed the NATIVE cookie jar (separate from the InAppBrowser's jar).
    await CapacitorCookies.setCookie({
      url: 'https://is.mendelu.cz',
      key: 'UISAuth',
      value: s.uisAuth,
    });
    const res = await CapacitorHttp.get({
      url: 'https://is.mendelu.cz/auth/',
      webFetchExtra: { credentials: 'include' },
    });
    const html = String(res.data ?? '');
    const authed = /logout\.pl/.test(html);
    show(
      `status: ${res.status}\n` +
      `bytes: ${html.length}\n` +
      `AUTHED: ${authed ? 'YES' : 'no'}\n` +
      `ctype: ${res.headers?.['Content-Type'] ?? res.headers?.['content-type'] ?? '?'}`
    );
  } catch (e) {
    show(`nhttp error: ${String(e)}`);
  }
});
```

- [ ] **Step 3: Build, install, run on Android**

```bash
source ~/android-toolchain/env.sh
cd /Users/dominik-personal/Documents/reis-capacitor-spike
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug && cd ..
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am force-stop cz.reis.spike
adb shell am start -n cz.reis.spike/.MainActivity
```

Tap the new button. Read the result with `adb exec-out screencap -p > shot.png`.

Expected, and what each outcome means:

- `status: 200` **and** `AUTHED: YES` → **native HTTP bypasses CORS and carries the cookie. Model C is viable.**
- `status: 200` but `AUTHED: no`, or `403` → the request went out unauthenticated. **Measured: this is exactly what happens on iOS with the native jar, and on Android with the explicit header.** Try the other mechanism before concluding anything.
- Any CORS error, or `status: 0` → the call fell back to the browser `fetch` path. **Model C is dead; choose Model A.**

- [ ] **Step 4: Repeat on iOS**

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "id=0F659C4E-C5AC-453F-996F-64B4B45C3A09" -derivedDataPath /tmp/reis-spike-dd build
xcrun simctl install 0F659C4E-C5AC-453F-996F-64B4B45C3A09 \
  /tmp/reis-spike-dd/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch 0F659C4E-C5AC-453F-996F-64B4B45C3A09 cz.reis.spike
```

Both platforms must pass for Model C to be chosen. Simulator screenshots need image pixels ÷ **2.287** to get tap points.

- [ ] **Step 5: Write the decision document**

Create `docs/superpowers/specs/2026-08-02-capacitor-transport-decision.md` recording: the measured result on each platform, the model chosen, and — importantly — **why the rejected model was rejected**, so it is not revisited blindly.

Include this trade-off table, filled in with the measured column:

| | Model A — injected | Model C — CapacitorHttp |
|---|---|---|
| Reuses `fetchViaProxy` seam | yes, unchanged | no, new transport in `fetchWithAuth` |
| Phone UI (#162) runs as | injected over a foreign page | a normal app |
| Styling isolation from IS CSS | must be handled | not an issue |
| Bundle delivery | into the IS page each navigation | normal Capacitor asset |
| CORS | not applicable (first-party) | bypassed natively |
| Verified? | yes — spike tests 0/0b/1b | **this task** |

- [ ] **Step 6: Commit**

```bash
cd /Users/dominik-personal/Documents/reis-extension/.claude/worktrees/reis-testing-report-887f67
git add docs/superpowers/specs/2026-08-02-capacitor-transport-decision.md
git commit -m "docs: decide the Capacitor data transport"
```

> **Gate:** do not begin Task 2 until this document exists and names a model.

---

### Task 2: The platform port — one seam for three hosts

`chrome.*` is called from 59 sites across `src/`. Replacing them ad hoc would fork the codebase. Instead introduce one interface, implement it three times, and swap at the entry point.

**Files:**
- Create: `src/platform/types.ts`
- Create: `src/platform/index.ts`
- Create: `src/platform/__tests__/index.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface ReisPlatform` with `kind: 'extension' | 'capacitor' | 'web'`, `storage: PlatformStorage`, `getAssetUrl(path: string): string`
  - `interface PlatformStorage` with `get(key: string): Promise<unknown>`, `set(key: string, value: unknown): Promise<void>`, `remove(key: string): Promise<void>`
  - `getPlatform(): ReisPlatform`
  - `setPlatform(p: ReisPlatform): void`

- [ ] **Step 1: Write the failing test**

Create `src/platform/__tests__/index.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getPlatform, setPlatform } from '../index';
import type { ReisPlatform } from '../types';

function stub(kind: ReisPlatform['kind']): ReisPlatform {
  const bag = new Map<string, unknown>();
  return {
    kind,
    storage: {
      async get(k) { return bag.get(k); },
      async set(k, v) { bag.set(k, v); },
      async remove(k) { bag.delete(k); },
    },
    getAssetUrl: (p) => `/${p}`,
  };
}

describe('platform registry', () => {
  beforeEach(() => setPlatform(stub('web')));

  it('returns the platform that was set', () => {
    expect(getPlatform().kind).toBe('web');
    setPlatform(stub('capacitor'));
    expect(getPlatform().kind).toBe('capacitor');
  });

  it('throws a useful error when nothing was installed', async () => {
    const mod = await import('../index');
    mod.__resetPlatformForTests();
    expect(() => getPlatform()).toThrow(/no platform installed/i);
  });

  it('round-trips storage through the installed platform', async () => {
    const p = stub('extension');
    setPlatform(p);
    await getPlatform().storage.set('theme', 'dark');
    expect(await getPlatform().storage.get('theme')).toBe('dark');
    await getPlatform().storage.remove('theme');
    expect(await getPlatform().storage.get('theme')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `npx vitest run src/platform/__tests__/index.test.ts`
Expected: FAIL — `Failed to resolve import "../index"`.

- [ ] **Step 3: Write the types**

Create `src/platform/types.ts`:

```ts
/**
 * The single seam between reIS app code and its host. Three hosts implement it:
 * the Chrome extension, the Capacitor app, and the dev webapp. Keeping it this
 * narrow is deliberate — every method here is a capability that genuinely
 * differs per host. Anything the same everywhere does not belong.
 */
export interface PlatformStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface ReisPlatform {
  kind: 'extension' | 'capacitor' | 'web';
  /** Settings that survive restarts. Extension: chrome.storage.local. */
  storage: PlatformStorage;
  /** Resolve a bundled asset to a loadable URL. */
  getAssetUrl(path: string): string;
}
```

- [ ] **Step 4: Write the registry**

Create `src/platform/index.ts`:

```ts
import type { ReisPlatform } from './types';

let current: ReisPlatform | null = null;

/**
 * Installed once at the entry point, before the React root renders. Reading it
 * before installation is a bug in boot order, not a condition to handle — hence
 * the throw rather than a silent fallback.
 */
export function setPlatform(p: ReisPlatform): void {
  current = p;
}

export function getPlatform(): ReisPlatform {
  if (!current) {
    throw new Error(
      'reIS: no platform installed — call setPlatform() at the entry point before rendering',
    );
  }
  return current;
}

/** Test-only escape hatch; never call from app code. */
export function __resetPlatformForTests(): void {
  current = null;
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run src/platform/__tests__/index.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add src/platform
git commit -m "feat(platform): add the host capability seam"
```

---

### Task 3: Implement the three platforms

**Files:**
- Create: `src/platform/extensionPlatform.ts`
- Create: `src/platform/capacitorPlatform.ts`
- Create: `src/platform/webPlatform.ts`
- Create: `src/platform/__tests__/webPlatform.test.ts`

**Interfaces:**
- Consumes: `ReisPlatform`, `PlatformStorage` from Task 2
- Produces: `createExtensionPlatform(): ReisPlatform`, `createCapacitorPlatform(): ReisPlatform`, `createWebPlatform(): ReisPlatform`

- [ ] **Step 1: Write the failing test for the web platform**

Create `src/platform/__tests__/webPlatform.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createWebPlatform } from '../webPlatform';

describe('webPlatform', () => {
  it('identifies as web', () => {
    expect(createWebPlatform().kind).toBe('web');
  });

  it('stores values in memory across calls', async () => {
    const p = createWebPlatform();
    await p.storage.set('lang', 'cs');
    expect(await p.storage.get('lang')).toBe('cs');
  });

  it('isolates storage between instances', async () => {
    const a = createWebPlatform();
    const b = createWebPlatform();
    await a.storage.set('lang', 'cs');
    expect(await b.storage.get('lang')).toBeUndefined();
  });

  it('resolves asset paths from the server root, tolerating a leading slash', () => {
    const p = createWebPlatform();
    expect(p.getAssetUrl('icons/x.svg')).toBe('/icons/x.svg');
    expect(p.getAssetUrl('/icons/x.svg')).toBe('/icons/x.svg');
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `npx vitest run src/platform/__tests__/webPlatform.test.ts`
Expected: FAIL — cannot resolve `../webPlatform`.

- [ ] **Step 3: Implement the web platform**

Create `src/platform/webPlatform.ts`:

```ts
import type { ReisPlatform } from './types';

/**
 * Dev-webapp host. In-memory only: the harness is meant to start from a known
 * state on every reload, and the iron rules forbid localStorage anyway.
 * Supersedes the storage half of dev/chromeShim.ts.
 */
export function createWebPlatform(): ReisPlatform {
  const bag = new Map<string, unknown>();
  return {
    kind: 'web',
    storage: {
      async get(key) { return bag.get(key); },
      async set(key, value) { bag.set(key, value); },
      async remove(key) { bag.delete(key); },
    },
    getAssetUrl: (path) => '/' + path.replace(/^\//, ''),
  };
}
```

- [ ] **Step 4: Run and verify it passes**

Run: `npx vitest run src/platform/__tests__/webPlatform.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Implement the extension platform**

Create `src/platform/extensionPlatform.ts`:

```ts
import type { ReisPlatform } from './types';

/**
 * Chrome-extension host. chrome.storage.local returns an object keyed by the
 * requested key, so a single-key read has to be unwrapped.
 */
export function createExtensionPlatform(): ReisPlatform {
  return {
    kind: 'extension',
    storage: {
      async get(key) {
        const out = await chrome.storage.local.get(key);
        return (out as Record<string, unknown>)[key];
      },
      async set(key, value) {
        await chrome.storage.local.set({ [key]: value });
      },
      async remove(key) {
        await chrome.storage.local.remove(key);
      },
    },
    getAssetUrl: (path) => chrome.runtime.getURL(path),
  };
}
```

- [ ] **Step 6: Implement the Capacitor platform**

Create `src/platform/capacitorPlatform.ts`:

```ts
import { Preferences } from '@capacitor/preferences';
import type { ReisPlatform } from './types';

/**
 * Capacitor host. Preferences is UserDefaults / SharedPreferences — fine for
 * settings, and explicitly NOT where the session token goes; that needs real
 * Keychain/Keystore (see src/platform/sessionToken.ts and Task 5).
 *
 * Preferences stores strings only, so values are JSON-encoded. `undefined` is
 * returned for a missing key to match the other platforms.
 */
export function createCapacitorPlatform(): ReisPlatform {
  return {
    kind: 'capacitor',
    storage: {
      async get(key) {
        const { value } = await Preferences.get({ key });
        if (value == null) return undefined;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      },
      async set(key, value) {
        await Preferences.set({ key, value: JSON.stringify(value) });
      },
      async remove(key) {
        await Preferences.remove({ key });
      },
    },
    // Capacitor serves bundled assets from the WebView root.
    getAssetUrl: (path) => '/' + path.replace(/^\//, ''),
  };
}
```

- [ ] **Step 7: Install the Capacitor dependency**

```bash
npm install @capacitor/core@^8 @capacitor/preferences@^8
```

- [ ] **Step 8: Run the full suite, typecheck, commit**

```bash
npm run test:run
npm run typecheck
git add src/platform package.json package-lock.json
git commit -m "feat(platform): implement extension, capacitor, and web hosts"
```

Expected: the whole existing suite stays green — nothing consumes the platform yet.

---

### Task 4: Session token capture and validation (pure logic)

Split deliberately from the storage I/O so the interesting part is unit-testable. This task adds no device code.

**Files:**
- Create: `src/platform/sessionToken.ts`
- Create: `src/platform/__tests__/sessionToken.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `const UIS_AUTH_COOKIE = 'UISAuth'`
  - `extractSessionToken(cookies: Record<string, string>): string | null`
  - `isPlausibleToken(value: unknown): value is string`
  - `buildRestoreScript(token: string): string`
  - `buildRestoreHeaders(token: string): Record<string, string>`

- [ ] **Step 1: Write the failing test**

Create `src/platform/__tests__/sessionToken.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  UIS_AUTH_COOKIE,
  extractSessionToken,
  isPlausibleToken,
  buildRestoreScript,
  buildRestoreHeaders,
} from '../sessionToken';

const REAL_SHAPE = '6NSqqyos2r0lEVg5aGkXaQnw%2FrogfwDfWoNzCB803bRQ';

describe('extractSessionToken', () => {
  it('pulls UISAuth out of a cookie bag', () => {
    expect(extractSessionToken({ UISAuth: REAL_SHAPE })).toBe(REAL_SHAPE);
  });

  it('returns null when the cookie jar is empty (the post-app-kill case)', () => {
    expect(extractSessionToken({})).toBeNull();
  });

  it('returns null rather than an empty string for a blank value', () => {
    expect(extractSessionToken({ UISAuth: '' })).toBeNull();
  });

  it('ignores unrelated cookies', () => {
    expect(extractSessionToken({ other: 'x' })).toBeNull();
  });
});

describe('isPlausibleToken', () => {
  it('accepts a real-shaped token', () => {
    expect(isPlausibleToken(REAL_SHAPE)).toBe(true);
  });

  it('rejects non-strings and blanks', () => {
    expect(isPlausibleToken(undefined)).toBe(false);
    expect(isPlausibleToken(null)).toBe(false);
    expect(isPlausibleToken(42)).toBe(false);
    expect(isPlausibleToken('')).toBe(false);
  });

  it('rejects anything short enough to be a truncation bug', () => {
    expect(isPlausibleToken('abc')).toBe(false);
  });
});

describe('buildRestoreHeaders', () => {
  it('produces a Cookie header that authenticates request #1', () => {
    expect(buildRestoreHeaders(REAL_SHAPE)).toEqual({
      Cookie: `UISAuth=${REAL_SHAPE}`,
    });
  });
});

describe('buildRestoreScript', () => {
  it('sets the cookie without an expiry, so it stays a session cookie', () => {
    const s = buildRestoreScript(REAL_SHAPE);
    expect(s).toContain('document.cookie');
    expect(s).toContain(REAL_SHAPE);
    expect(s).toContain('path=/');
    expect(s).toContain('secure');
    expect(s.toLowerCase()).not.toContain('expires');
  });

  it('escapes the token so a quote cannot break out of the script', () => {
    expect(buildRestoreScript('a"b')).toContain('"a\\"b"');
  });

  it('never throws inside the page, whatever happens', () => {
    expect(buildRestoreScript(REAL_SHAPE)).toContain('catch');
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `npx vitest run src/platform/__tests__/sessionToken.test.ts`
Expected: FAIL — cannot resolve `../sessionToken`.

- [ ] **Step 3: Implement**

Create `src/platform/sessionToken.ts`:

```ts
/**
 * The IS session is exactly one cookie. Verified against live IS: `UISAuth`,
 * domain is.mendelu.cz, path /, no Expires (session cookie), HttpOnly, Secure,
 * SameSite=Lax — and name+value+domain+path alone is enough to authenticate.
 *
 * Both WKWebView and Android WebView drop it on app kill, so it must be
 * captured and replayed. This module is the pure half: no storage, no plugin.
 */
export const UIS_AUTH_COOKIE = 'UISAuth';

/** Shorter than this and it is a truncation bug, not a token. */
const MIN_TOKEN_LENGTH = 16;

export function extractSessionToken(cookies: Record<string, string>): string | null {
  const raw = cookies[UIS_AUTH_COOKIE];
  return raw ? raw : null;
}

export function isPlausibleToken(value: unknown): value is string {
  return typeof value === 'string' && value.length >= MIN_TOKEN_LENGTH;
}

export function buildRestoreHeaders(token: string): Record<string, string> {
  return { Cookie: `${UIS_AUTH_COOKIE}=${token}` };
}

/**
 * Runs at documentStart. Deliberately sets NO `expires`, so the restored cookie
 * is a session cookie exactly like the one IS issues.
 *
 * This is only half the restore: the first request leaves before any script can
 * run, so it is authenticated by the Cookie *header* instead. This script seeds
 * the jar so every subsequent navigation carries the cookie too. Header alone
 * loses auth on the first navigation; this alone cannot authenticate request #1.
 */
export function buildRestoreScript(token: string): string {
  return `(function(){try{document.cookie=${JSON.stringify(UIS_AUTH_COOKIE)}+"="+${JSON.stringify(
    token,
  )}+"; path=/; secure";}catch(e){}})();`;
}
```

- [ ] **Step 4: Run and verify it passes**

Run: `npx vitest run src/platform/__tests__/sessionToken.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/platform/sessionToken.ts src/platform/__tests__/sessionToken.test.ts
git commit -m "feat(platform): session token capture and hybrid-restore builders"
```

---

### Task 5: Android back button drives the sheet stack

`createMobileUiSlice` has a sheet stack and **nothing anywhere handles a back gesture** — no `popstate`, no `backButton` listener. Harmless in a browser tab; in a native shell, pressing back inside a sheet exits the app.

**Files:**
- Create: `src/mobile/backButton.ts`
- Create: `src/mobile/__tests__/backButton.test.ts`

**Interfaces:**
- Consumes: `MobileUiSlice` shape from `src/store/types.ts` (`mobileSheets: unknown[]`, `popSheet(): void`)
- Produces: `handleBackPress(state: BackPressState): BackPressResult`, where
  - `interface BackPressState { sheetCount: number; popSheet(): void }`
  - `type BackPressResult = 'popped' | 'exit'`

- [ ] **Step 1: Write the failing test**

Create `src/mobile/__tests__/backButton.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleBackPress } from '../backButton';

describe('handleBackPress', () => {
  it('pops the top sheet when the stack is not empty', () => {
    const popSheet = vi.fn();
    expect(handleBackPress({ sheetCount: 1, popSheet })).toBe('popped');
    expect(popSheet).toHaveBeenCalledOnce();
  });

  it('pops only one level per press, so nested sheets unwind one at a time', () => {
    const popSheet = vi.fn();
    expect(handleBackPress({ sheetCount: 3, popSheet })).toBe('popped');
    expect(popSheet).toHaveBeenCalledOnce();
  });

  it('signals exit when no sheet is open', () => {
    const popSheet = vi.fn();
    expect(handleBackPress({ sheetCount: 0, popSheet })).toBe('exit');
    expect(popSheet).not.toHaveBeenCalled();
  });

  it('treats a negative count defensively as empty', () => {
    const popSheet = vi.fn();
    expect(handleBackPress({ sheetCount: -1, popSheet })).toBe('exit');
    expect(popSheet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `npx vitest run src/mobile/__tests__/backButton.test.ts`
Expected: FAIL — cannot resolve `../backButton`.

- [ ] **Step 3: Implement**

Create `src/mobile/backButton.ts`:

```ts
export interface BackPressState {
  sheetCount: number;
  popSheet(): void;
}

export type BackPressResult = 'popped' | 'exit';

/**
 * Android's hardware back must unwind the sheet stack before it exits the app.
 * The stack genuinely nests (Student → person, Subjects → drawer → confirm), so
 * one press pops exactly one level.
 *
 * Pure on purpose: the @capacitor/app listener is a two-line adapter over this,
 * which keeps the decision testable without a device.
 */
export function handleBackPress({ sheetCount, popSheet }: BackPressState): BackPressResult {
  if (sheetCount > 0) {
    popSheet();
    return 'popped';
  }
  return 'exit';
}
```

- [ ] **Step 4: Run and verify it passes**

Run: `npx vitest run src/mobile/__tests__/backButton.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/mobile/backButton.ts src/mobile/__tests__/backButton.test.ts
git commit -m "feat(mobile): back press unwinds the sheet stack"
```

---

### Task 6: Document saving that cannot fail silently

Measured: `URL.createObjectURL` + `a.download` + `a.click()` **saves nothing and throws nothing** on Android, and iOS WKWebView does not support `a[download]`. The current `downloadDocumentInPage` ends with exactly that sequence.

The fetch half is good and is reused verbatim — the blob came back byte-identical to `curl`. Only the save step branches.

**Files:**
- Create: `src/mobile/saveDocument.ts`
- Create: `src/mobile/__tests__/saveDocument.test.ts`
- Modify: `src/injector/documentDownloader.ts` (save step only — the fetch and error-classification logic above it is untouched)

**Interfaces:**
- Consumes: `getPlatform()` from Task 2
- Produces: `saveBlob(blob: Blob, filename: string, deps: SaveDeps): Promise<void>`, where
  - `interface SaveDeps { kind: 'extension' | 'capacitor' | 'web'; anchorSave(b: Blob, f: string): void; nativeSave(b: Blob, f: string): Promise<string>; assertExists(uri: string): Promise<boolean> }`

- [ ] **Step 1: Write the failing test**

Create `src/mobile/__tests__/saveDocument.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { saveBlob } from '../saveDocument';

function deps(over: Partial<Parameters<typeof saveBlob>[2]> = {}) {
  return {
    kind: 'capacitor' as const,
    anchorSave: vi.fn(),
    nativeSave: vi.fn(async () => 'file:///docs/x.pdf'),
    assertExists: vi.fn(async () => true),
    ...over,
  };
}

const blob = new Blob(['x'], { type: 'application/pdf' });

describe('saveBlob', () => {
  it('uses the anchor path on the extension', async () => {
    const d = deps({ kind: 'extension' });
    await saveBlob(blob, 'a.pdf', d);
    expect(d.anchorSave).toHaveBeenCalledWith(blob, 'a.pdf');
    expect(d.nativeSave).not.toHaveBeenCalled();
  });

  it('uses the native path on Capacitor, never the anchor', async () => {
    const d = deps();
    await saveBlob(blob, 'a.pdf', d);
    expect(d.nativeSave).toHaveBeenCalledWith(blob, 'a.pdf');
    expect(d.anchorSave).not.toHaveBeenCalled();
  });

  it('THROWS when the native write reports no file — the silent no-op must not survive', async () => {
    const d = deps({ assertExists: vi.fn(async () => false) });
    await expect(saveBlob(blob, 'a.pdf', d)).rejects.toThrow(/not saved/i);
  });

  it('verifies the exact uri that nativeSave returned', async () => {
    const d = deps({ nativeSave: vi.fn(async () => 'file:///docs/real.pdf') });
    await saveBlob(blob, 'a.pdf', d);
    expect(d.assertExists).toHaveBeenCalledWith('file:///docs/real.pdf');
  });

  it('does not assert existence on the extension path', async () => {
    const d = deps({ kind: 'extension' });
    await saveBlob(blob, 'a.pdf', d);
    expect(d.assertExists).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `npx vitest run src/mobile/__tests__/saveDocument.test.ts`
Expected: FAIL — cannot resolve `../saveDocument`.

- [ ] **Step 3: Implement**

Create `src/mobile/saveDocument.ts`:

```ts
export interface SaveDeps {
  kind: 'extension' | 'capacitor' | 'web';
  anchorSave(blob: Blob, filename: string): void;
  nativeSave(blob: Blob, filename: string): Promise<string>;
  assertExists(uri: string): Promise<boolean>;
}

/**
 * Measured on device: on Android, `a.download` + `a.click()` on a blob: URL
 * saves NOTHING and throws NOTHING — the WebView's DownloadListener is never
 * invoked for blob: URLs. iOS WKWebView does not support a[download] either.
 *
 * A silent no-op is the failure mode that ships, so the native path asserts the
 * file exists afterwards and throws if it does not. Do not remove that check to
 * make a test pass.
 */
export async function saveBlob(blob: Blob, filename: string, deps: SaveDeps): Promise<void> {
  if (deps.kind !== 'capacitor') {
    deps.anchorSave(blob, filename);
    return;
  }
  const uri = await deps.nativeSave(blob, filename);
  if (!(await deps.assertExists(uri))) {
    throw new Error(`Document was not saved: ${filename}`);
  }
}
```

- [ ] **Step 4: Run and verify it passes**

Run: `npx vitest run src/mobile/__tests__/saveDocument.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Route the existing downloader through it**

In `src/injector/documentDownloader.ts`, replace **only** the final save block. The
existing fetch, the 401/403 `sessionExpired` tagging, and the non-PDF content-type check
stay exactly as they are.

Replace:

```ts
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
```

with:

```ts
  const blob = await res.blob();
  await saveBlob(blob, filename, buildSaveDeps());
```

and add to the imports at the top of the file:

```ts
import { saveBlob } from '../mobile/saveDocument';
import { buildSaveDeps } from '../mobile/saveDeps';
```

- [ ] **Step 6: Write the dependency builder**

Create `src/mobile/saveDeps.ts`:

```ts
import { getPlatform } from '../platform';
import type { SaveDeps } from './saveDocument';

/**
 * Wires saveBlob to the real host. The Capacitor branch is imported lazily so
 * the extension bundle never pulls in @capacitor/* — it would bloat the build
 * and the plugins are meaningless outside the app.
 */
export function buildSaveDeps(): SaveDeps {
  return {
    kind: getPlatform().kind,

    anchorSave(blob, filename) {
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    },

    async nativeSave(blob, filename) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64 = await blobToBase64(blob);
      const { uri } = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
      return uri;
    },

    async assertExists(uri) {
      const { Filesystem } = await import('@capacitor/filesystem');
      try {
        const stat = await Filesystem.stat({ path: uri });
        return stat.size > 0;
      } catch {
        return false;
      }
    },
  };
}

/** Filesystem.writeFile takes base64, not a Blob. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.onload = () => {
      const result = String(reader.result);
      // Strip the "data:<mime>;base64," prefix that readAsDataURL adds.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}
```

- [ ] **Step 7: Install the plugins**

```bash
npm install @capacitor/filesystem@^8 @capacitor/share@^8 @capacitor/app@^8
```

- [ ] **Step 8: Run the full suite and typecheck**

```bash
npm run test:run
npm run typecheck
```

Expected: green. The extension path is behaviourally unchanged — `kind === 'extension'` still takes the anchor branch with identical code.

- [ ] **Step 9: Commit**

```bash
git add src/mobile src/injector/documentDownloader.ts package.json package-lock.json
git commit -m "feat(mobile): platform-aware document save with an existence assertion"
```

---

### Task 6b: The Capacitor transport — `CapacitorHttp` behind `fetchWithAuth`

**Added after Task 1 chose Model C.** #158 predicted this exact shape: *"A Capacitor shell
slots in as a third transport behind the same function — no call-site changes."*

The measured trap: supplying the cookie the wrong way per platform returns a **403 with a
perfectly normal-looking response**, not an error. The transport must detect that itself.

**Files:**
- Create: `src/api/capacitorTransport.ts`
- Create: `src/api/__tests__/capacitorTransport.test.ts`
- Modify: `src/api/client.ts` (add one branch to `fetchWithAuth`)

**Interfaces:**
- Consumes: `getPlatform()` (Task 2)
- Produces:
  - `buildCookieDelivery(platform: 'ios' | 'android' | 'web', token: string): CookieDelivery`
  - `interface CookieDelivery { headers: Record<string, string>; seedNativeJar: boolean }`
  - `isAuthenticatedHtml(html: string): boolean`
  - `fetchViaCapacitor(url: string, token: string, deps: CapacitorTransportDeps): Promise<Response>`

- [ ] **Step 1: Write the failing test**

Create `src/api/__tests__/capacitorTransport.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  buildCookieDelivery,
  isAuthenticatedHtml,
  fetchViaCapacitor,
} from '../capacitorTransport';

const TOKEN = '6NSqqyos2r0lEVg5aGkXaQnw%2FrogfwDfWoNzCB803bRQ';

describe('buildCookieDelivery', () => {
  // MEASURED on device: Android ignores a hand-set Cookie header (403) and
  // needs the native jar; iOS is the exact inverse. Do not "simplify" this.
  it('uses the native jar on android, with no Cookie header', () => {
    expect(buildCookieDelivery('android', TOKEN)).toEqual({
      headers: {},
      seedNativeJar: true,
    });
  });

  it('uses an explicit Cookie header on ios, without seeding the jar', () => {
    expect(buildCookieDelivery('ios', TOKEN)).toEqual({
      headers: { Cookie: `UISAuth=${TOKEN}` },
      seedNativeJar: false,
    });
  });

  it('falls back to the header form on web', () => {
    expect(buildCookieDelivery('web', TOKEN).seedNativeJar).toBe(false);
  });
});

describe('isAuthenticatedHtml', () => {
  it('treats a logout link as proof of authentication', () => {
    expect(isAuthenticatedHtml('<a href="/system/logout.pl">Log out</a>')).toBe(true);
  });

  it('treats a page without one as unauthenticated', () => {
    expect(isAuthenticatedHtml('<form action="/system/login.pl">')).toBe(false);
  });
});

describe('fetchViaCapacitor', () => {
  function deps(over = {}) {
    return {
      platform: 'android' as const,
      setCookie: vi.fn(async () => {}),
      httpGet: vi.fn(async () => ({
        status: 200,
        data: '<a href="/system/logout.pl">x</a>',
        headers: { 'Content-Type': 'text/html' },
      })),
      ...over,
    };
  }

  it('seeds the native jar on android before requesting', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
    expect(d.setCookie).toHaveBeenCalledWith({
      url: 'https://is.mendelu.cz',
      key: 'UISAuth',
      value: TOKEN,
    });
  });

  it('does NOT seed the jar on ios', async () => {
    const d = deps({ platform: 'ios' as const });
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
    expect(d.setCookie).not.toHaveBeenCalled();
  });

  it('returns a Response carrying the body', async () => {
    const res = await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, deps());
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('logout.pl');
  });

  it('THROWS a sessionExpired error on a 403 — the measured silent-auth-failure case', async () => {
    const d = deps({
      httpGet: vi.fn(async () => ({ status: 403, data: 'denied', headers: {} })),
    });
    await expect(
      fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d),
    ).rejects.toMatchObject({ sessionExpired: true });
  });

  it('THROWS on a 200 that is not authenticated — a wrong-cookie-mechanism bug looks exactly like this', async () => {
    const d = deps({
      httpGet: vi.fn(async () => ({
        status: 200,
        data: '<form action="/system/login.pl">',
        headers: {},
      })),
    });
    await expect(
      fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d),
    ).rejects.toMatchObject({ sessionExpired: true });
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `npx vitest run src/api/__tests__/capacitorTransport.test.ts`
Expected: FAIL — cannot resolve `../capacitorTransport`.

- [ ] **Step 3: Implement**

Create `src/api/capacitorTransport.ts`:

```ts
import { UIS_AUTH_COOKIE } from '../platform/sessionToken';

export interface CookieDelivery {
  headers: Record<string, string>;
  seedNativeJar: boolean;
}

export interface CapacitorHttpResponse {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
}

export interface CapacitorTransportDeps {
  platform: 'ios' | 'android' | 'web';
  setCookie(o: { url: string; key: string; value: string }): Promise<void>;
  httpGet(o: {
    url: string;
    headers?: Record<string, string>;
  }): Promise<CapacitorHttpResponse>;
}

/**
 * MEASURED on device (2026-08-02), and the two platforms are exact opposites:
 *
 *   Android — a hand-set `Cookie` header does NOT reach the server (403). The
 *             native layer manages cookies, so the jar must be seeded.
 *   iOS     — the reverse: the explicit header works, seeding the jar alone 403s.
 *
 * Do not "simplify" this into one branch, and do not do both at once — on
 * Android the explicit header actively produced a 403, so combining them is not
 * known to be safe.
 */
export function buildCookieDelivery(
  platform: 'ios' | 'android' | 'web',
  token: string,
): CookieDelivery {
  if (platform === 'android') {
    return { headers: {}, seedNativeJar: true };
  }
  return { headers: { Cookie: `${UIS_AUTH_COOKIE}=${token}` }, seedNativeJar: false };
}

/**
 * IS answers an unauthenticated request with a normal 200 login page, so status
 * alone cannot tell us whether auth worked. A logout link is the signal — the
 * same one the spike probes used.
 */
export function isAuthenticatedHtml(html: string): boolean {
  return /logout\.pl/.test(html);
}

function sessionExpired(message: string): Error {
  const err = new Error(message) as Error & { sessionExpired?: boolean };
  err.sessionExpired = true;
  return err;
}

export async function fetchViaCapacitor(
  url: string,
  token: string,
  deps: CapacitorTransportDeps,
): Promise<Response> {
  const delivery = buildCookieDelivery(deps.platform, token);

  if (delivery.seedNativeJar) {
    await deps.setCookie({
      url: 'https://is.mendelu.cz',
      key: UIS_AUTH_COOKIE,
      value: token,
    });
  }

  const res = await deps.httpGet({ url, headers: delivery.headers });
  const body = String(res.data ?? '');

  if (res.status === 401 || res.status === 403) {
    throw sessionExpired(`HTTP ${res.status}`);
  }
  // A 200 that is not authenticated means either the session lapsed OR the
  // cookie was delivered the wrong way for this platform. Both are auth
  // failures; neither must be allowed to reach a parser as if it were data.
  if (!isAuthenticatedHtml(body)) {
    throw sessionExpired('Authenticated request returned an unauthenticated page');
  }

  return new Response(body, {
    status: res.status,
    headers: new Headers({
      'Content-Type': res.headers?.['Content-Type'] ?? 'text/html',
    }),
  });
}
```

- [ ] **Step 4: Run and verify it passes**

Run: `npx vitest run src/api/__tests__/capacitorTransport.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Add the branch to `fetchWithAuth`**

In `src/api/client.ts`, insert **before** the existing `isInIframe()` branch:

```ts
    if (getPlatform().kind === 'capacitor') {
        const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');
        const token = await loadStoredToken();
        return fetchViaCapacitor(url, token, {
            platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
            setCookie: (o) => CapacitorCookies.setCookie(o),
            httpGet: (o) => CapacitorHttp.get(o),
        });
    }
```

and add to the imports at the top of `src/api/client.ts`:

```ts
import { getPlatform } from '../platform';
import { fetchViaCapacitor } from './capacitorTransport';
import { loadStoredToken } from '../platform/tokenStore';
```

- [ ] **Step 6: Write the token store**

Create `src/platform/tokenStore.ts`:

```ts
import { getPlatform } from './index';
import { isPlausibleToken } from './sessionToken';

export const TOKEN_KEY = 'reis.session.uisAuth';

/**
 * NOTE: this is Preferences (UserDefaults / SharedPreferences), not Keychain or
 * Keystore, and UISAuth is a live credential. Acceptable for a debug build;
 * moving to real secure storage is a tracked follow-up that must land before
 * any public release.
 */
export async function saveStoredToken(token: string): Promise<void> {
  await getPlatform().storage.set(TOKEN_KEY, token);
}

export async function loadStoredToken(): Promise<string> {
  const value = await getPlatform().storage.get(TOKEN_KEY);
  if (!isPlausibleToken(value)) {
    const err = new Error('No stored IS session') as Error & { sessionExpired?: boolean };
    err.sessionExpired = true;
    throw err;
  }
  return value;
}
```

- [ ] **Step 7: Verify nothing regressed**

```bash
npm run test:run
npm run typecheck
npm run build
```

Expected: green. The new branch is unreachable unless `getPlatform().kind === 'capacitor'`, which only the Capacitor entry sets.

- [ ] **Step 8: Commit**

```bash
git add src/api/capacitorTransport.ts src/api/__tests__/capacitorTransport.test.ts \
        src/api/client.ts src/platform/tokenStore.ts
git commit -m "feat(api): CapacitorHttp transport with per-platform cookie delivery"
```

---

### Task 7: The Capacitor app shell

Brings Tasks 2–6b together into something that runs on a device.

> **Task 1 chose Model C**, so `openWebView` here is **login-only**: it exists to let the
> student authenticate against real IS and to capture `UISAuth`. Once captured, reIS
> renders as a normal app and all data goes through the Task 6b transport. The steps below
> reflect that.

**Files:**
- Create: `capacitor.config.ts`
- Create: `vite.capacitor.config.ts`
- Create: `capacitor/index.html`
- Create: `capacitor/main.capacitor.ts`
- Modify: `package.json` (scripts)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `setPlatform` + `createCapacitorPlatform` (Tasks 2–3), `buildRestoreScript` / `buildRestoreHeaders` / `extractSessionToken` / `isPlausibleToken` (Task 4), `handleBackPress` (Task 5)
- Produces: a debug build installable on both simulators

- [ ] **Step 1: Add the Capacitor config**

Create `capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cz.reis.app',
  appName: 'reIS',
  webDir: 'dist-capacitor',
  plugins: {
    SplashScreen: { launchAutoHide: false },
  },
};

export default config;
```

- [ ] **Step 2: Add the Vite config**

Create `vite.capacitor.config.ts`:

```ts
import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In a git worktree, packages resolve to the MAIN checkout's node_modules.
const NODE_MODULES_ROOT = resolve(
  dirname(createRequire(import.meta.url).resolve('vite/package.json')),
  '..',
);

export default defineConfig({
  root: resolve(__dirname, 'capacitor'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    outDir: resolve(__dirname, 'dist-capacitor'),
    emptyOutDir: true,
  },
  server: { fs: { allow: [resolve(__dirname), NODE_MODULES_ROOT] } },
});
```

- [ ] **Step 3: Add the HTML entry**

Create `capacitor/index.html`:

```html
<!DOCTYPE html>
<html lang="en" data-theme="mendelu-dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>reIS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.capacitor.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Write the app entry**

Create `capacitor/main.capacitor.ts`:

```ts
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { InAppBrowser } from '@capgo/capacitor-inappbrowser';
import { setPlatform } from '@/platform';
import { createCapacitorPlatform } from '@/platform/capacitorPlatform';
import {
  buildRestoreHeaders,
  buildRestoreScript,
  extractSessionToken,
  isPlausibleToken,
} from '@/platform/sessionToken';
import { handleBackPress } from '@/mobile/backButton';
import { useAppStore } from '@/store/useAppStore';

const IS_URL = 'https://is.mendelu.cz/auth/';
const TOKEN_KEY = 'reis.session.uisAuth';

// Must run before anything reads the platform.
setPlatform(createCapacitorPlatform());

// Android hardware back unwinds the sheet stack before exiting.
void App.addListener('backButton', () => {
  const s = useAppStore.getState();
  const result = handleBackPress({
    sheetCount: s.mobileSheets.length,
    popSheet: s.popSheet,
  });
  if (result === 'exit') void App.exitApp();
});

/**
 * Both WebView engines drop UISAuth on app kill, so a stored token is replayed
 * with the hybrid: the Cookie header authenticates request #1 (nothing else can
 * — it leaves before any script runs), and the documentStart script seeds the
 * jar so later navigations carry it too. Verified on both platforms.
 */
async function openIs(): Promise<void> {
  const stored = await createCapacitorPlatform().storage.get(TOKEN_KEY);
  const restore = isPlausibleToken(stored)
    ? {
        headers: buildRestoreHeaders(stored),
        preShowScript: buildRestoreScript(stored),
      }
    : { preShowScript: '' };

  await InAppBrowser.openWebView({
    url: IS_URL,
    title: 'reIS',
    // Required: openWebView throws without this when preShowScript is set.
    isPresentAfterPageLoad: true,
    preShowScriptInjectionTime: 'documentStart',
    ...restore,
  });

  await captureToken();
}

/** Persist whatever UISAuth the WebView ended up with, so cold start can restore it. */
async function captureToken(): Promise<void> {
  const cookies = await InAppBrowser.getCookies({
    url: 'https://is.mendelu.cz/',
    includeHttpOnly: true,
  });
  const token = extractSessionToken(cookies as Record<string, string>);
  if (isPlausibleToken(token)) {
    await createCapacitorPlatform().storage.set(TOKEN_KEY, token);
  }
}

void SplashScreen.hide();
void openIs();
```

> ⚠️ `@capacitor/preferences` is UserDefaults / SharedPreferences, **not** Keychain or
> Keystore, and `UISAuth` is a live credential. Shipping it this way is acceptable for a
> debug build only. Moving `TOKEN_KEY` to a real secure-storage plugin is tracked as a
> follow-up before any public release — see "Follow-ups" below.

- [ ] **Step 5: Add the scripts and ignore the build output**

Add to `package.json` `scripts`:

```json
"build:capacitor": "vite build --config vite.capacitor.config.ts",
"cap:sync": "npm run build:capacitor && npx cap sync",
"cap:android": "npm run cap:sync && npx cap run android",
"cap:ios": "npm run cap:sync && npx cap run ios"
```

Append to `.gitignore`:

```
dist-capacitor/
/android
/ios
```

- [ ] **Step 6: Install the remaining dependencies and add the platforms**

```bash
npm install @capacitor/cli@^8 @capacitor/ios@^8 @capacitor/android@^8 \
  @capacitor/splash-screen@^8 @capgo/capacitor-inappbrowser@8.13.2
source ~/android-toolchain/env.sh
npm run build:capacitor
npx cap add android
npx cap add ios
```

Expected: both platform folders are created. The first iOS build resolves SPM packages and takes >10 minutes — it is not hung.

- [ ] **Step 7: Run on Android and verify the session survives a kill**

```bash
source ~/android-toolchain/env.sh
npm run cap:sync
cd android && ./gradlew assembleDebug && cd ..
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n cz.reis.app/.MainActivity
```

Log into IS in the WebView. Then, **without tapping inside the authenticated page** (that
is how a previous session hit the logout link):

```bash
adb shell pidof cz.reis.app          # note the PID
adb shell am force-stop cz.reis.app
adb shell am start -n cz.reis.app/.MainActivity
adb shell pidof cz.reis.app          # must be a DIFFERENT PID
```

Expected: after the cold start the app lands on an **authenticated** IS page with no
login prompt. That is the whole point of Tasks 4 and 7 together.

If it shows the login page, check in this order: (1) was a token stored — read it back
with `Preferences`; (2) did `getCookies` return `UISAuth` before the kill; (3) is
`isPresentAfterPageLoad: true` still set.

- [ ] **Step 8: Verify the back button**

With a sheet open, press Android back. Expected: the sheet closes and the app stays open.
Press back with no sheet open. Expected: the app exits.

```bash
adb shell input keyevent KEYCODE_BACK
```

- [ ] **Step 9: Run on iOS**

```bash
npm run cap:sync
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "id=0F659C4E-C5AC-453F-996F-64B4B45C3A09" -derivedDataPath /tmp/reis-cap-dd build
xcrun simctl install 0F659C4E-C5AC-453F-996F-64B4B45C3A09 \
  /tmp/reis-cap-dd/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch 0F659C4E-C5AC-453F-996F-64B4B45C3A09 cz.reis.app
```

Repeat the kill/restore check with `xcrun simctl terminate` in place of `am force-stop`.

- [ ] **Step 10: Confirm the extension still builds and passes**

```bash
npm run build
npm run test:run
npm run typecheck
```

Expected: all green. Nothing in Tasks 2–7 changes extension behaviour.

- [ ] **Step 11: Commit**

```bash
git add capacitor.config.ts vite.capacitor.config.ts capacitor/ package.json package-lock.json .gitignore
git commit -m "feat(capacitor): app shell with session restore and back-button handling"
```

---

## Follow-ups — deliberately out of scope for this plan

Each is its own plan. None blocks the shell.

| Item | Why separate |
|---|---|
| **Secure storage for `UISAuth`** | `@capacitor/preferences` is not Keychain/Keystore. **Must land before any public release** — it is the one follow-up with a security bar, not just a feature bar. |
| **Local notifications** | Needs the staleness guard designed first (a notification for a cancelled class is worse than silence). |
| **OTA updates** | #158 requires classifying the 210 parser commits by whether they were genuine IS-breakage fixes before committing to a paid dependency. |
| **eduroam native config** | #159. Android verified; iOS unverified. |
| **`chrome.storage.sync` replacement** | The only genuine capability loss. Needs a backend decision — drop it or build one. |
| **Google Drive OAuth on mobile** | `chrome.identity.launchWebAuthFlow` → `@capacitor/browser` + custom URL scheme. Do not escalate the `drive.file` scope. |
| **Migrating the other 59 `chrome.*` sites** | Tasks 2–3 build the seam; moving every call site is mechanical volume best done in its own pass with the extension test suite as the gate. |
| **Model A as a fallback** | If MENDELU ever adds server-side origin/UA checks, `CapacitorHttp` is the surface that breaks first and injection becomes the fallback. The spike's injection probes are kept for that reason. |

## Self-review notes

- **Spec coverage:** #158's day-one gates are all closed by the spike, not by this plan. Sequencing items 3–6 map to Tasks 7, 2–3, 6, and 4+7. Items 7–8 (notifications, OTA) are explicitly deferred above with reasons.
- **The `chrome.*` port is only seeded, not completed.** Tasks 2–3 create the seam and Task 6 uses it; the remaining call sites are listed as a follow-up rather than pretended into scope.
- **Task 1 genuinely gates Task 7's shape.** That is called out at both ends rather than assuming Model A silently.
- **Type consistency:** `SaveDeps.kind` reuses `ReisPlatform['kind']`'s union verbatim; `handleBackPress` takes `sheetCount`/`popSheet` matching `createMobileUiSlice`'s `mobileSheets` array and `popSheet()`; `buildRestoreHeaders`/`buildRestoreScript` are consumed in Task 7 with the signatures defined in Task 4.

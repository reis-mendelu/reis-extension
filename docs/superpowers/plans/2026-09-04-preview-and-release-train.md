# Preview Deployment and Release Train Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reIS app as a static site, deploy it to Vercel from a new `test` branch so screens can be reviewed on a URL before they ship, and make the `test` → `main` release PR the thing that submits to the browser stores.

**Architecture:** A new Vite build config compiles the existing `dev/` harness entry to `dist-web/`, and the page boots the app's own demo mode so the synthetic `demo` dataset fills IndexedDB client-side. No server, database or secret is involved. Vercel builds that from the `test` branch. Three GitHub workflows turn `test` → `main` into a release: a gate that requires a green deployment of the exact SHA, an injected checklist, and a tagger that fires the existing `publish.yml`.

**Tech Stack:** Vite 7, React, Vitest (happy-dom), GitHub Actions, Vercel CLI 54.

Spec: [`docs/superpowers/specs/2026-09-04-preview-and-release-train-design.md`](../specs/2026-09-04-preview-and-release-train-design.md)

## Global Constraints

- **Only two `VITE_*` variables may be set on the Vercel project:** `VITE_DEV_SOCIETY=reis` and `VITE_PREVIEW_BUILD=true`. Vite inlines `VITE_*` into the bundle, so any other one is published. `VITE_USE_MOCK_DATA` must NOT be set — it leaves every tab on a skeleton (see Task 3).
- **`VITE_EXTENSION_SECRET` and any `VITE_SUPABASE_*` must never be present** when `build:web` runs. Task 3 enforces this in code.
- **Never modify a parser** to satisfy a lint or test failure (`CLAUDE.md`). No task here touches one.
- **No `localStorage` / `sessionStorage`**, no custom CSS (DaisyUI/Tailwind classes only), no `useEffect` for data fetching, max 200 lines per file.
- **Test first:** every code task writes a failing test before the implementation.
- **`main` stays the repository default branch.** Do not change it.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Branch for this work: `feat/web-preview-and-release-train`, based on `main` (the `test` branch does not exist until Task 5).

## File Structure

| File | Responsibility |
|---|---|
| `dev/harnessEnabled.ts` (new) | One pure predicate deciding whether harness-only behaviour is active. Consumed by `phoneOverride` and the banner, so the rule lives in one place. |
| `dev/__tests__/harnessEnabled.test.ts` (new) | Its tests. |
| `dev/phoneOverride.ts` (modify) | Guard widened from `import.meta.env.DEV` to the predicate. |
| `dev/previewBanner.ts` (new) | Renders the "synthetic data, writes not saved" banner. Lives in `dev/`, not `src/`, so it cannot reach the extension or App Store binary. |
| `dev/__tests__/previewBanner.test.ts` (new) | Its tests. |
| `dev/main.web.tsx` (modify) | Boots demo mode, then mounts the banner. |
| `dev/bootDemoMode.ts` (new) | Puts the deployed preview into the app's own demo mode. Replaces the `VITE_USE_MOCK_DATA` path, which leaves every tab on a skeleton. |
| `dev/__tests__/bootDemoMode.test.ts` (new) | Its tests. |
| `scripts/assert-web-build-env.mjs` (new) | Fails `build:web` if a forbidden variable is present. |
| `scripts/__tests__/assertWebBuildEnv.test.ts` (new) | Its tests. |
| `vite.web.build.config.ts` (new) | Build-only config: no dev-server plugins, `outDir: dist-web`. |
| `vercel.json` (new) | SPA rewrite. |
| `.github/workflows/ci.yml` (modify) | Adds a `build-web` job. |
| `.github/workflows/release-gate.yml` (new) | Required check on PRs into `main`. |
| `.github/workflows/release-checklist.yml` (new) | Injects the checklist into the release PR. |
| `.github/release-checklist.md` (new) | The checklist's single source. |
| `.github/workflows/release-tag.yml` (new) | Pushes `vX.Y.Z` on merge to `main`. |
| `.claude/commands/release.md` (modify) | Rewritten for the release-PR flow. |
| `CLAUDE.md` (modify) | Documents the branch model. |

---

### Task 1: The harness predicate, and widening the phone override

Today `dev/phoneOverride.ts` is guarded by `import.meta.env.DEV`. In a production build that is `false`, so the phone override, `?mobile=1` and `?welcome=1` are all dead code — and because `pointer: coarse` never flips in a desktop browser, the deployed preview would stay desktop at every width.

**Files:**
- Create: `dev/harnessEnabled.ts`
- Create: `dev/__tests__/harnessEnabled.test.ts`
- Modify: `dev/phoneOverride.ts:14`

**Interfaces:**
- Consumes: nothing.
- Produces: `isHarnessEnabled(env: HarnessEnv): boolean` and `interface HarnessEnv { DEV?: boolean; VITE_PREVIEW_BUILD?: string }`, both exported from `dev/harnessEnabled.ts`. Task 2 uses `HarnessEnv`.

- [ ] **Step 1: Write the failing test**

Create `dev/__tests__/harnessEnabled.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isHarnessEnabled } from '../harnessEnabled';

describe('isHarnessEnabled', () => {
  it('is on in a dev server build', () => {
    expect(isHarnessEnabled({ DEV: true })).toBe(true);
  });

  it('is on in a preview build even though DEV is false', () => {
    expect(isHarnessEnabled({ DEV: false, VITE_PREVIEW_BUILD: 'true' })).toBe(true);
  });

  it('is off in an extension or Capacitor build', () => {
    expect(isHarnessEnabled({ DEV: false })).toBe(false);
  });

  // Vite inlines every VITE_* variable as a STRING. A `false` that arrives as
  // the string "false" is truthy, so a bare truthiness check would turn the
  // harness on for anyone who set the flag to switch it off.
  it('treats any value other than the string "true" as off', () => {
    expect(isHarnessEnabled({ DEV: false, VITE_PREVIEW_BUILD: 'false' })).toBe(false);
    expect(isHarnessEnabled({ DEV: false, VITE_PREVIEW_BUILD: '' })).toBe(false);
    expect(isHarnessEnabled({ DEV: false, VITE_PREVIEW_BUILD: '1' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run dev/__tests__/harnessEnabled.test.ts`
Expected: FAIL — `Failed to resolve import "../harnessEnabled"`.

- [ ] **Step 3: Write the implementation**

Create `dev/harnessEnabled.ts`:

```ts
/**
 * Whether harness-only behaviour is active.
 *
 * Two builds want it: the `npm run dev:web` dev server (`DEV`), and the
 * deployed Vercel preview, which is a production build and so has `DEV` false.
 * The extension and Capacitor builds set neither and must never get it.
 *
 * Kept as a pure function over an injected env rather than reading
 * `import.meta.env` directly, so it can be tested — the same reason
 * `resolveDevPhoneOverride` is a pure function next door.
 */
export interface HarnessEnv {
  DEV?: boolean;
  VITE_PREVIEW_BUILD?: string;
}

export function isHarnessEnabled(env: HarnessEnv): boolean {
  return env.DEV === true || env.VITE_PREVIEW_BUILD === 'true';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run dev/__tests__/harnessEnabled.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Widen the guard in `dev/phoneOverride.ts`**

Add the import below the existing ones at the top of the file:

```ts
import { isHarnessEnabled } from './harnessEnabled';
```

Then replace line 14, which currently reads:

```ts
if (import.meta.env.DEV) {
```

with:

```ts
if (isHarnessEnabled(import.meta.env)) {
```

And update the comment directly above it, which currently reads `// Guarded by import.meta.env.DEV so it cannot ship.`, to:

```ts
// Guarded by isHarnessEnabled so it cannot ship in the extension or Capacitor
// build. It IS on in the deployed preview, which is a production build: without
// that, `pointer: coarse` never flips in a desktop browser and the preview
// would stay desktop at every width. `?welcome=1` rides the same guard, which
// is what makes the first-run welcome screen reachable there at all.
```

- [ ] **Step 6: Verify nothing else regressed**

Run: `npx vitest run dev/ && npm run typecheck`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add dev/harnessEnabled.ts dev/__tests__/harnessEnabled.test.ts dev/phoneOverride.ts
git commit -m "$(cat <<'EOF'
feat(dev): let the harness overrides run in a preview build

phoneOverride was guarded by import.meta.env.DEV, so in a production build the
phone override and the ?mobile= / ?welcome= escape hatches were dead code — and
pointer: coarse never flips in a desktop browser, so a deployed preview would
stay desktop at every width.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The preview banner

Two facts about the deployed site are easy and expensive to forget: the data is synthetic, and a publish that appears to succeed there wrote nothing (`VITE_DEV_SOCIETY=reis` routes writes to an in-memory store, and `CLAUDE.md` says never to cite those as evidence). A banner states both on the page.

It lives in `dev/`, never `src/`, so it cannot reach the extension or the App Store binary.

**Files:**
- Create: `dev/previewBanner.ts`
- Create: `dev/__tests__/previewBanner.test.ts`
- Modify: `dev/main.web.tsx`

**Interfaces:**
- Consumes: `HarnessEnv` from `dev/harnessEnabled.ts` (Task 1).
- Produces: `shouldShowPreviewBanner(env: HarnessEnv): boolean` and `mountPreviewBanner(env: HarnessEnv, doc?: Document): void`, exported from `dev/previewBanner.ts`.

- [ ] **Step 1: Write the failing test**

Create `dev/__tests__/previewBanner.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { shouldShowPreviewBanner, mountPreviewBanner } from '../previewBanner';

describe('shouldShowPreviewBanner', () => {
  it('shows on the deployed preview', () => {
    expect(shouldShowPreviewBanner({ DEV: false, VITE_PREVIEW_BUILD: 'true' })).toBe(true);
  });

  // Deliberately NOT keyed off isHarnessEnabled: a local dev:web run already
  // knows it is local, and a permanent banner over every screen would get in
  // the way of the UI verification screenshots (scripts/shot.ts).
  it('stays out of the way on a local dev server', () => {
    expect(shouldShowPreviewBanner({ DEV: true })).toBe(false);
  });

  it('never shows in an extension or Capacitor build', () => {
    expect(shouldShowPreviewBanner({ DEV: false })).toBe(false);
  });
});

describe('mountPreviewBanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('appends nothing when the banner is not wanted', () => {
    mountPreviewBanner({ DEV: true }, document);
    expect(document.querySelector('[data-testid="preview-banner"]')).toBeNull();
  });

  it('names both facts a reader has to know', () => {
    mountPreviewBanner({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, document);
    const banner = document.querySelector('[data-testid="preview-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Sample data');
    expect(banner?.textContent).toContain('not saved');
  });

  it('mounts only once even if called twice', () => {
    mountPreviewBanner({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, document);
    mountPreviewBanner({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, document);
    expect(document.querySelectorAll('[data-testid="preview-banner"]')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run dev/__tests__/previewBanner.test.ts`
Expected: FAIL — `Failed to resolve import "../previewBanner"`.

- [ ] **Step 3: Write the implementation**

Create `dev/previewBanner.ts`:

```ts
import type { HarnessEnv } from './harnessEnabled';

const BANNER_ID = 'reis-preview-banner';

/**
 * Whether to paint the preview banner.
 *
 * Preview builds only — not local `dev:web`. Locally you already know it is
 * local, and a permanent bar across the top would sit in every screenshot
 * scripts/shot.ts takes.
 */
export function shouldShowPreviewBanner(env: HarnessEnv): boolean {
  return env.VITE_PREVIEW_BUILD === 'true';
}

/**
 * Appends a non-dismissible bar naming the two things about this deployment
 * that are expensive to forget: the data is synthetic, and writes go to an
 * in-memory store, so a publish that looks like it worked here proves nothing.
 *
 * Plain DOM rather than a React component, and in dev/ rather than src/, so it
 * cannot be imported into the shipped app by accident.
 */
export function mountPreviewBanner(env: HarnessEnv, doc: Document = document): void {
  if (!shouldShowPreviewBanner(env)) return;
  if (doc.getElementById(BANNER_ID)) return;

  const banner = doc.createElement('div');
  banner.id = BANNER_ID;
  banner.dataset.testid = 'preview-banner';
  banner.className =
    'fixed bottom-0 inset-x-0 z-50 bg-warning text-warning-content text-xs text-center px-3 py-1';
  banner.textContent =
    'Preview build — Sample data, not a real student. Changes here are not saved.';
  doc.body.appendChild(banner);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run dev/__tests__/previewBanner.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Mount it from the harness entry**

In `dev/main.web.tsx`, append at the very end of the file (after the `./devAdminSession` import):

```ts
// Last: a bar naming what this deployment is. Only paints when
// VITE_PREVIEW_BUILD is set, so a local dev:web run is untouched.
import { mountPreviewBanner } from './previewBanner';
mountPreviewBanner(import.meta.env);
```

- [ ] **Step 6: Verify**

Run: `npx vitest run dev/ && npm run typecheck && npx eslint dev/previewBanner.ts dev/main.web.tsx --max-warnings=0`
Expected: PASS all three.

- [ ] **Step 7: Commit**

```bash
git add dev/previewBanner.ts dev/__tests__/previewBanner.test.ts dev/main.web.tsx
git commit -m "$(cat <<'EOF'
feat(dev): name what the preview deployment is, on the page

Two facts about the deployed site are easy to forget and expensive to forget:
the data is synthetic, and VITE_DEV_SOCIETY routes writes to an in-memory store,
so a publish that appears to succeed there is not evidence a publish works.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Demo-mode boot and the web build target

The standalone app exists only as a Vite dev server today. This adds the build —
and, first, the thing that makes the build worth deploying at all.

**Read this before starting.** The plan originally had the preview run on
`VITE_USE_MOCK_DATA=true`. That was verified wrong in a browser:

- `initMockData()` (`src/utils/initMockData.ts`) only loads a dataset into
  IndexedDB. It never sets `handshakeDone`, `firstSyncSettled` or an identity,
  so **every tab sits on a skeleton forever** — observed, not theorised.
  `createDemoSlice` sets all three and its own comment says why.
- It defaults to `DEFAULT_MOCK_SOCIETY = 'esn'`, not `demo`. Only the `demo`
  dataset fills `studyPlan`, `studyStats` and `studyComparison`.
- Nothing suppressed the app's IS Mendelu fetches, so the page retried
  `is.mendelu.cz/auth/student/studium.pl` in a CORS-blocked loop.

The app's own `enterDemo()` fixes all three, and `createContextSlice.ts:20`
returns early while `demoMode` is on, which is what stops the fetch loop. So the
preview boots demo mode, and **`VITE_USE_MOCK_DATA` is never set**.

**Files:**
- Create: `dev/bootDemoMode.ts`
- Create: `dev/__tests__/bootDemoMode.test.ts`
- Modify: `dev/main.web.tsx`
- Create: `scripts/assert-web-build-env.mjs`
- Create: `scripts/__tests__/assertWebBuildEnv.test.ts`
- Create: `vite.web.build.config.ts`
- Create: `vercel.json`
- Modify: `package.json` (scripts)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `HarnessEnv` from `dev/harnessEnabled.ts` (Task 1).
- Produces: `shouldBootDemoMode(env: HarnessEnv): boolean` and
  `bootDemoMode(env: HarnessEnv): Promise<void>` from `dev/bootDemoMode.ts`; the
  npm script `build:web`; output directory `dist-web/`; and
  `findForbiddenWebBuildVars(env: Record<string, string | undefined>): string[]`
  from `scripts/assert-web-build-env.mjs`.

- [ ] **Step A1: Write the failing demo-boot test**

Create `dev/__tests__/bootDemoMode.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { shouldBootDemoMode } from '../bootDemoMode';

describe('shouldBootDemoMode', () => {
  it('boots on the deployed preview', () => {
    expect(shouldBootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'true' })).toBe(true);
  });

  // A local dev:web run reads the real scraped snapshot. Entering demo mode
  // there would wipe it (enterDemo calls wipeSeeded) and replace a developer's
  // real data with fabricated data they did not ask for.
  it('never boots on a local dev server', () => {
    expect(shouldBootDemoMode({ DEV: true })).toBe(false);
  });

  it('never boots in an extension or Capacitor build', () => {
    expect(shouldBootDemoMode({ DEV: false })).toBe(false);
  });

  it('treats any value other than the string "true" as off', () => {
    expect(shouldBootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'false' })).toBe(false);
  });
});

describe('bootDemoMode', () => {
  it('does nothing when the flag is absent', async () => {
    const enterDemo = vi.fn();
    const { bootDemoMode } = await import('../bootDemoMode');
    await bootDemoMode({ DEV: true }, { enterDemo });
    expect(enterDemo).not.toHaveBeenCalled();
  });

  it('enters demo mode when the flag is set', async () => {
    const enterDemo = vi.fn().mockResolvedValue(undefined);
    const { bootDemoMode } = await import('../bootDemoMode');
    await bootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, { enterDemo });
    expect(enterDemo).toHaveBeenCalledOnce();
  });

  // A failed boot must leave the page usable rather than throwing into the
  // module graph — the banner and the shell should still render.
  it('does not throw when entering demo mode fails', async () => {
    const enterDemo = vi.fn().mockRejectedValue(new Error('nope'));
    const { bootDemoMode } = await import('../bootDemoMode');
    await expect(
      bootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, { enterDemo })
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step A2: Run it to verify it fails**

Run: `npx vitest run dev/__tests__/bootDemoMode.test.ts`
Expected: FAIL — cannot resolve `../bootDemoMode`.

- [ ] **Step A3: Implement it**

Create `dev/bootDemoMode.ts`:

```ts
import { useAppStore } from '../src/store/useAppStore';
import { logError } from '../src/utils/reportError';
import type { HarnessEnv } from './harnessEnabled';

/**
 * Whether to put the app into demo mode at boot.
 *
 * Preview builds only. A local `dev:web` run must never do this: it reads the
 * real scraped snapshot, and `enterDemo()` calls `wipeSeeded()` on the way IN,
 * so booting demo locally would delete a developer's real data.
 */
export function shouldBootDemoMode(env: HarnessEnv): boolean {
  return env.VITE_PREVIEW_BUILD === 'true';
}

/**
 * Puts the deployed preview into the app's own demo mode.
 *
 * Not `VITE_USE_MOCK_DATA`: `initMockData()` only loads a dataset into
 * IndexedDB, leaving `handshakeDone` and `firstSyncSettled` false — every tab
 * then sits on a skeleton forever — and it defaults to the `esn` dataset, which
 * has no study plan or stats. `enterDemo()` loads `MOCK_REGISTRY.demo`, sets
 * those flags and a fabricated identity, and puts the store into the state that
 * makes `createContextSlice` skip the IS Mendelu fetch that a browser can only
 * answer with a CORS error anyway.
 *
 * `deps` exists so the decision and the call can be tested without a store.
 */
export async function bootDemoMode(
  env: HarnessEnv,
  deps: { enterDemo: () => Promise<void> } = {
    enterDemo: () => useAppStore.getState().enterDemo(),
  }
): Promise<void> {
  if (!shouldBootDemoMode(env)) return;
  try {
    await deps.enterDemo();
  } catch (err) {
    // A failed demo boot must not take the page down with it — the shell and
    // the preview banner should still render so the failure is visible.
    logError('bootDemoMode.enterDemo', err);
  }
}
```

- [ ] **Step A4: Run it to verify it passes**

Run: `npx vitest run dev/__tests__/bootDemoMode.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step A5: Call it from the harness entry**

In `dev/main.web.tsx`, insert **before** the existing `mountPreviewBanner` block
at the end of the file:

```ts
// Before the banner: put the deployed preview into the app's own demo mode, so
// the screens have data and stop trying to reach IS Mendelu. No-op locally.
import { bootDemoMode } from './bootDemoMode';
void bootDemoMode(import.meta.env);
```

- [ ] **Step A6: Verify it renders, in a browser**

```bash
VITE_PREVIEW_BUILD=true PORT=3100 npx vite --config vite.web.config.ts
```

Open `http://localhost:3100/?mobile=1`. Confirm, and report what you actually
saw:
- Screens show content or genuine empty states — **no grey skeleton bars and no
  "Načítám…" that never resolves**. Skeletons mean the boot did not take.
- The browser console shows **no repeating** `getUserParams: Failed to fetch` /
  CORS errors against `is.mendelu.cz`.
- Both banners are present at phone width: the app's own `Ukázka` DemoBanner at
  the top, and the preview banner at the bottom.

- [ ] **Step A7: Commit the demo boot**

```bash
git add dev/bootDemoMode.ts dev/__tests__/bootDemoMode.test.ts dev/main.web.tsx
git commit -m "$(cat <<'EOF'
feat(dev): boot the preview into the app's own demo mode

VITE_USE_MOCK_DATA does not work for this: initMockData only loads a dataset
into IndexedDB and never sets handshakeDone, firstSyncSettled or an identity, so
every tab sat on a skeleton forever. It also defaults to the esn dataset rather
than demo, and nothing stopped the app retrying is.mendelu.cz in a CORS-blocked
loop.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

Now the build itself.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/assertWebBuildEnv.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findForbiddenWebBuildVars } from '../assert-web-build-env.mjs';

describe('findForbiddenWebBuildVars', () => {
  it('allows the three variables the preview build needs', () => {
    expect(
      findForbiddenWebBuildVars({
        VITE_DEV_SOCIETY: 'reis',
        VITE_PREVIEW_BUILD: 'true',
        PATH: '/usr/bin',
      })
    ).toEqual([]);
  });

  it('rejects the extension secret', () => {
    expect(findForbiddenWebBuildVars({ VITE_EXTENSION_SECRET: 'abc' })).toEqual([
      'VITE_EXTENSION_SECRET',
    ]);
  });

  it('rejects any Supabase credential by prefix', () => {
    expect(
      findForbiddenWebBuildVars({
        VITE_SUPABASE_URL: 'https://x.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'k',
      })
    ).toEqual(['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL']);
  });

  // An empty value still means the variable is present in the environment, and
  // a .env that sets it empty today can set it non-empty tomorrow. Fail on
  // presence, not on truthiness.
  it('rejects a forbidden variable even when it is empty', () => {
    expect(findForbiddenWebBuildVars({ VITE_EXTENSION_SECRET: '' })).toEqual([
      'VITE_EXTENSION_SECRET',
    ]);
  });

  it('ignores unrelated VITE_ variables it does not know about', () => {
    expect(findForbiddenWebBuildVars({ VITE_SOMETHING_ELSE: 'x' })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/assertWebBuildEnv.test.ts`
Expected: FAIL — cannot resolve `../assert-web-build-env.mjs`.

- [ ] **Step 3: Write the guard script**

Create `scripts/assert-web-build-env.mjs`:

```js
// Vite inlines every VITE_* variable into the bundle, and this bundle is served
// from a public URL. The preview needs exactly three variables; anything that
// carries a credential must stop the build rather than be published.
//
// Asserts on the ENVIRONMENT, not on the built output: grepping the bundle for
// a secret's value would require the value to be present in CI and in the test.

const FORBIDDEN_EXACT = ['VITE_EXTENSION_SECRET'];
const FORBIDDEN_PREFIXES = ['VITE_SUPABASE_'];

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string[]} forbidden variable names present in `env`, sorted
 */
export function findForbiddenWebBuildVars(env) {
  return Object.keys(env)
    .filter(
      (key) =>
        FORBIDDEN_EXACT.includes(key) ||
        FORBIDDEN_PREFIXES.some((prefix) => key.startsWith(prefix))
    )
    .sort();
}

// Only act when run as a script, so importing it from a test is side-effect free.
if (import.meta.url === `file://${process.argv[1]}`) {
  const found = findForbiddenWebBuildVars(process.env);
  if (found.length > 0) {
    console.error(
      `\nRefusing to build the public web bundle: ${found.join(', ')} present in the environment.\n` +
        `Vite inlines VITE_* into the bundle, so these would be published.\n` +
        `The web build takes exactly VITE_DEV_SOCIETY and VITE_PREVIEW_BUILD.\n`
    );
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/__tests__/assertWebBuildEnv.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the build config**

Create `vite.web.build.config.ts`:

```ts
import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import { resolve } from 'path';
import webDevConfig from './vite.web.config';

// The two dev-server plugins, by the `name` each one actually returns —
// verified against dev/snapshotPlugin.ts:33 and dev/adminSessionPlugin.ts:65.
// A name that matches nothing filters nothing, and the build then fails inside
// dev-server middleware that has no business running here.
const DEV_SERVER_PLUGINS = ['reis-snapshot-refresh', 'reis-dev-admin-session'];

// Build-only variant of the localhost:3000 harness config, for the deployed
// preview. Two differences, both deliberate:
//
//  1. No snapshot or admin-session plugin. Both are dev-server middleware and
//     do not exist in a build. Nothing is lost: the preview runs in mock mode,
//     where loadRealDataSnapshot returns early and no snapshot is ever fetched,
//     and devAdminSession bails because VITE_DEV_SOCIETY is set.
//  2. An explicit outDir — `dist-web/`, so it cannot collide with the WXT
//     extension output or dist-capacitor/.
//
// The env this expects (VITE_DEV_SOCIETY, VITE_PREVIEW_BUILD) comes from the `build:web` script, which refuses to run
// if anything carrying a credential is also present.
export default defineConfig(async (env) => {
  const base = (await (typeof webDevConfig === 'function'
    ? webDevConfig(env)
    : webDevConfig)) as UserConfig;

  // Filtered by name rather than by rebuilding the list from scratch, so a
  // plugin added to the dev config later is carried over here instead of being
  // silently lost. The spread is what replaces the array — mergeConfig
  // CONCATENATES plugin arrays, so passing plugins in the second argument would
  // put the dev-server plugins straight back.
  const plugins = (base.plugins ?? []).filter(
    (p) =>
      !(
        p &&
        typeof p === 'object' &&
        'name' in p &&
        DEV_SERVER_PLUGINS.includes(p.name as string)
      )
  );

  return mergeConfig(
    { ...base, plugins },
    {
      build: {
        outDir: resolve(__dirname, 'dist-web'),
        emptyOutDir: true,
        sourcemap: false,
      },
    }
  );
});
```

- [ ] **Step 6: Add the scripts and ignore the output**

In `package.json`, add next to the other `dev:web*` scripts:

```json
"build:web": "node scripts/assert-web-build-env.mjs && VITE_DEV_SOCIETY=reis VITE_PREVIEW_BUILD=true vite build --config vite.web.build.config.ts",
```

In `.gitignore`, next to the existing `dist-capacitor/` entry on line 148:

```
# Static web preview build output (vite.web.build.config.ts)
dist-web/
```

- [ ] **Step 7: Add the SPA rewrite**

Create `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build:web",
  "outputDirectory": "dist-web",
  "installCommand": "npm ci",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 8: Run the build and prove mock mode survives it**

This is the step the whole plan is sequenced around — the demo boot from Step A6 has only ever run through the dev server, never a build.

```bash
npm run build:web
npx serve dist-web -l 4173
```

Open `http://localhost:4173` and confirm:
- Subjects, schedule and exams render with demo content.
- Documents, holidays, campus events and profile show **empty states**. This is expected — `SocietyDataset` has no fields for them.
- The warning banner is visible at the bottom.
- `http://localhost:4173/?mobile=1` renders the phone layout.

If the build fails or the app renders blank, stop and diagnose before continuing — every later task assumes this works.

- [ ] **Step 9: Prove the secret guard actually fires**

```bash
VITE_EXTENSION_SECRET=x npm run build:web
```
Expected: exit code 1, message naming `VITE_EXTENSION_SECRET`, and **no** `dist-web/` written.

- [ ] **Step 10: Commit**

```bash
git add scripts/assert-web-build-env.mjs scripts/__tests__/assertWebBuildEnv.test.ts vite.web.build.config.ts vercel.json package.json .gitignore
git commit -m "$(cat <<'EOF'
feat(web): build the standalone app as a static site

The dev harness existed only as a Vite dev server. This adds a build target so
it can be deployed: mock mode fills IndexedDB from the synthetic demo dataset,
which makes the snapshot and admin-session dev plugins unnecessary.

The build refuses to run if VITE_EXTENSION_SECRET or a VITE_SUPABASE_* variable
is in the environment — Vite inlines VITE_* into a bundle that is served from a
public URL.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Keep the build target from rotting

A build config nobody runs breaks silently. CI runs it on every PR.

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the `build:web` script (Task 3).
- Produces: a `Build web preview` check on every PR.

- [ ] **Step 1: Add the job**

Append to the `jobs:` block in `.github/workflows/ci.yml`, matching the indentation and the `actions/checkout@v7` / `actions/setup-node@v7` pinning the existing jobs use:

```yaml
  # The preview build target is exercised by nothing else — no test imports it
  # and no developer runs it by hand — so without this job it would break
  # silently and only surface as a failed Vercel deploy on `test`.
  build-web:
    name: Build web preview
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build:web
      # An empty or near-empty bundle still "succeeds". Assert the entry HTML
      # and at least one hashed asset actually landed.
      - name: Assert the bundle is real
        run: |
          set -euo pipefail
          test -f dist-web/index.html
          test -n "$(find dist-web/assets -name '*.js' -print -quit)"
```

- [ ] **Step 2: Verify the workflow parses**

Run: `npx --yes js-yaml .github/workflows/ci.yml > /dev/null`
Expected: no output, exit 0. (`pyyaml` is NOT installed on this machine — `python3 -c "import yaml"` fails, so use the npx command above.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: build the web preview on every PR

Nothing else exercises the build target, so it would break silently and surface
only as a failed deploy.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The `test` branch and the Vercel project

Infrastructure. No code. Do this only after Task 3's build has been proven locally.

**Files:** none.

**Interfaces:**
- Consumes: `vercel.json` and `build:web` (Task 3).
- Produces: the `test` branch; a Vercel project whose production branch is `test`; the deployed URL; and the **exact GitHub Deployments environment name**, which Task 6 needs.

- [ ] **Step 1: Merge the work so far to `main`**

Open a PR for `feat/web-preview-and-release-train` against `main` and merge it the current way. `test` must be cut from a `main` that already has the build target, or its first deploy fails.

- [ ] **Step 2: Create `test`**

```bash
git checkout main && git pull && git checkout -b test && git push -u origin test
```

- [ ] **Step 3: Create the Vercel project**

```bash
vercel link --yes --project reis-extension-preview
vercel git connect
```

Then in the Vercel dashboard, on the project's Settings:
- **Git → Production Branch:** `test`
- **Git → ensure "GitHub Deployments" / deployment statuses are enabled.** Task 6 queries the GitHub Deployments API; if Vercel is not creating deployment records the gate has nothing to read and blocks every release.
- **Environment Variables**, on Production *and* Preview: `VITE_DEV_SOCIETY=reis` and `VITE_PREVIEW_BUILD=true`. Nothing else, and specifically NOT `VITE_USE_MOCK_DATA`.
- Build settings come from `vercel.json` and should need no dashboard entry.

- [ ] **Step 4: Deploy and verify**

```bash
vercel --prod
```

Open the returned URL and repeat Task 3 Step 8's checks against the deployed site: subjects/schedule/exams populated; documents/holidays/events/profile empty; banner visible; `?mobile=1` gives the phone layout.

- [ ] **Step 5: Record the deployment environment name**

```bash
gh api repos/reis-mendelu/reis-extension/deployments --jq '.[0:5] | .[] | {environment, sha}'
```

Write down the `environment` value verbatim. **Do not guess it.** MySoft's deploy-alert feature shipped with `'production'` where the environment is really `prod`, so the one case it existed for never fired — and its unit tests asserted the wrong name too, defending the bug instead of catching it.

If this command returns nothing, GitHub Deployments are off. Fix that in Step 3 before continuing; Task 6 cannot be written without this value.

- [ ] **Step 6: Confirm the plan question from the spec**

The account is a personal Hobby scope with `reis-page` already on it. Confirm with the user that a second non-commercial project is fine on that plan before treating the preview as permanent.

---

### Task 6: The release gate

The required check on every PR into `main`. Makes the preview load-bearing: a commit that was never deployed cannot be released.

**Files:**
- Create: `.github/workflows/release-gate.yml`

**Interfaces:**
- Consumes: the deployment environment name recorded in Task 5 Step 5.
- Produces: a required check named `Release gate`.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/release-gate.yml`, replacing `PUT_ENVIRONMENT_NAME_HERE` with the string recorded in Task 5:

```yaml
name: Release gate

# Gates every PR into `main`. Only the release train may reach production:
# `main` is what publish.yml turns into a store submission, and a store
# submission cannot be taken back.
#
#   head == test   -> this repo's own `test`, and a successful Vercel deployment
#                     must exist for this exact SHA. `test` can hold a commit
#                     whose deploy is still building or has failed, so the
#                     branch name alone proves nothing.
#   otherwise      -> rejected. `main` is not the default PR base, so a
#                     mis-targeted PR is normal and this is the thing that
#                     catches it.

on:
  pull_request:
    # `edited` fires when a PR's base branch changes. Without it, a PR
    # retargeted from `test` to `main` never runs this workflow, and a required
    # check that has never reported blocks the merge with "Expected — waiting
    # for status" that re-running cannot clear.
    types: [opened, edited, synchronize, reopened]
    branches:
      - main

permissions:
  contents: read

# Never cancel in progress: branch protection reads this check's conclusion, and
# a cancelled run leaves no conclusion at all.
concurrency:
  group: release-gate-${{ github.event.pull_request.number }}
  cancel-in-progress: false

jobs:
  # The job NAME is the required-check context in branch protection. Renaming it
  # without updating the protection rule in the same change silently
  # un-enforces the gate.
  gate:
    name: Release gate
    runs-on: ubuntu-latest
    permissions:
      contents: read
      # `permissions:` sets every unlisted scope to none, and the deployments
      # API needs its own — `contents: read` does not cover it.
      deployments: read
    timeout-minutes: 10
    steps:
      - name: Check this PR's path into main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_REPO: ${{ github.repository }}
          HEAD_REPO: ${{ github.event.pull_request.head.repo.full_name }}
          HEAD_REF: ${{ github.event.pull_request.head.ref }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          DEPLOY_ENV: PUT_ENVIRONMENT_NAME_HERE
        run: |
          set -euo pipefail

          # The same-repo guard matters: a fork branch merely named `test` must
          # not claim the release lane.
          if [ "$HEAD_REF" != "test" ] || [ "$HEAD_REPO" != "$GH_REPO" ]; then
            echo "::error::Head branch '$HEAD_REF' may not target main. Only this repository's 'test' branch may — that is what the release train is. Retarget this PR at 'test'."
            exit 1
          fi

          # -f on a GET becomes a query parameter, so a space or slash in the
          # environment name is encoded correctly.
          ids="$(gh api -X GET "repos/$GH_REPO/deployments" \
            -f environment="$DEPLOY_ENV" -f sha="$HEAD_SHA" --jq '.[].id')"

          for id in $ids; do
            if gh api "repos/$GH_REPO/deployments/$id/statuses" --jq '.[].state' \
               | grep -qx success; then
              echo "✓ Green '$DEPLOY_ENV' deployment found for $HEAD_SHA"
              exit 0
            fi
          done

          echo "::error::No successful '$DEPLOY_ENV' deployment for $HEAD_SHA. A release needs a green preview deploy of exactly this commit. If the deploy is still running, wait and re-run this check. If someone merged into 'test' after this PR was opened, the tip moved — 'test' is meant to be frozen while a release PR is open."
          exit 1
```

- [ ] **Step 2: Verify the workflow parses**

Run: npx --yes js-yaml .github/workflows/release-gate.yml > /dev/null
Expected: no output, exit 0.

- [ ] **Step 3: Confirm the environment name is not a placeholder**

Run: `! grep -q PUT_ENVIRONMENT_NAME_HERE .github/workflows/release-gate.yml && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release-gate.yml
git commit -m "$(cat <<'EOF'
ci: gate main behind a green preview deploy of the exact commit

main is what publish.yml turns into an irreversible store submission, so only
the test branch may reach it, and only a commit someone could actually have
looked at on the preview URL.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Turn it on**

In GitHub → Settings → Branches → branch protection for `main`: require the status check named **`Release gate`**, and disallow force pushes. The check must have reported at least once before it is selectable, so open a throwaway PR into `main` first if the name does not appear.

---

### Task 7: The release checklist

**Files:**
- Create: `.github/release-checklist.md`
- Create: `.github/workflows/release-checklist.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: a checklist injected into the body of each release PR.

- [ ] **Step 1: Write the checklist source**

Create `.github/release-checklist.md`:

```markdown
<!-- BEGIN release-checklist -->

- [ ] Version bumped in **both** `package.json` and `wxt.config.ts`, to the same value. A mismatch ships a manifest showing the wrong version.
- [ ] The preview URL for this exact commit was opened and looked at, at phone and desktop width.
- [ ] Store listing text and screenshots still describe what the extension now does.
- [ ] Anything removed in this release is gone from the privacy policy too.
- [ ] No new `VITE_*` variable was added to the Vercel project.

Merging this PR pushes the `v<version>` tag, which submits to Chrome, Firefox and Edge. Store review is 1–3 days for Chrome and can be weeks for AMO, and a submission cannot be recalled.

<!-- END release-checklist -->
```

- [ ] **Step 2: Write the workflow**

Create `.github/workflows/release-checklist.yml`:

```yaml
name: Release checklist

# Injects the checklist into the test -> main release PR when it is opened, so
# it can't be skipped or drift from its single source in
# .github/release-checklist.md. GitHub's native PR templates cannot be selected
# by target branch, hence a workflow.

on:
  pull_request:
    types: [opened, reopened]
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: release-checklist-${{ github.event.pull_request.number }}
  cancel-in-progress: false

jobs:
  inject-checklist:
    name: Inject release checklist
    runs-on: ubuntu-latest
    permissions:
      contents: read
      # Needed only by `gh pr edit` to rewrite this PR's body.
      pull-requests: write
    # Only this repository's own test -> main PR, so a fork or a branch merely
    # named `test` cannot trigger a write to a PR body.
    if: >-
      github.head_ref == 'test' &&
      github.event.pull_request.head.repo.full_name == github.repository
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false

      - name: Inject the checklist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
        run: |
          set -euo pipefail

          begin='<!-- BEGIN release-checklist -->'
          end='<!-- END release-checklist -->'

          # Read the body live rather than from the event payload: the payload is
          # a snapshot taken at open time and `gh pr edit` replaces the whole
          # body, so an author edit made while this job queued would be silently
          # reverted.
          body="$(gh pr view "$PR_NUMBER" --json body --jq '.body // ""')"

          # Substring match, not line equality: GitHub stores PR bodies with CRLF
          # line endings once anyone edits in the web UI, so an exact comparison
          # would miss a marker that is really there and append a second copy.
          if printf '%s\n' "$body" | grep -qF "$begin"; then
            echo "Checklist already present — nothing to do."
            exit 0
          fi

          block="$(awk -v b="$begin" -v e="$end" '
            index($0, b) { f = 1 }
            f { print }
            index($0, e) { f = 0 }
          ' .github/release-checklist.md)"

          if [ -z "$block" ]; then
            echo "::error::.github/release-checklist.md has no BEGIN/END release-checklist block."
            exit 1
          fi

          # Append below the author's summary, never overwrite it.
          {
            if [ -n "$body" ]; then printf '%s\n\n---\n\n' "$body"; fi
            printf '## Release checklist\n\n%s\n' "$block"
          } > new_body.md

          gh pr edit "$PR_NUMBER" --body-file new_body.md
          echo "Injected the release checklist into PR #$PR_NUMBER."
```

- [ ] **Step 3: Verify both parse and the markers are balanced**

```bash
npx --yes js-yaml .github/workflows/release-checklist.yml > /dev/null
test "$(grep -c 'BEGIN release-checklist' .github/release-checklist.md)" = 1
test "$(grep -c 'END release-checklist' .github/release-checklist.md)" = 1
echo OK
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add .github/release-checklist.md .github/workflows/release-checklist.yml
git commit -m "$(cat <<'EOF'
ci: inject the release checklist into the release PR

Keeps the checklist in one place and out of anyone's memory, on the one PR whose
merge is an irreversible store submission.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: The release tagger

Turns a merge into `main` into the `vX.Y.Z` tag that fires the existing `publish.yml`.

**Files:**
- Create: `.github/workflows/release-tag.yml`

**Interfaces:**
- Consumes: the `version` field of `package.json`.
- Produces: a pushed `v<version>` tag; `publish.yml` is unchanged and triggers on it.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/release-tag.yml`:

```yaml
name: Release tag

# On a merge into main, push the tag that publish.yml already listens for. The
# version itself is bumped in the release PR, so what gets submitted is visible
# in a diff before the irreversible step.

on:
  push:
    branches:
      - main

permissions:
  contents: read

# Serialize: two merges in quick succession must not race two taggings.
concurrency:
  group: release-tag
  cancel-in-progress: false

jobs:
  tag:
    name: Tag the release
    runs-on: ubuntu-latest
    permissions:
      # Pushing a tag is a write to the repository.
      contents: write
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          # Tags are needed to tell an already-released version from a new one.
          fetch-depth: 0

      - name: Push v<version> if it does not exist yet
        run: |
          set -euo pipefail

          version="$(node -p "require('./package.json').version")"
          if [ -z "$version" ]; then
            echo "::error::package.json has no version field."
            exit 1
          fi
          tag="v$version"

          # The load-bearing check. Without it, ANY later push to main — a
          # README fix, a back-merge — re-pushes an existing tag or re-submits a
          # version the stores have already reviewed and will reject.
          if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
            echo "$tag already exists — nothing to release. (Bump the version in the release PR to ship a new one.)"
            exit 0
          fi

          # Also check the remote: a tag pushed from a laptop may not be in this
          # checkout's refs if it was created after the clone.
          if [ -n "$(git ls-remote --tags origin "refs/tags/$tag")" ]; then
            echo "$tag already exists on the remote — nothing to release."
            exit 0
          fi

          git tag "$tag"
          git push origin "$tag"
          echo "Pushed $tag. publish.yml will submit to Chrome, Firefox and Edge."
```

- [ ] **Step 2: Verify it parses**

Run: npx --yes js-yaml .github/workflows/release-tag.yml > /dev/null
Expected: no output, exit 0.

- [ ] **Step 3: Sanity-check the version read**

Run: `node -p "require('./package.json').version"`
Expected: the current version, e.g. `5.1.0` — confirming the expression the workflow uses works in this repo.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release-tag.yml
git commit -m "$(cat <<'EOF'
ci: push the release tag when the release PR merges

publish.yml already listens for v* tags; this stops the tag being something a
human types. The existence check is load-bearing — without it any later push to
main would re-submit a version the stores have already reviewed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Rewrite `/release` and document the branch model

**Files:**
- Modify: `.claude/commands/release.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the documented working contract.

- [ ] **Step 1: Rewrite `.claude/commands/release.md`**

Replace the whole file with:

```markdown
# /release

Opens the release PR that ships `test` to the stores. Merging it pushes the tag;
CI does the rest.

## Steps

1. **Preflight** — abort if anything is wrong:
   - `git status` — must be clean
   - Confirm you are on `test` and it is up to date with `origin/test`
   - `gh pr list --base main --state open` — must be empty. Two open release PRs
     race the same tag.
   - Read the current version from `package.json`

2. **Ask the user** (AskUserQuestion, both in one message):
   - New version number (suggest the next patch increment)
   - One-line summary of what this release contains

3. **Bump on `test`**:
   - Edit `package.json`: `"version"`
   - Edit `wxt.config.ts`: `version:` inside the `manifest:` block — the same value
   - Commit: `chore: bump to X.Y.Z - <summary>`
   - Push to `test`

4. **Wait for the preview deploy** of that exact commit to go green. The release
   gate requires it, and it is the last chance to look at what is shipping.

5. **Open the release PR**: `gh pr create --base main --head test --title "release: X.Y.Z - <summary>"`.
   The checklist is injected automatically. Work through it.

6. **Stop.** Merging is the user's call — it is an irreversible store submission.

## Rules
- Never bump on `main`. The version must be in the release PR's diff.
- `package.json` and `wxt.config.ts` move together or the manifest shows the wrong version.
- **Do not merge into `test` while the release PR is open.** The gate requires a
  green deploy of the PR's head SHA, and a merge moves the tip out from under it.
- Never push a `v*` tag by hand. `release-tag.yml` owns that.

## Reference

Merge → `release-tag.yml` pushes `vX.Y.Z` → `publish.yml` builds and submits via
`wxt submit`.

**Store review SLAs:** Chrome 1–3 days · Firefox AMO days–weeks (manual review) ·
Edge 1–7 days.

iOS is **not** part of this flow and is still released by hand.

**GitHub Secrets** (repo → Settings → Secrets → Actions):

| Store | Secrets |
|-------|---------|
| Chrome | `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` |
| Firefox | `FIREFOX_EXTENSION_ID`, `FIREFOX_API_KEY`, `FIREFOX_API_SECRET` |
| Edge | `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY` |

> `CHROME_REFRESH_TOKEN` is permanent only while the Google OAuth consent screen
> is set to **"In production"** (currently set). If it reverts to "Testing",
> tokens expire after 7 days.
```

- [ ] **Step 2: Document the branch model in `CLAUDE.md`**

Insert a new section directly after the "Local dev, release, and commands" section:

```markdown
## Branches and releasing

`feature branch → test → main`. Never commit directly on `test` or `main`.

- **Base every PR on `test`**: `gh pr create --base test`. `main` is still the
  repository default branch — this is a public repo, and the default branch is
  what a visitor's Code tab, a fresh clone and every load-unpacked instruction
  resolve to, so it points at released code. The cost is that PRs open with the
  wrong base; the release gate catches it.
- A branch cut from `main` must merge `origin/test` in and retarget before
  going further, or it goes stale and conflicts at the next release.
- `test` auto-deploys to the Vercel preview. It runs the synthetic `demo`
  dataset, so **documents, holidays, campus events and profile render empty
  there** — expected, not a bug — and writes go to an in-memory store, so a
  publish that appears to work on the preview is not evidence a publish works.
- `main` accepts only the `test` → `main` release PR, and merging it submits to
  the stores. Use `/release`.
- **Do not merge into `test` while a release PR is open.**
```

- [ ] **Step 3: Verify the docs match reality**

Run: `grep -n "build:web" package.json && grep -n "Branches and releasing" CLAUDE.md`
Expected: both found.

- [ ] **Step 4: Commit**

```bash
git add .claude/commands/release.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: rewrite /release for the release-PR flow

The tag is no longer something a human types, and the branch model needs to be
written down where it is read — including the fact that main stays the default
branch on purpose, and what the preview cannot show.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Sequencing note

Tasks 1–4 land on `main` through the current flow, as one PR. Task 5 creates
`test` and the Vercel project from that `main`. Tasks 6–9 then go through the
new flow — PR into `test` — which also serves as its first real exercise.

Tasks 6 and 7 cannot be verified until a release PR actually exists, so the
first release PR is the acceptance test for the whole train. Expect to fix
something on it; that is what it is for.

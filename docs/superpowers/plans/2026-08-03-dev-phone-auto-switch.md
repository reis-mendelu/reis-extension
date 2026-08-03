# Dev Phone Auto-Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the standalone dev webapp at `localhost:3000` switch to the phone layout automatically when the browser viewport goes narrow, instead of requiring a manual `?mobile=1`.

**Architecture:** A pure resolver in `src/utils/` decides the dev override from the `?mobile=` query param and the current `isNarrow` flag; `dev/phoneOverride.ts` wires it to the store, applying it once at load and re-applying it on every `isNarrow` change. The production `resolvePhoneViewport` rule (`isTouch && isNarrow`) is untouched.

**Tech Stack:** TypeScript, Zustand, Vitest, Vite (dev webapp entry).

**Spec:** `docs/superpowers/specs/2026-08-03-dev-phone-auto-switch-design.md`

## Global Constraints

- Scope is the dev webapp only. Do **not** modify `src/utils/resolvePhoneViewport.ts` — its `isTouch && isNarrow` rule is production behavior and stays as-is.
- `dev/phoneOverride.ts` must stay wrapped in `if (import.meta.env.DEV)` so it cannot ship.
- An explicit `?mobile=1` / `?mobile=0` must keep pinning the layout and must win over viewport width. `e2e/serenity/specs/mobile-shell.spec.ts:122` depends on `?mobile=1` reaching the phone branch.
- Do **not** add another `matchMedia('(max-width: 767px)')` call. The 767px threshold already exists in three places (`src/store/slices/createViewportSlice.ts:17`, `src/hooks/ui/useIsMobile.ts:3`, `src/components/AppShell.tsx:23`); read `isNarrow` from the store instead of adding a fourth.
- Tests must live under `src/**` — vitest's `include` is `['src/**/*.{test,spec}.{js,ts,jsx,tsx}', 'scripts/**/*.{test,spec}.{js,ts,jsx,tsx}']`, so a test file placed in `dev/` would silently never run.
- Max 200 lines per file (project convention).

---

### Task 1: Pure dev-override resolver

**Files:**
- Create: `src/utils/resolveDevPhoneOverride.ts`
- Test: `src/utils/__tests__/resolveDevPhoneOverride.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveDevPhoneOverride({ param: string | null; isNarrow: boolean }): boolean` and the exported interface `DevPhoneOverrideInput`. Task 2 imports both.

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/resolveDevPhoneOverride.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveDevPhoneOverride } from '../resolveDevPhoneOverride';

describe('resolveDevPhoneOverride', () => {
  it('param "1" pins the phone branch regardless of width', () => {
    expect(resolveDevPhoneOverride({ param: '1', isNarrow: false })).toBe(true);
    expect(resolveDevPhoneOverride({ param: '1', isNarrow: true })).toBe(true);
  });

  it('param "0" pins the desktop branch regardless of width', () => {
    expect(resolveDevPhoneOverride({ param: '0', isNarrow: true })).toBe(false);
    expect(resolveDevPhoneOverride({ param: '0', isNarrow: false })).toBe(false);
  });

  it('follows the viewport when no param is given', () => {
    expect(resolveDevPhoneOverride({ param: null, isNarrow: true })).toBe(true);
    expect(resolveDevPhoneOverride({ param: null, isNarrow: false })).toBe(false);
  });

  it('ignores an unrecognised param value and follows the viewport', () => {
    expect(resolveDevPhoneOverride({ param: 'yes', isNarrow: true })).toBe(true);
    expect(resolveDevPhoneOverride({ param: '', isNarrow: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/utils/__tests__/resolveDevPhoneOverride.test.ts
```

Expected: FAIL — `Failed to resolve import "../resolveDevPhoneOverride"`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/utils/resolveDevPhoneOverride.ts`:

```ts
export interface DevPhoneOverrideInput {
  /** The `?mobile=` query param value, or null when absent. */
  param: string | null;
  isNarrow: boolean;
}

/**
 * Decides the dev-webapp phone override.
 *
 * An explicit `?mobile=1` / `?mobile=0` pins the layout; anything else follows
 * the viewport width. Returns a plain boolean rather than the tri-state the
 * store accepts: `false` at a wide width is what `isTouch && isNarrow` would
 * have produced anyway, so pinning it costs nothing and keeps the caller simple.
 */
export function resolveDevPhoneOverride({ param, isNarrow }: DevPhoneOverrideInput): boolean {
  if (param === '1') return true;
  if (param === '0') return false;
  return isNarrow;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/utils/__tests__/resolveDevPhoneOverride.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/resolveDevPhoneOverride.ts src/utils/__tests__/resolveDevPhoneOverride.test.ts
git commit -m "feat(dev): add resolveDevPhoneOverride, a pure dev phone-override resolver"
```

---

### Task 2: Wire the resolver to the store in the dev entry

**Files:**
- Modify: `dev/phoneOverride.ts` (entire file, currently 11 lines)

**Interfaces:**
- Consumes: `resolveDevPhoneOverride` from Task 1; `useAppStore` from `src/store/useAppStore`, using `getState()`, `subscribe()`, and the `setDevPhoneOverride(value: boolean | null)` action defined in `src/store/slices/createMobileUiSlice.ts:31`.
- Produces: nothing importable — side-effect module.

**Critical detail:** `useAppStore` is created with a plain `create<AppState>()(...)` and does **not** use the `subscribeWithSelector` middleware. The selector form `subscribe(selector, listener)` is therefore unavailable — `subscribe(listener)` fires on *every* store change. The listener must compare `isNarrow` against the last applied value and bail when unchanged. Without that guard, every unrelated store write calls `setDevPhoneOverride`, which is itself a `set()`, re-notifying subscribers in a loop.

- [ ] **Step 1: Replace the file contents**

Replace all of `dev/phoneOverride.ts` with:

```ts
import { useAppStore } from '../src/store/useAppStore';
import { resolveDevPhoneOverride } from '../src/utils/resolveDevPhoneOverride';

// Dev-only phone override. The viewport half of the real rule (`isNarrow`)
// flips when you resize, but the touch half (`pointer: coarse`) never does in a
// desktop browser — resizing is not touch emulation — so the app would stay
// desktop at phone widths. Here we follow the width alone, which is what you
// want from a dev viewport preset.
//
// `?mobile=1` / `?mobile=0` still pin the layout and win over width, both as a
// manual escape hatch and because e2e/serenity/specs/mobile-shell.spec.ts drives
// the phone branch that way.
//
// Guarded by import.meta.env.DEV so it cannot ship.
if (import.meta.env.DEV) {
  const param = new URLSearchParams(window.location.search).get('mobile');
  const pinned = param === '1' || param === '0';

  const apply = (isNarrow: boolean) => {
    useAppStore.getState().setDevPhoneOverride(resolveDevPhoneOverride({ param, isNarrow }));
  };

  let lastIsNarrow = useAppStore.getState().isNarrow;
  apply(lastIsNarrow);

  // The store has no subscribeWithSelector middleware, so this fires on every
  // change; the equality guard is what keeps it from re-entering through
  // setDevPhoneOverride's own set().
  if (!pinned) {
    useAppStore.subscribe((state) => {
      if (state.isNarrow === lastIsNarrow) return;
      lastIsNarrow = state.isNarrow;
      apply(lastIsNarrow);
    });
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS, no errors.

- [ ] **Step 3: Lint the changed files**

```bash
npx eslint dev/phoneOverride.ts src/utils/resolveDevPhoneOverride.ts src/utils/__tests__/resolveDevPhoneOverride.test.ts --max-warnings=0
```

Expected: no output (clean). CI's lint gate is `--max-warnings=0`, so warnings fail the build.

- [ ] **Step 4: Run the full unit suite for regressions**

```bash
npm run test:run
```

Expected: PASS. Pay attention to `src/utils/__tests__/resolvePhoneViewport.test.ts` — it must still pass untouched.

Use `test:run`, not `test` — `npm run test` is bare `vitest`, which stays in watch mode and never exits.

- [ ] **Step 5: Verify manually in the dev webapp**

Start the webapp with the `reis-webapp` launch config (`preview_start`), not a
foreground `npm run dev:web` — the dev server does not exit and will block.

Then, in the browser pane at `http://localhost:3000` with **no query param**:

| Viewport | Expected |
|---|---|
| Mobile preset (375×812) | Phone shell — bottom tab bar reading Kalendář / Zkoušky / Předměty / Mapa / Profil |
| Tablet preset (768×1024) | Desktop shell — left icon sidebar, week grid |
| Responsive / wide | Desktop shell |

Resize between presets without reloading and confirm the layout switches live.

Then confirm the pins still win:
- `http://localhost:3000/?mobile=1` at a **wide** viewport → phone shell.
- `http://localhost:3000/?mobile=0` at the **Mobile** preset → desktop shell.

- [ ] **Step 6: Commit**

```bash
git add dev/phoneOverride.ts
git commit -m "feat(dev): follow viewport width for the dev phone override

The browser viewport preset resizes but never sets pointer: coarse, so the
strict isTouch && isNarrow rule kept the desktop layout at phone widths.
The dev override now follows isNarrow, with ?mobile=1/0 still pinning."
```

---

## Verification

After both tasks, the whole change is:

- `src/utils/resolveDevPhoneOverride.ts` — new, pure, 4 tests.
- `src/utils/__tests__/resolveDevPhoneOverride.test.ts` — new.
- `dev/phoneOverride.ts` — rewritten.

`src/utils/resolvePhoneViewport.ts` must show **no diff**. Confirm with:

```bash
git diff main --stat -- src/utils/resolvePhoneViewport.ts
```

Expected: empty output.

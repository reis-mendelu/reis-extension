/**
 * Putting the page on the screen `verify:ui --view` asked for, and proving it
 * got there.
 *
 * The decisions live next door in `viewTarget.ts`, where they are unit-tested;
 * this file is only the Playwright half — read the shell, drive the tab, wait
 * for the screen. Split out of `shot.ts` so that file stops growing: the repo
 * asks for ~200-line files and the screenshot driver is already well past it.
 */

import type { Page } from '@playwright/test';
import { describeShell, type Shell } from './uiFindings';
import { planView, type ViewPlan } from './viewTarget';
import type { MobileTab } from '../../src/store/types';

/** How long the app gets to mount a shell before `--view` is judged. */
const SHELL_MOUNT_TIMEOUT_MS = 15_000;
/** How long a switched-to screen gets to appear before the run fails. */
const SCREEN_RENDER_TIMEOUT_MS = 5_000;

/** Which shell actually mounted — asked of the DOM, never inferred from the
 *  viewport width. The app's breakpoint is free to move; this reading is not. */
export async function readShell(page: Page): Promise<Shell> {
  return describeShell(
    (await page.locator('[data-testid="desktop-app"]').count()) > 0,
    (await page.locator('[data-testid="mobile-app"]').count()) > 0
  );
}

/**
 * Work out what `--view` means here, once something has rendered.
 *
 * The wait is load-bearing: `load` fires before React paints, and a shell read
 * an instant too early reads as `none`. Swallowing the timeout is safe only
 * because `planView` treats `none` as fatal for a phone tab — a blank or
 * never-booted app can no longer fall through to a clean run under the
 * requested view. A `none` that is genuinely fine (the admin console, which
 * mounts neither shell) still passes, because nobody asks it for a phone tab.
 */
export async function planRequestedView(page: Page, view: string | undefined): Promise<ViewPlan> {
  if (!view) return planView(undefined, 'none');
  await page
    .waitForSelector('[data-testid="desktop-app"], [data-testid="mobile-app"]', {
      timeout: SHELL_MOUNT_TIMEOUT_MS,
    })
    .catch(() => undefined);
  return planView(view, await readShell(page));
}

/**
 * Switch the phone shell's tab through the store handle the dev webapp
 * publishes (`window.__reisStore`, dev/storeHandle.ts) — the same mechanism
 * `scripts/check-app.ts` drives its own tab sweep with.
 *
 * A missing handle is an error, not a warning. Without it the run would fall
 * back to whatever tab the app booted on — the calendar — and photograph that
 * under the name of the view that was asked for, which is precisely the failure
 * that hid here for months while every run reported success.
 */
export async function applyMobileTab(page: Page, tab: MobileTab): Promise<void> {
  await page
    .waitForFunction(() => '__reisStore' in window, undefined, { timeout: 10_000 })
    .catch(() => undefined);
  const ok = await page.evaluate((t) => {
    const w = window as unknown as {
      __reisStore?: { getState: () => { setMobileTab?: (v: string) => void } };
    };
    const setTab = w.__reisStore?.getState().setMobileTab;
    if (typeof setTab !== 'function') return false;
    setTab(t);
    return true;
  }, tab);
  if (!ok) {
    throw new Error(
      `--view ${tab}: window.__reisStore is not present, so the phone tab cannot be switched. ` +
        'It is published by dev/storeHandle.ts, gated on isHarnessEnabled — confirm the page is ' +
        `npm run dev:web (or a variant). Refusing to continue: this run would have photographed ` +
        `the calendar and labelled it "${tab}".`
    );
  }
}

/**
 * Prove the requested screen is the one on screen, by its own testid.
 *
 * Reading `mobileTab` back out of the store would only prove the setter ran.
 * `MobileApp` mounts exactly one `*-screen` element, so its presence is the
 * claim that matters — and the claim the old seeding path could never have
 * made, which is why nothing noticed it was photographing one screen five times.
 *
 * Waits rather than sampling once. A Zustand `set` returns before React has
 * committed, and `--wait` accepts 0, so a single `count()` could fail a
 * perfectly good transition a few milliseconds early — a verification tool that
 * cries wolf gets ignored just as fast as one that never barks. `attached`, not
 * `visible`: the screen stays mounted behind an open sheet, which is exactly
 * where a `--click` path leaves it.
 */
export async function assertViewRendered(page: Page, plan: ViewPlan, width: number): Promise<void> {
  if (plan.kind !== 'mobile-tab') return;
  try {
    await page.waitForSelector(`[data-testid="${plan.testId}"]`, {
      state: 'attached',
      timeout: SCREEN_RENDER_TIMEOUT_MS,
    });
  } catch {
    throw new Error(
      `--view ${plan.tab}: the tab was set at ${width}px but [data-testid="${plan.testId}"] never ` +
        `rendered within ${SCREEN_RENDER_TIMEOUT_MS}ms, so the screenshot does not show the ` +
        'screen that was asked for. Either the screen failed to mount, or it no longer carries ' +
        'that testid (see scripts/lib/viewTarget.ts).'
    );
  }
}

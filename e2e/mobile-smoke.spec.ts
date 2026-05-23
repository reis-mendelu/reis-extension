import { test, expect } from '@playwright/test';

/**
 * Mobile-shell smoke test — runs against the firefox-android Playwright project.
 * Requires the extension to be loaded into the Playwright Firefox build and a
 * valid IS Mendelu session cookie in storageState.json. Treated as a local-only
 * gate; skipped in CI until the load-extension flow is automated.
 */
test.describe('mobile shell smoke', () => {
    test.skip(({ browserName }) => browserName !== 'firefox', 'firefox-android project only');
    test.skip(!!process.env.CI, 'requires extension load and IS session — local only');

    test('bottom nav and search overlay render on phone', async ({ page }) => {
        await page.goto('https://is.mendelu.cz/');
        // The MobileBottomNav is gated on `touch:flex` — Pixel 7 device emulation
        // should report pointer: coarse + viewport < 768px, so the nav must render.
        await expect(page.locator('nav.touch\\:flex').first()).toBeVisible({ timeout: 15000 });
        await page.locator('[aria-label="Search"]').first().click();
        // Mobile search overlay or vaul drawer with dialog role:
        await expect(page.locator('[role="dialog"], [data-vaul-drawer-direction="bottom"]').first()).toBeVisible();
    });
});

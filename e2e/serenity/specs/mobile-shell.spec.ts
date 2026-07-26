import { test, expect } from '@playwright/test';

/**
 * Guard for spec risk R1. If touch emulation ever stops producing
 * `pointer: coarse`, every other mobile test would silently exercise the
 * DESKTOP tree and still pass. This fails loudly instead.
 */
test.describe('mobile shell', () => {
  test('phone branch mounts under touch emulation', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page.getByTestId('mobile-app')).toBeVisible();
  });
});

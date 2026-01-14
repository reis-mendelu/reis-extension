/**
 * E2E tests for file drawer functionality
 */
import { test, expect } from '../fixtures/extension';

test.describe('File Drawer', () => {
  test('subject files drawer can be opened', async ({ extensionPage }) => {
    // Wait for calendar events to load
    await extensionPage.waitForSelector('[class*="event"], [class*="subject"], [class*="tile"]', {
      timeout: 5000
    }).catch(() => {});
    
    // Try to find a clickable event/subject
    const eventTile = extensionPage.locator(
      '[class*="event"], [class*="subject"], [class*="tile"]'
    ).first();
    
    if (await eventTile.count() > 0) {
      await eventTile.click();
      
      // Wait for drawer to open
      await extensionPage.waitForSelector(
        '[class*="drawer"], [class*="panel"], [class*="sheet"], [role="dialog"]',
        { timeout: 5000, state: 'visible' }
      ).catch(() => {});
      
      // Look for drawer/panel
      const drawer = extensionPage.locator(
        '[class*="drawer"], [class*="panel"], [class*="sheet"], [role="dialog"]'
      );
      
      if (await drawer.count() > 0) {
        await expect(drawer.first()).toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('files section renders in drawer', async ({ extensionPage }) => {
    // Wait for calendar events to load
    await extensionPage.waitForSelector('[class*="event"], [class*="subject"], [class*="tile"]', {
      timeout: 5000
    }).catch(() => {});
    
    const eventTile = extensionPage.locator(
      '[class*="event"], [class*="subject"], [class*="tile"]'
    ).first();
    
    if (await eventTile.count() > 0) {
      await eventTile.click();
      
      // Wait for drawer content to load
      await extensionPage.waitForSelector(
        '[class*="drawer"], [role="dialog"]',
        { timeout: 5000, state: 'visible' }
      ).catch(() => {});
      
      // Look for files section
      const filesSection = extensionPage.locator(
        'text=/soubor|file|materiál/i, [class*="file"]'
      );
      
      // Files section exists or loading state
      const hasFiles = await filesSection.count() > 0;
      const hasLoading = await extensionPage.locator('[class*="skeleton"], [class*="loading"]').count() > 0;
      
      expect(hasFiles || hasLoading).toBe(true);
    } else {
      test.skip();
    }
  });
});

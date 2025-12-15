/**
 * E2E tests for search functionality
 * Note: Visual regression for search behavior covered in visual/search.spec.ts
 */
import { test, expect } from '../fixtures/extension';

test.describe('Search Bar', () => {
  test('search bar is visible and focusable', async ({ extensionPage }) => {
    // Find search input
    const searchInput = extensionPage.locator(
      'input[type="search"], input[type="text"][placeholder*="hled"], [class*="search"] input'
    ).first();
    
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    
    // Should be focusable
    await searchInput.focus();
    await expect(searchInput).toBeFocused();
  });
});

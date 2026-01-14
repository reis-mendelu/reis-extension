/**
 * Component Isolation Tests for Success Rate Tab
 * 
 * @arch-guardian: Verify stats tab renders correctly in isolation,
 * without relying on files tab or other drawer components.
 */

import { test, expect } from '../fixtures/extension';

test.describe('Stats Tab Component Isolation', () => {
  test.beforeEach(async ({ extensionContext }) => {
    // Mock success rate data
    await extensionContext.route(/success-rates-global\.json/, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          lastUpdated: new Date().toISOString(),
          data: {
            'TEST-001': {
              courseCode: 'TEST-001',
              stats: [
                {
                  semesterName: 'ZS 2024/2025 - PEF',
                  year: 2024,
                  totalPass: 90,
                  totalFail: 10,
                  terms: [{ term: '1. termín', pass: 90, fail: 10, grades: { A: 20, B: 20, C: 20, D: 15, E: 15, F: 8, FN: 2 } }]
                }
              ]
            }
          }
        })
      });
    });

    // Mock search to return test subject
    await extensionContext.route('**/auth/hledani/index.pl*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<html><body>
          <span style="background-color: #10b981"></span>
          <a href="../katalog/syllabus.pl?predmet=999;lang=cz">TEST-001 Test Subject</a> - PEF
        </body></html>`
      });
    });
  });

  test('stats tab renders pass rate without files loaded', async ({ extensionPage }) => {
    // Search for subject
    const searchInput = extensionPage.locator('input[placeholder*="Prohledej"]');
    await expect(searchInput).toBeVisible({ timeout: 30000 });
    await searchInput.fill('TEST');

    // Click on result
    const result = extensionPage.locator('text=Test Subject');
    await expect(result).toBeVisible({ timeout: 10000 });
    await result.click();

    // Wait for drawer
    await expect(extensionPage.locator('text=/Test Subject/i')).toBeVisible({ timeout: 10000 });

    // Switch directly to stats tab (no files needed)
    const statsTab = extensionPage.getByRole('button', { name: /Úspěšnost/i });
    await statsTab.click();

    // Verify stats are visible (90% pass rate)
    await expect(extensionPage.locator('text=/90%|90 %/i')).toBeVisible({ timeout: 10000 });
  });

  test('stats tab handles 404 gracefully', async ({ extensionContext, extensionPage }) => {
    // Override global cache to return 404 for this subject
    await extensionContext.route(/success-rates-global\.json/, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lastUpdated: new Date().toISOString(), data: {} })
      });
    });

    // Search
    const searchInput = extensionPage.locator('input[placeholder*="Prohledej"]');
    await expect(searchInput).toBeVisible({ timeout: 30000 });
    await searchInput.fill('TEST');

    const result = extensionPage.locator('text=Test Subject');
    await expect(result).toBeVisible({ timeout: 10000 });
    await result.click();

    // Switch to stats tab
    const statsTab = extensionPage.getByRole('button', { name: /Úspěšnost/i });
    await expect(statsTab).toBeVisible({ timeout: 10000 });
    await statsTab.click();

    // Should show "no data" message, not crash
    await expect(extensionPage.locator('text=/nebyla nalezena|Žádná data|Nejsou k dispozici/i')).toBeVisible({ timeout: 10000 });
  });
});

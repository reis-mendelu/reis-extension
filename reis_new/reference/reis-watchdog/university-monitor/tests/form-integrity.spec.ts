import { test, expect } from '@playwright/test';

test('Check University Form Integrity', async ({ page }) => {
  // 1. Go to the mock server
  await page.goto(process.env.BASE_URL || 'http://localhost:8080');

  // 2. LOCATE THE FORM
  // We find the form by its ACTION, because the NAME is random/unstable.
  // If the university changes the URL structure, this fails (good!).
  const form = page.locator('form[action*="rozvrhy_view.pl"]');
  await expect(form).toBeVisible();

  // 3. CHECK VITAL ORGANS (Inputs)
  // If these IDs or Names change, your automated scraper would break.
  
  // Check the hidden Student ID input
  await expect(form.locator('input[name="rozvrh_student"]')).toHaveCount(1);

  // Check the "Type of List" radio buttons
  const typeRadios = form.locator('input[name="typ_vypisu"]');
  await expect(typeRadios).toHaveCount(2); // Expecting at least 2 options
  
  // Check the Format dropdown
  const formatSelect = form.locator('select[name="format"]');
  await expect(formatSelect).toBeVisible();
  await expect(formatSelect).toHaveValue('html'); // Default should be HTML

  // 4. ATTEMPT INTERACTION
  // Select PDF format
  await formatSelect.selectOption('pdf');

  // Find the submit button (Display)
  const submitBtn = form.locator('input[type="submit"][value="Display"]');
  await expect(submitBtn).toBeVisible();
});
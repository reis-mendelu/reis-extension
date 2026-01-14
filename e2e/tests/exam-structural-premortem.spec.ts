/**
 * Pre-Mortem Tests for Exam Structure
 * "All I want to know is where I am going to die, so I never go there." 
 */
import { test, expect } from '../fixtures/extension';

test.describe('Exams Page: Pre-Mortem (Structural)', () => {
  
  test.beforeEach(async ({ extensionPage }) => {
    await extensionPage.waitForLoadState('networkidle');
    const examButton = extensionPage.getByText(/zkoušk|exam|termín/i).first();
    if (await examButton.count() > 0) {
      await examButton.click();
      await extensionPage.waitForTimeout(1000);
    }
  });

  /**
   * Death Type: Edge Case
   * Failure: Overlap in Timeline
   * Reason: Scaled items or flexible containers allowing content to bleed out.
   */
  test('Death 1: Timeline items should not overlap or have scale hacks', async ({ extensionPage }) => {
    const timeline = extensionPage.locator('ul[class*="timeline"]');
    if (await timeline.count() > 0) {
      // Check for scale hacks
      const style = await timeline.getAttribute('style');
      const classes = await timeline.getAttribute('class');
      
      // We WANT this to fail if scale hacks are still present
      expect(style).not.toContain('scale');
      expect(classes).not.toContain('scale-[');
      
      // Ensure it's scrollable or handles overflow gracefully
      const overflow = await timeline.evaluate(el => window.getComputedStyle(el).overflowX);
      expect(['auto', 'scroll', 'hidden']).toContain(overflow);
    }
  });

  /**
   * Death Type: Integration
   * Failure: Breadcrumb/Header misalignment
   * Reason: Floating margins or hardcoded offsets.
   */
  test('Death 2: Header should be aligned with timeline and content', async ({ extensionPage }) => {
    const header = extensionPage.locator('h3:has-text("Přihlášení na zkoušky")');
    const timeline = extensionPage.locator('ul[class*="timeline"]');
    
    if (await header.count() > 0 && await timeline.count() > 0) {
      const headerBox = await header.boundingBox();
      const timelineBox = await timeline.boundingBox();
      
      if (headerBox && timelineBox) {
        // Horizontal alignment check (roughly the same X)
        // Hardcoded ml-4 should be removed and they should align with the grid
        expect(Math.abs(headerBox.x - timelineBox.x)).toBeLessThan(5);
      }
    }
  });

  /**
   * Death Type: User Error
   * Failure: Confusing visual weight for destructive actions
   * Reason: "Změnit termín" (Change) having more weight than "Odhlásit" (Cancel).
   */
  test('Death 3: Buttons should have clear semantic hierarchy', async ({ extensionPage }) => {
    const unregisterBtn = extensionPage.getByText(/Odhlásit se/i).first();
    const changeBtn = extensionPage.getByText(/Změnit termín/i).first();
    
    if (await unregisterBtn.count() > 0 && await changeBtn.count() > 0) {
      const unregisterClass = await unregisterBtn.getAttribute('class');
      const changeClass = await changeBtn.getAttribute('class');
      
      // "Odhlásit" should be error-colored (btn-error)
      expect(unregisterClass).toContain('btn-error');
      // "Změnit" should be less jarring than btn-warning if not critical
      // This is a design preference but we test for the current loud state
      expect(changeClass).toContain('btn-warning');
    }
  });

  /**
   * Death Type: Time
   * Failure: Layout shift during hover
   * Reason: Scale transformations without proper transform-origin or isolation.
   */
  test('Death 4: No layout shift on timeline card hover', async ({ extensionPage }) => {
    const examCard = extensionPage.locator('li [class*="timeline-box"]').first();
    
    if (await examCard.count() > 0) {
      const beforeBox = await examCard.boundingBox();
      await examCard.hover();
      await extensionPage.waitForTimeout(200);
      const afterBox = await examCard.boundingBox();
      
      if (beforeBox && afterBox) {
        // Width/Height might change if it scales, but X/Y shouldn't move siblings
        // We check if X/Y remains stable (ignoring the scale center shift)
        expect(Math.abs(beforeBox.x - afterBox.x)).toBeLessThan(10);
      }
    }
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The dev webapp publishes the running store on `window.__reisStore` so
 * automated UI checks read the instance the app actually renders from.
 *
 * Two things can silently break that, and neither shows up as a failure — the
 * checks just read an empty store and conclude the app is broken:
 *
 *   1. `storeHandle` publishing something that is not `useAppStore`.
 *   2. `main.web.tsx` importing `storeHandle` BEFORE the app entry, so the
 *      handle is published from a module graph the app has not populated.
 */
describe('dev store handle', () => {
  beforeEach(() => {
    vi.resetModules();
    delete (window as unknown as Record<string, unknown>).__reisStore;
  });

  it('publishes the app store itself, not a copy', async () => {
    const { useAppStore } = await import('../../src/store/useAppStore');
    await import('../storeHandle');
    expect((window as unknown as Record<string, unknown>).__reisStore).toBe(useAppStore);
  });

  // Source-level, because the ordering hazard is a Vite module-resolution one
  // that a Vitest import graph does not reproduce. The contract is textual:
  // the handle import must come after the app's.
  it('imports the handle after the app entry in main.web.tsx', () => {
    const src = readFileSync(resolve(__dirname, '../main.web.tsx'), 'utf-8');
    const app = src.indexOf("import '@/entrypoints/main/main'");
    const handle = src.indexOf("import './storeHandle'");
    expect(app).toBeGreaterThan(-1);
    expect(handle).toBeGreaterThan(-1);
    expect(handle).toBeGreaterThan(app);
  });
});

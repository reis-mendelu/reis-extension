import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The Capacitor app has no `chrome` global at all. Every other test in the
 * suite runs with one, because `src/test/setup.ts` stubs it globally — which is
 * why 2565 green tests still shipped a build that died on the splash screen
 * with `ReferenceError: Can't find variable: chrome` before `boot()` ever ran
 * (Sprint 08 pinned `IFRAME_ORIGIN` at module scope in `injector/iframeManager`,
 * and `mobile/actionHandler` imports `sendToIframe` from that same module).
 *
 * A module in the mobile graph may call `chrome.*` inside a function — those
 * paths are unreachable on Capacitor. What it must never do is touch `chrome`
 * while being EVALUATED, because that throws on import and takes the whole app
 * down. Deleting the global reproduces the device exactly.
 */
describe('modules in the Capacitor boot path evaluate without a chrome global', () => {
  let saved: unknown;

  beforeEach(() => {
    saved = (globalThis as Record<string, unknown>).chrome;
    delete (globalThis as Record<string, unknown>).chrome;
    vi.resetModules();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).chrome = saved;
    vi.resetModules();
  });

  // sendToIframe lives here, and main.capacitor.tsx reaches it through both
  // mobile/actionHandler and injector/syncGate.
  it('injector/iframeManager', async () => {
    await expect(import('../../injector/iframeManager')).resolves.toBeDefined();
  });

  it('mobile/actionHandler', async () => {
    await expect(import('../actionHandler')).resolves.toBeDefined();
  });

  it('injector/syncGate', async () => {
    await expect(import('../../injector/syncGate')).resolves.toBeDefined();
  });
});

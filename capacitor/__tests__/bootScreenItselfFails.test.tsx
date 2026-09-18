import { describe, it, expect, vi } from 'vitest';

const ensureSession = vi.fn();
vi.mock('@/mobile/ensureSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/mobile/ensureSession')>();
  return { ...actual, ensureSession };
});
vi.mock('@/mobile/inAppLoginDeps', () => ({ buildInAppLoginDeps: vi.fn(async () => ({})) }));
vi.mock('@/platform/tokenStore', () => ({
  purgePlaintextToken: vi.fn(async () => {}),
  loadStoredToken: vi.fn(async () => undefined),
  clearStoredToken: vi.fn(async () => {}),
}));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn() } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), exitApp: vi.fn() } }));

// The failure screen is the thing that fails. Its real risk is the
// `useTranslation` beneath it reading a store that may be part of why boot
// broke in the first place.
vi.mock('@/components/mobile/BootErrorScreen', () => ({
  BootErrorScreen: () => {
    throw new Error('the error screen is broken too');
  },
}));

/**
 * `root.render()` schedules work; it does not throw.
 *
 * So the `try/catch` around it never saw a component's failure, and the one
 * screen whose whole job is to prevent a blank page would have left one.
 * React 19's `onUncaughtError` on the root is the boundary that covers it, and
 * it falls through to the bare-DOM text this screen replaced. Raised in review
 * on this PR.
 */
describe('when the boot-failure screen itself cannot render', () => {
  it('falls back to the bare error text rather than a blank page', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    ensureSession.mockRejectedValue(new Error('the original boot failure'));

    // Deliberately no `act()` and no `waitFor()`. Both of them intercept what
    // React reports and rethrow it at the test, which is precisely the route this
    // test needs React to take on its own — with `act` in the way,
    // `onUncaughtError` never runs and the assertion below measures the
    // harness rather than the app. Verified: the same throw calls the callback
    // when nothing wraps it.
    await import('../main.capacitor');

    const root = document.getElementById('root')!;
    for (let i = 0; i < 100 && !root.textContent?.includes('failed to start'); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(root.textContent).toContain('failed to start');
    expect(root.textContent).toContain('the error screen is broken too');
  }, 15000);
});

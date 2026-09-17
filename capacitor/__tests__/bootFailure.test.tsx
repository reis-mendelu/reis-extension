import { describe, it, expect, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';

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

/**
 * A boot failure is not a dead end.
 *
 * It used to be exactly that: `#root` wiped and replaced with the English
 * string "reIS failed to start: <Error>". A student photographed one and their
 * only way out was to kill the app. Whatever threw — the screenshot's error was
 * a plain `Error` carrying the login-cancelled message, which is NOT a
 * `LoginCancelledError` instance and so correctly missed the branch that routes
 * a dismissed login to the sign-in gate — the screen must offer a way forward.
 */
describe('a boot failure that is not a cancelled login', () => {
  it('offers a retry and the demo instead of a bare error string', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    ensureSession.mockRejectedValue(new Error('Login cancelled: the sign-in window was dismissed'));

    await act(async () => {
      await import('../main.capacitor');
    });

    const root = document.getElementById('root')!;
    await waitFor(() => expect(document.querySelectorAll('button').length).toBeGreaterThan(0));
    expect(root.textContent).not.toContain('failed to start');
    // The cause stays readable — reIS sends nothing about a failure, so a
    // student reading this line out is the only route to a fix.
    expect(root.textContent).toContain('Login cancelled: the sign-in window was dismissed');
    expect(document.querySelectorAll('button').length).toBeGreaterThanOrEqual(2);
  }, 15000);
});

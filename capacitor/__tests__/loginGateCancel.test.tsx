import { describe, it, expect, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';

// Rejecting every time is the point: this file reproduces the reviewer's path,
// where there is no account to sign in with, so BOTH the boot-time login and
// the one the gate's own button opens end in a dismissal.
const ensureSession = vi.fn();
vi.mock('@/mobile/ensureSession', async (importOriginal) => {
  // The real class comes through unchanged — main.capacitor decides what to do
  // with a cancellation via `instanceof`, so a stub class would make this test
  // pass against a broken app.
  const actual = await importOriginal<typeof import('@/mobile/ensureSession')>();
  return { ...actual, ensureSession };
});
vi.mock('@/mobile/inAppLoginDeps', () => ({ buildInAppLoginDeps: vi.fn(async () => ({})) }));
vi.mock('@/platform/tokenStore', () => ({ purgePlaintextToken: vi.fn(async () => {}) }));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn() } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), exitApp: vi.fn() } }));

describe('cancelling login from the gate', () => {
  it('leaves the gate on screen instead of the fatal error text', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const { LoginCancelledError } = await import('@/mobile/ensureSession');
    ensureSession.mockRejectedValue(new LoginCancelledError());

    // Importing runs boot(), which presents login, is dismissed, and lands on
    // the gate — the same first two steps a reviewer takes. boot() and
    // showLoginGate() both settle asynchronously, so wait for the gate to be on
    // screen rather than for a fixed delay that can expire before it renders.
    await act(async () => {
      await import('../main.capacitor');
    });

    const root = document.getElementById('root')!;
    await waitFor(() => expect(document.querySelectorAll('button').length).toBeGreaterThan(0));
    expect(root.textContent).not.toContain('failed to start');

    // The second dismissal: tap the gate's own sign-in button, back out again.
    const signIn = document.querySelectorAll('button')[0];
    await act(async () => {
      signIn.click();
    });
    await waitFor(() => expect(ensureSession).toHaveBeenCalledTimes(2));

    // Still the gate, not the fatal error text.
    await waitFor(() => expect(document.querySelectorAll('button').length).toBeGreaterThan(0));
    expect(root.textContent).not.toContain('failed to start');
  }, 15000);
});

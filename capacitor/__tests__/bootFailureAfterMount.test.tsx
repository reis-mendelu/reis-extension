import { describe, it, expect, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';

vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn() } }));
// The last thing startApp does, and the first one here that can fail after the
// entry module has mounted the app. The 'backButton' listener is registered at
// module scope, long before that, so it has to keep working.
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((event: string) => {
      if (event === 'resume') throw new Error('resume listener failed');
      return Promise.resolve({ remove: () => {} });
    }),
    exitApp: vi.fn(),
  },
}));
vi.mock('@/mobile/ensureSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/mobile/ensureSession')>();
  return { ...actual, ensureSession: vi.fn(async () => 'a-token') };
});
vi.mock('@/mobile/inAppLoginDeps', () => ({ buildInAppLoginDeps: vi.fn(async () => ({})) }));
vi.mock('@/platform/tokenStore', () => ({
  purgePlaintextToken: vi.fn(async () => {}),
  loadStoredToken: vi.fn(async () => 'a-token'),
  clearStoredToken: vi.fn(async () => {}),
}));
vi.mock('@/mobile/verifySession', () => ({ discardDeadSession: vi.fn(async () => {}) }));

// The app's entry mounts a root on #root at module scope and exports nothing,
// which is the whole reason this case is dangerous. Stand in for it with
// something that leaves a mark on the page the same way.
vi.mock('@/entrypoints/main/main', () => {
  const marker = document.createElement('div');
  marker.id = 'the-mounted-app';
  document.getElementById('root')!.appendChild(marker);
  return {};
});

/**
 * A boot failure AFTER the app has already mounted.
 *
 * `startApp` keeps going once the entry module has run — the splash hide, the
 * sync-gate import, the resume listener — and any of those can throw. The
 * failure screen then renders over a live React root it does not own and cannot
 * unmount, and its demo button would `await import()` an already-evaluated
 * module, render nothing, and leave a blank page. Raised in review on this PR.
 */
describe('a boot failure after the app has mounted', () => {
  it('replaces the mounted app and offers only the reload', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await act(async () => {
      await import('../main.capacitor');
    });

    const root = document.getElementById('root')!;
    await waitFor(() => expect(root.textContent).toContain('resume listener failed'), {
      timeout: 10000,
    });

    // The dead tree's DOM is gone rather than sitting under the error screen.
    expect(document.getElementById('the-mounted-app')).toBeNull();
    // And the one button is the reload: the demo cannot work from here.
    const buttons = [...document.querySelectorAll('button')];
    expect(buttons).toHaveLength(1);
  }, 15000);
});

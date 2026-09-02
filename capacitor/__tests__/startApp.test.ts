import { describe, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

const startSyncService = vi.fn();
vi.mock('@/injector/syncGate', () => ({
  startSyncService,
  requestSync: vi.fn(),
}));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn() } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), exitApp: vi.fn() } }));

describe('startApp', () => {
  it('does not start the sync service in demo mode', async () => {
    // main.capacitor's real boot path renders the actual app entrypoint
    // (@/entrypoints/main/main), which targets #root exactly like
    // capacitor/index.html does — unlike the DOM built by testing-library's
    // render(), nothing here provides that container.
    document.body.innerHTML = '<div id="root"></div>';

    const { startApp } = await import('../main.capacitor');
    // Inside act: startApp renders the real entrypoint, and React's scheduler
    // was still doing work after the test returned — vitest then tore the
    // environment down underneath it and reported an unhandled
    // "window is not defined" from react-dom. act flushes that work while the
    // DOM still exists. The demo path made it visible because a populated
    // demo renders far more than an empty one did.
    await act(async () => {
      await startApp({ demo: true });
    });
    // A second flush: React's scheduler drains through setImmediate, so the
    // work queued by the first render lands a macrotask later — after the
    // test would otherwise have returned.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(startSyncService).not.toHaveBeenCalled();
    // The first-run welcome is resolved before the root renders, and demo mode
    // counts as seen: the reviewer's path must not open with a Wi-Fi alert.
    expect(useAppStore.getState().welcomeSeen).toBe(true);
    // 30s, not the 5s default: this test boots the real entrypoint (~9s on its
    // own, measured) and then waits for React's scheduler to drain. 15s was
    // enough alone and not enough inside the full suite, where it timed out on
    // both CI and a laptop — the budget has to cover a loaded machine, since
    // that is the only machine that ever runs the whole thing.
  }, 30000);
});

describe('showLoginGate', () => {
  it('sets data-theme before the gate renders, so it never paints unthemed', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    // Removed rather than left alone: the store's initial `theme` field is
    // already DEFAULT_THEME before loadTheme ever runs, so asserting the
    // attribute merely matches store.theme would pass even if showLoginGate
    // never called loadTheme at all. Clearing the attribute first means the
    // assertion below only passes if loadTheme's DOM side effect actually ran.
    document.documentElement.removeAttribute('data-theme');
    useAppStore.setState({ language: 'cz' });

    const { showLoginGate } = await import('../main.capacitor');
    // Same treatment as the boot test above, and for the same reason: this
    // renders a real React root, and React's scheduler drains through
    // setImmediate, so the commit lands a macrotask after the test would
    // otherwise return. Unguarded, vitest tears the environment down first and
    // react-dom throws from commitRoot into nobody's handler — which fails the
    // run without failing a single test, and only when file scheduling happens
    // to put this last.
    await act(async () => {
      await showLoginGate();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe(useAppStore.getState().theme);
  }, 15000);
});

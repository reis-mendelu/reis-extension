import { describe, it, expect, vi } from 'vitest';
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
    await startApp({ demo: true });
    expect(startSyncService).not.toHaveBeenCalled();
  });
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
    await showLoginGate();

    expect(document.documentElement.getAttribute('data-theme')).toBe(useAppStore.getState().theme);
  });
});

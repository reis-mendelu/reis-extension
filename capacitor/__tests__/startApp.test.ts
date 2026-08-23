import { describe, it, expect, vi } from 'vitest';

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

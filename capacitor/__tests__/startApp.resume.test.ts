import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '@/store/useAppStore';

const listeners = vi.hoisted(() => ({ resume: undefined as undefined | (() => void) }));
const checkPermissions = vi.hoisted(() => vi.fn());

vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn() } }));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((name: string, cb: () => void) => {
      if (name === 'resume') listeners.resume = cb;
      return Promise.resolve({ remove: vi.fn() });
    }),
    exitApp: vi.fn(),
  },
}));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    addListener: vi.fn(),
    checkPermissions,
    requestPermissions: vi.fn(),
  },
}));
// The React root is not what this tests, and rendering it would take seconds.
vi.mock('@/entrypoints/main/main', () => ({}));
vi.mock('@/injector/syncGate', () => ({ startSyncService: vi.fn(), requestSync: vi.fn() }));
vi.mock('@/mobile/examReminders', () => ({ installExamReminders: vi.fn() }));
vi.mock('@/mobile/zaznamnikNotifications', () => ({ installZaznamnikNotifications: vi.fn() }));
vi.mock('@/mobile/notificationTaps', () => ({ installNotificationTaps: vi.fn() }));
vi.mock('@/mobile/backgroundCheckNative', () => ({ startBackgroundCheck: vi.fn() }));
vi.mock('@/api/feedback', () => ({ trackDailyUsage: vi.fn() }));

/**
 * Back from system Settings with the notification switch flipped: the store
 * (Nastavení row, the bell's banner) has to follow without a relaunch.
 */
describe('startApp: resume refreshes the notification status', () => {
  beforeEach(() => {
    listeners.resume = undefined;
    checkPermissions.mockReset();
    // The other things a resume refreshes reach the network; not under test.
    useAppStore.setState({
      systemNotifications: 'unknown',
      contextResolved: true,
      refreshMapEventsIfStale: vi.fn(),
      refreshMenuIfStale: vi.fn(),
    } as never);
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('reads the system answer again on every resume', async () => {
    checkPermissions.mockResolvedValue({ display: 'granted' });
    const { startApp } = await import('../startApp');
    await startApp({ demo: false });
    await vi.waitFor(() => expect(useAppStore.getState().systemNotifications).toBe('granted'));
    expect(listeners.resume).toBeTypeOf('function');

    // The student switched reIS off in Settings and comes back.
    checkPermissions.mockResolvedValue({ display: 'denied' });
    listeners.resume?.();
    await vi.waitFor(() => expect(useAppStore.getState().systemNotifications).toBe('denied'));
  });
});

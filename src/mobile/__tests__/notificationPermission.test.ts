import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

const ln = vi.hoisted(() => ({ checkPermissions: vi.fn(), requestPermissions: vi.fn() }));
const downloads = vi.hoisted(() => ({ openNotificationSettings: vi.fn() }));
const launch = vi.hoisted(() => vi.fn());
const platform = vi.hoisted(() => ({ name: 'android' }));

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
vi.mock('../openInBrowser', () => ({ launchInSystemBrowser: launch }));
vi.mock('@capacitor/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...real,
    Capacitor: { ...real.Capacitor, getPlatform: () => platform.name },
    registerPlugin: () => downloads,
  };
});

import {
  askNotificationsIfNeverAsked,
  enableNotifications,
  refreshNotificationStatus,
} from '../notificationPermission';

/**
 * Notifications were silently off on a student's Android phone and nothing in
 * reIS said so. The store now knows the system state, and the Nastavení row and
 * the bell's banner read it.
 */
describe('notification permission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platform.name = 'android';
    useAppStore.setState({ systemNotifications: 'unknown' });
  });

  it.each([
    ['granted', 'granted'],
    ['denied', 'denied'],
    ['prompt', 'prompt'],
    // Denied once on Android: the system will still show the dialog one more time.
    ['prompt-with-rationale', 'prompt'],
  ] as const)('maps the plugin state %s to %s', async (display, expected) => {
    ln.checkPermissions.mockResolvedValue({ display });
    await refreshNotificationStatus();
    expect(useAppStore.getState().systemNotifications).toBe(expected);
  });

  it('stays unknown when the plugin cannot say', async () => {
    ln.checkPermissions.mockRejectedValue(new Error('nope'));
    await refreshNotificationStatus();
    expect(useAppStore.getState().systemNotifications).toBe('unknown');
  });

  it('asks the system once when nothing was ever asked', async () => {
    ln.checkPermissions
      .mockResolvedValueOnce({ display: 'prompt' })
      .mockResolvedValueOnce({ display: 'granted' });
    ln.requestPermissions.mockResolvedValue({ display: 'granted' });
    await askNotificationsIfNeverAsked();
    expect(ln.requestPermissions).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().systemNotifications).toBe('granted');
  });

  it.each(['denied', 'granted', 'prompt-with-rationale'])(
    'does not ask again at launch when the state is %s',
    async (display) => {
      ln.checkPermissions.mockResolvedValue({ display });
      await askNotificationsIfNeverAsked();
      expect(ln.requestPermissions).not.toHaveBeenCalled();
    }
  );

  it('enable asks the system while it still will', async () => {
    // Asked while still askable, then read again after the dialog.
    ln.checkPermissions
      .mockResolvedValueOnce({ display: 'prompt-with-rationale' })
      .mockResolvedValueOnce({ display: 'granted' });
    ln.requestPermissions.mockResolvedValue({ display: 'granted' });
    await enableNotifications();
    expect(ln.requestPermissions).toHaveBeenCalled();
    // The row and the banner follow the store: without the refresh they would
    // keep offering Zapnout after the student said yes.
    expect(useAppStore.getState().systemNotifications).toBe('granted');
    expect(downloads.openNotificationSettings).not.toHaveBeenCalled();
  });

  it('enable opens Android settings when the system will no longer ask', async () => {
    ln.checkPermissions.mockResolvedValue({ display: 'denied' });
    await enableNotifications();
    expect(ln.requestPermissions).not.toHaveBeenCalled();
    expect(downloads.openNotificationSettings).toHaveBeenCalledTimes(1);
  });

  it('enable opens the app settings on iOS', async () => {
    platform.name = 'ios';
    ln.checkPermissions.mockResolvedValue({ display: 'denied' });
    await enableNotifications();
    expect(launch).toHaveBeenCalledWith('app-settings:');
  });
});

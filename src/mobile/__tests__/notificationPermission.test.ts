import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

const ln = vi.hoisted(() => ({ checkPermissions: vi.fn(), requestPermissions: vi.fn() }));
const downloads = vi.hoisted(() => ({ openNotificationSettings: vi.fn() }));
const launch = vi.hoisted(() => vi.fn());
const mac = vi.hoisted(() => ({ isMacApp: vi.fn(), openOnMac: vi.fn() }));
const platform = vi.hoisted(() => ({ name: 'android' }));

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
vi.mock('../openInBrowser', () => ({ launchInSystemBrowser: launch }));
vi.mock('../macSave', () => mac);
vi.mock('@capacitor/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...real,
    Capacitor: { ...real.Capacitor, getPlatform: () => platform.name },
    registerPlugin: () => downloads,
  };
});

import {
  askAfterFirstRegistration,
  askNotificationsIfNeverAsked,
  enableNotifications,
  MAC_NOTIFICATIONS_LEGACY_URL,
  MAC_NOTIFICATIONS_URL,
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
    mac.isMacApp.mockResolvedValue(false);
    mac.openOnMac.mockResolvedValue(true);
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
    expect(mac.openOnMac).not.toHaveBeenCalled();
  });

  // The iPad app on a Mac answers `ios` too, and `app-settings:` there lands in
  // System Settings > Accessibility > Touch Alternatives, not Notifications.
  describe('on a Mac running the iPad app', () => {
    beforeEach(() => {
      platform.name = 'ios';
      mac.isMacApp.mockResolvedValue(true);
      ln.checkPermissions.mockResolvedValue({ display: 'denied' });
    });

    it('enable opens the Notifications pane, not app-settings:', async () => {
      await enableNotifications();
      expect(mac.openOnMac).toHaveBeenCalledTimes(1);
      expect(mac.openOnMac).toHaveBeenCalledWith(MAC_NOTIFICATIONS_URL);
      expect(launch).not.toHaveBeenCalled();
    });

    it('still asks the system first while it will show the dialog', async () => {
      ln.checkPermissions
        .mockResolvedValueOnce({ display: 'prompt' })
        .mockResolvedValueOnce({ display: 'granted' });
      ln.requestPermissions.mockResolvedValue({ display: 'granted' });
      await enableNotifications();
      expect(ln.requestPermissions).toHaveBeenCalled();
      expect(mac.openOnMac).not.toHaveBeenCalled();
    });

    it('falls back to the pre-Ventura pane id when macOS refuses the first', async () => {
      mac.openOnMac.mockResolvedValueOnce(false);
      await enableNotifications();
      expect(mac.openOnMac).toHaveBeenNthCalledWith(2, MAC_NOTIFICATIONS_LEGACY_URL);
      expect(launch).not.toHaveBeenCalled();
    });

    it('never falls back to app-settings: when macOS refuses both', async () => {
      mac.openOnMac.mockResolvedValue(false);
      await enableNotifications();
      expect(mac.openOnMac).toHaveBeenCalledTimes(2);
      expect(launch).not.toHaveBeenCalled();
    });

    it('survives the native call throwing', async () => {
      mac.openOnMac.mockRejectedValue(new Error('unavailable'));
      await expect(enableNotifications()).resolves.toBeUndefined();
      expect(launch).not.toHaveBeenCalled();
    });
  });

  it('Android never asks whether it is a Mac', async () => {
    ln.checkPermissions.mockResolvedValue({ display: 'denied' });
    await enableNotifications();
    expect(mac.isMacApp).not.toHaveBeenCalled();
  });

  // Agreed 2026-11-17: the one system dialog comes when it means something,
  // after the student's first exam registration — "připomeneme ti ji večer
  // předem" — not at first launch, when there is nothing to remind.
  describe('asked after the first exam registration', () => {
    const exam = (status: 'open' | 'registered') => ({
      version: 1 as const,
      id: 'A',
      name: 'A',
      code: 'EBC-A',
      sections: [{ id: 's', name: 'zkouška', type: 'exam', status, terms: [] }],
    });
    const settle = () => new Promise((r) => setTimeout(r, 0));

    it('waits while the student is registered nowhere, then asks once', async () => {
      ln.checkPermissions.mockResolvedValue({ display: 'prompt' });
      ln.requestPermissions.mockResolvedValue({ display: 'granted' });
      useAppStore.setState({ exams: { data: [exam('open')], status: 'success', error: null } });
      const stop = askAfterFirstRegistration();
      await settle();
      expect(ln.requestPermissions).not.toHaveBeenCalled();

      useAppStore.setState({
        exams: { data: [exam('registered')], status: 'success', error: null },
      });
      await settle();
      useAppStore.setState({
        exams: { data: [exam('registered')], status: 'success', error: null },
      });
      await settle();
      expect(ln.requestPermissions).toHaveBeenCalledTimes(1);
      stop();
    });
  });
});

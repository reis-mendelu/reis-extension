import { describe, it, expect, vi, beforeEach } from 'vitest';

const plugin = {
  getAppUpdateInfo: vi.fn(),
  openAppStore: vi.fn(async () => {}),
  performImmediateUpdate: vi.fn(async () => ({ code: 0 })),
};
vi.mock('@capawesome/capacitor-app-update', () => ({ AppUpdate: plugin }));

const env = { kind: 'capacitor' as string, os: 'ios' as string, demo: false };
vi.mock('@/platform', () => ({ getPlatform: () => ({ kind: env.kind }) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => env.os } }));
vi.mock('../../errors/demoMode', () => ({ isDemoMode: () => env.demo }));
const track = vi.fn(async (_signal: string) => true);
vi.mock('../../api/featureUsage', () => ({ trackFeatureSignal: (s: string) => track(s) }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

const state = { appUpdate: null as unknown, setAppUpdate: vi.fn() };
vi.mock('../../store/useAppStore', () => ({
  useAppStore: { getState: () => state },
}));

const applyCritical = vi.fn(async (..._a: unknown[]) => {});
vi.mock('../criticalUpdate', () => ({
  applyCriticalUpdate: (...a: unknown[]) => applyCritical(...a),
}));

import { checkAppUpdate, openAppUpdate, APP_STORE_ID } from '../appUpdate';

const old = new Date(Date.now() - 5 * 86_400_000).toISOString();

describe('checkAppUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.kind = 'capacitor';
    env.os = 'ios';
    env.demo = false;
  });

  it('asks the Czech App Store and keeps the offer', async () => {
    plugin.getAppUpdateInfo.mockResolvedValue({
      updateAvailability: 2,
      availableVersionName: '5.8.0',
      availableVersionReleaseDate: old,
    });
    await checkAppUpdate();
    expect(plugin.getAppUpdateInfo).toHaveBeenCalledWith({ country: 'cz' });
    expect(state.setAppUpdate).toHaveBeenCalledWith({ id: 'app-update:5.8.0', version: '5.8.0' });
  });

  it('asks Play without a country', async () => {
    env.os = 'android';
    plugin.getAppUpdateInfo.mockResolvedValue({
      updateAvailability: 2,
      availableVersionCode: '50800',
      clientVersionStalenessDays: 5,
    });
    await checkAppUpdate();
    expect(plugin.getAppUpdateInfo).toHaveBeenCalledWith({});
    expect(state.setAppUpdate).toHaveBeenCalledWith({ id: 'app-update:50800', version: null });
  });

  it('hands what the store said to the critical-version check, at once', async () => {
    const info = {
      updateAvailability: 2,
      availableVersionName: '5.8.0',
      availableVersionReleaseDate: old,
    };
    plugin.getAppUpdateInfo.mockResolvedValue(info);
    await checkAppUpdate();
    expect(applyCritical).toHaveBeenCalledWith(info, 'ios', null);
  });

  it('clears the offer once the app is current', async () => {
    plugin.getAppUpdateInfo.mockResolvedValue({ updateAvailability: 1 });
    await checkAppUpdate();
    expect(state.setAppUpdate).toHaveBeenCalledWith(null);
  });

  it('asks nothing outside the app, or in the demo', async () => {
    env.kind = 'extension';
    await checkAppUpdate();
    env.kind = 'capacitor';
    env.demo = true;
    await checkAppUpdate();
    expect(plugin.getAppUpdateInfo).not.toHaveBeenCalled();
  });

  it('keeps what it had when the store cannot be reached', async () => {
    plugin.getAppUpdateInfo.mockRejectedValue(new Error('offline'));
    await checkAppUpdate();
    expect(state.setAppUpdate).not.toHaveBeenCalled();
  });
});

describe('openAppUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.kind = 'capacitor';
    env.demo = false;
  });

  it('opens reIS in the App Store on iOS, and counts the tap', async () => {
    env.os = 'ios';
    await openAppUpdate();
    expect(plugin.openAppStore).toHaveBeenCalledWith({ appId: APP_STORE_ID });
    expect(APP_STORE_ID).toBe('6804832714');
    expect(track).toHaveBeenCalledWith('app_update_opened');
  });

  it('counts a tap from the critical-version pop-up under its own label', async () => {
    env.os = 'ios';
    await openAppUpdate('critical_update_opened');
    expect(track).toHaveBeenCalledWith('critical_update_opened');
    expect(track).not.toHaveBeenCalledWith('app_update_opened');
  });

  it("runs Play's own update screen on Android when Play allows it", async () => {
    env.os = 'android';
    plugin.getAppUpdateInfo.mockResolvedValue({
      updateAvailability: 2,
      immediateUpdateAllowed: true,
    });
    await openAppUpdate();
    expect(plugin.performImmediateUpdate).toHaveBeenCalled();
    expect(plugin.openAppStore).not.toHaveBeenCalled();
  });

  it('falls back to the Play Store page when the in-app update is not allowed or fails', async () => {
    env.os = 'android';
    plugin.getAppUpdateInfo.mockResolvedValue({
      updateAvailability: 2,
      immediateUpdateAllowed: false,
    });
    await openAppUpdate();
    expect(plugin.openAppStore).toHaveBeenCalledWith({});

    plugin.openAppStore.mockClear();
    plugin.getAppUpdateInfo.mockResolvedValue({
      updateAvailability: 2,
      immediateUpdateAllowed: true,
    });
    plugin.performImmediateUpdate.mockRejectedValueOnce(new Error('play'));
    await openAppUpdate();
    expect(plugin.openAppStore).toHaveBeenCalledWith({});
  });
});

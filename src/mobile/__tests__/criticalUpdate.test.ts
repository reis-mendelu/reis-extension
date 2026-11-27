import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchCritical = vi.fn();
vi.mock('../../api/criticalVersion', () => ({ fetchCriticalVersion: () => fetchCritical() }));
const track = vi.fn(async (_signal: string) => true);
vi.mock('../../api/featureUsage', () => ({ trackFeatureSignal: (s: string) => track(s) }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));
const version = { v: '5.6.0' };
vi.mock('../../utils/appIdentity', () => ({ getAppVersion: () => version.v }));

const meta = new Map<string, unknown>();
vi.mock('../../services/storage/IndexedDBService', () => ({
  CRITICAL_POPUP_KEY: 'critical_update_popup',
  IndexedDBService: {
    get: vi.fn(async (_store: string, key: string) => meta.get(key)),
    set: vi.fn(async (_store: string, key: string, value: unknown) => void meta.set(key, value)),
  },
}));

const state = {
  setCriticalUpdate: vi.fn(),
  openCriticalPopup: vi.fn(),
};
vi.mock('../../store/useAppStore', () => ({ useAppStore: { getState: () => state } }));

import { applyCriticalUpdate } from '../criticalUpdate';

const CRITICAL_POPUP_KEY = 'critical_update_popup';

const critical = { minVersion: '5.7.0', reason: { cz: 'IS změnil vzhled.', en: 'IS changed.' } };
const play = { updateAvailability: 2, availableVersionCode: '50800' };
const day1 = new Date(2026, 10, 21, 10);
const day1Later = new Date(2026, 10, 21, 18);
const day2 = new Date(2026, 10, 22, 9);
const day3 = new Date(2026, 10, 23, 9);

describe('applyCriticalUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meta.clear();
    version.v = '5.6.0';
    fetchCritical.mockResolvedValue(critical);
  });

  it('keeps the reason and opens the pop-up on a broken install', async () => {
    await applyCriticalUpdate(play, 'android', null, day1);
    expect(state.setCriticalUpdate).toHaveBeenCalledWith(critical);
    expect(state.openCriticalPopup).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('critical_update_shown');
    expect(meta.get(CRITICAL_POPUP_KEY)).toEqual({
      minVersion: '5.7.0',
      shown: 1,
      lastDay: '2026-11-21',
    });
  });

  it('shows the pop-up at most twice, on two different days', async () => {
    await applyCriticalUpdate(play, 'android', null, day1);
    await applyCriticalUpdate(play, 'android', null, day1Later);
    await applyCriticalUpdate(play, 'android', null, day2);
    await applyCriticalUpdate(play, 'android', null, day3);
    expect(state.openCriticalPopup).toHaveBeenCalledTimes(2);
    // The empty-screen hint stays for as long as the install is broken.
    expect(state.setCriticalUpdate).toHaveBeenLastCalledWith(critical);
  });

  it('clears everything on a working install', async () => {
    version.v = '5.8.0';
    await applyCriticalUpdate(play, 'android', null, day1);
    expect(state.setCriticalUpdate).toHaveBeenCalledWith(null);
    expect(state.openCriticalPopup).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('says nothing when there is no critical version', async () => {
    fetchCritical.mockResolvedValue(null);
    await applyCriticalUpdate(play, 'android', null, day1);
    expect(state.setCriticalUpdate).toHaveBeenCalledWith(null);
    expect(state.openCriticalPopup).not.toHaveBeenCalled();
  });

  it('says nothing while the store has no fix to hand over', async () => {
    await applyCriticalUpdate({ updateAvailability: 1 }, 'android', null, day1);
    expect(state.setCriticalUpdate).toHaveBeenCalledWith(null);
    expect(state.openCriticalPopup).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { clearSyncState, loadSyncState, saveSyncState } from '../syncStateStore';
import { installTestPlatform } from './testPlatform';

describe('syncStateStore', () => {
  beforeEach(() => installTestPlatform());
  it('defaults to disabled and empty', async () => {
    expect(await loadSyncState()).toEqual({
      enabled: false,
      calendarId: null,
      held: {},
      lastSyncAt: null,
      pastFillPending: false,
      reisDeleted: {},
      skipped: {},
      sourcesFingerprint: null,
    });
  });
  it('round-trips and clears', async () => {
    const s = {
      enabled: true,
      calendarId: 'c',
      held: { lesson: 'l1' },
      lastSyncAt: 5,
      pastFillPending: false,
      reisDeleted: { x: '2026-10-09' },
      skipped: {},
      sourcesFingerprint: 'f',
    };
    await saveSyncState(s);
    expect(await loadSyncState()).toEqual(s);
    await clearSyncState();
    expect((await loadSyncState()).enabled).toBe(false);
  });
});

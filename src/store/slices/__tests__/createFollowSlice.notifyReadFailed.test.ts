import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { createFollowSlice, DEFAULT_PREFS } from '../createFollowSlice';
import type { FollowSlice } from '../createFollowSlice';
import { IndexedDBService } from '../../../services/storage';
import { MUTED_KEY, NOTIFY_PREFS_KEY, NOTIFY_ASKED_KEY } from '../follows/loadFollows';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import type { Society } from '../../../types/events';

vi.mock('../../../utils/userParams', () => ({ getUserParams: () => Promise.resolve(null) }));

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

const SAVED_PREFS = { myEvents: false, followedEvents: false, newEvents: false };

/**
 * A failed read of the notification settings used to come back as the
 * defaults — no mutes, every switch ON — and a mutation computed from those
 * saved them over the student's real ones. `setNotifyPref` was the worst of
 * it: one tap switched back on everything else the student had turned off.
 * Same shape as `createFollowSlice.readFailed.test.ts`: one retry of the read,
 * memory only if it fails again, and disk wins at the next good read.
 */
describe('createFollowSlice — a failed read of the notification settings', () => {
  let state: FollowSlice & {
    societies: Record<string, Society>;
    mapEvents: unknown[];
    rsvp: Record<string, unknown>;
    language: string;
  };
  let disk: Map<string, unknown>;
  /** How many more loads have their settings read fail. */
  let failingReads: number;

  beforeEach(() => {
    vi.clearAllMocks();
    disk = new Map<string, unknown>([
      [MUTED_KEY, ['zf']],
      [NOTIFY_PREFS_KEY, SAVED_PREFS],
      [NOTIFY_ASKED_KEY, true],
    ]);
    failingReads = 0;
    vi.mocked(IndexedDBService.get).mockImplementation((_store: string, key: string) => {
      if (key === MUTED_KEY && failingReads > 0) {
        failingReads -= 1;
        return Promise.reject(new Error('InvalidStateError'));
      }
      return Promise.resolve(disk.get(key));
    });
    vi.mocked(IndexedDBService.set).mockImplementation(
      (_store: string, key: string, value: unknown) => {
        disk.set(key, value);
        return Promise.resolve(undefined);
      }
    );
    const set = vi.fn((fn) => {
      const patch = typeof fn === 'function' ? fn(state) : fn;
      Object.assign(state, patch);
    }) as Mock & Parameters<typeof createFollowSlice>[0];
    const get = vi.fn(() => state) as unknown as Parameters<typeof createFollowSlice>[1];
    state = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createFollowSlice(set, get, {} as any),
      societies: BUNDLED_SOCIETIES,
      mapEvents: [],
      rsvp: {},
      language: 'cz',
    };
  });

  it('setNotifyPref after reads that keep failing switches nothing back on', async () => {
    failingReads = Infinity;
    await state.loadFollows();

    await state.setNotifyPref('myEvents', true);

    expect(disk.get(NOTIFY_PREFS_KEY)).toEqual(SAVED_PREFS);
    expect(state.notifyPrefs.myEvents).toBe(true);
  });

  it('toggleMute after reads that keep failing leaves the saved mutes on disk', async () => {
    failingReads = Infinity;
    await state.loadFollows();

    await state.toggleMute('esn');
    await state.toggleMute('ldf');

    expect(disk.get(MUTED_KEY)).toEqual(['zf']);
    expect(state.muted).toEqual(['esn', 'ldf']);
  });

  it('a mutation whose retried read succeeds lands on the saved values and persists', async () => {
    failingReads = 1;
    await state.loadFollows();
    expect(state.notifyPrefs).toEqual(DEFAULT_PREFS);

    await state.setNotifyPref('newEvents', true);
    await state.toggleMute('esn');

    expect(disk.get(NOTIFY_PREFS_KEY)).toEqual({ ...SAVED_PREFS, newEvents: true });
    expect(disk.get(MUTED_KEY)).toEqual(['zf', 'esn']);
  });

  it('memory-only changes give way to disk at the next good read', async () => {
    failingReads = 2;
    await state.loadFollows();
    await state.setNotifyPref('myEvents', true);
    expect(state.notifyPrefs.myEvents).toBe(true);

    await state.loadFollows();

    expect(state.notifyPrefs).toEqual(SAVED_PREFS);
    expect(state.muted).toEqual(['zf']);
  });

  it('a later load whose read fails keeps what a good read already gave', async () => {
    await state.loadFollows();
    expect(state.permissionAsked).toBe(true);

    failingReads = Infinity;
    await state.loadFollows();

    expect(state.muted).toEqual(['zf']);
    expect(state.notifyPrefs).toEqual(SAVED_PREFS);
    expect(state.permissionAsked).toBe(true);

    await state.toggleMute('esn');
    expect(disk.get(MUTED_KEY)).toEqual(['zf', 'esn']);
  });

  it('with nothing saved (the read worked), a mutation persists as usual', async () => {
    disk.clear();
    await state.loadFollows();

    await state.toggleMute('esn');
    await state.setNotifyPref('newEvents', false);

    expect(disk.get(MUTED_KEY)).toEqual(['esn']);
    expect(disk.get(NOTIFY_PREFS_KEY)).toEqual({ ...DEFAULT_PREFS, newEvents: false });
  });

  // markPermissionAsked writes a constant `true`, never a value computed
  // from what was read, so a failed read gives it nothing to overwrite.
  it('markPermissionAsked still persists after a failed read', async () => {
    disk.delete(NOTIFY_ASKED_KEY);
    failingReads = Infinity;
    await state.loadFollows();

    await state.markPermissionAsked();

    expect(disk.get(NOTIFY_ASKED_KEY)).toBe(true);
    expect(state.permissionAsked).toBe(true);
  });
});

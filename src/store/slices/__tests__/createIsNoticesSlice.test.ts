/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchIsNotices = vi.fn();
const fetchIsNoticeMutes = vi.fn();
vi.mock('../../../api/isNotices', () => ({ fetchIsNotices }));
vi.mock('../../../api/isNoticeMutes', () => ({ fetchIsNoticeMutes }));
vi.mock('../../../api/isNoticeMutesAdmin', () => ({
  muteIsNotice: vi.fn(),
  unmuteIsNotice: vi.fn(),
}));
vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue({ cz: [{ key: 'cached' }], en: [] }),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

const { useAppStore } = await import('../../useAppStore');

beforeEach(() => {
  vi.clearAllMocks();
  fetchIsNoticeMutes.mockResolvedValue([]);
  useAppStore.setState({
    demoMode: false,
    isNotices: { cz: [], en: [] },
    isNoticesFetchedAt: null,
    isNoticesTriedAt: null,
    isNoticesLoading: false,
  } as any);
});

describe('IS notices in the store', () => {
  // With the IS session gone, the feed's five-minute refresh must not ask
  // IS for both languages every time.
  it('waits out the TTL after a failed read too, and keeps what it had', async () => {
    useAppStore.setState({ isNotices: { cz: [{ key: 'kept' }], en: [] } } as any);
    fetchIsNotices.mockRejectedValue(new Error('IS home page without a session'));
    await useAppStore.getState().loadIsNoticesIfStale();
    await useAppStore.getState().loadIsNoticesIfStale();
    expect(fetchIsNotices).toHaveBeenCalledTimes(2); // cz + en, once
    expect(useAppStore.getState().isNotices.cz).toEqual([{ key: 'kept' }]);
  });

  it('neither reads IS nor restores a real cache in demo mode', async () => {
    useAppStore.setState({ demoMode: true } as any);
    await useAppStore.getState().hydrateIsNotices();
    await useAppStore.getState().loadIsNoticesIfStale();
    expect(fetchIsNotices).not.toHaveBeenCalled();
    expect(useAppStore.getState().isNotices.cz).toEqual([]);
  });
});

describe('demo transitions', () => {
  // A request made just before entering or leaving the demo must not hold the
  // next session's first read back for the rest of the TTL.
  it('clear the retry pause along with the notices', async () => {
    useAppStore.setState({ isNoticesTriedAt: Date.now(), isNoticesFetchedAt: Date.now() } as any);
    await useAppStore.getState().exitDemo();
    expect(useAppStore.getState().isNoticesTriedAt).toBeNull();
    expect(useAppStore.getState().isNoticesFetchedAt).toBeNull();
  });
});

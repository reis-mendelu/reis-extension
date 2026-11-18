/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchStudyAids = vi.fn();
vi.mock('../../../api/studyAids', () => ({ fetchStudyAids }));
vi.mock('../../../api/adminStudyAids', () => ({
  fetchAdminStudyAids: vi.fn(),
  saveAdminStudyAids: vi.fn(),
}));

const { useAppStore } = await import('../../useAppStore');
const { IndexedDBService } = await import('../../../services/storage/IndexedDBService');
const { STUDY_AIDS_CACHE_KEY } = await import('../createStudyAidsSlice');

beforeEach(async () => {
  vi.clearAllMocks();
  await IndexedDBService.delete('meta', STUDY_AIDS_CACHE_KEY);
  useAppStore.setState({ studyAids: {}, studyAidsFetchedAt: null } as any);
});

describe('study aids audiences in the store', () => {
  it('takes the active rows from the network and keeps them for the next launch', async () => {
    fetchStudyAids.mockResolvedValue({ 'mendelu-app': ['af:B-ATE'] });
    await useAppStore.getState().loadStudyAids();
    expect(useAppStore.getState().studyAids).toEqual({ 'mendelu-app': ['af:B-ATE'] });
    expect(await IndexedDBService.get('meta', STUDY_AIDS_CACHE_KEY)).toEqual({
      'mendelu-app': ['af:B-ATE'],
    });
  });

  it('shows the cached audience while offline, when the read fails', async () => {
    await IndexedDBService.set('meta', STUDY_AIDS_CACHE_KEY, { 'mendelu-app': ['af:B-ATE'] });
    fetchStudyAids.mockResolvedValue(null);
    await useAppStore.getState().loadStudyAids();
    expect(useAppStore.getState().studyAids).toEqual({ 'mendelu-app': ['af:B-ATE'] });
  });

  it('shows no link when nothing is cached and the read fails', async () => {
    fetchStudyAids.mockResolvedValue(null);
    await useAppStore.getState().loadStudyAids();
    expect(useAppStore.getState().studyAids).toEqual({});
  });

  // The admin switching the link off makes the row invisible to anon, so the
  // answer is an empty record, which must clear what the device had.
  it('clears the link when the network says there is none any more', async () => {
    await IndexedDBService.set('meta', STUDY_AIDS_CACHE_KEY, { 'mendelu-app': ['af:B-ATE'] });
    fetchStudyAids.mockResolvedValue({});
    await useAppStore.getState().loadStudyAids();
    expect(useAppStore.getState().studyAids).toEqual({});
    expect(await IndexedDBService.get('meta', STUDY_AIDS_CACHE_KEY)).toEqual({});
  });

  it('ignores a cache that is not an id -> token list', async () => {
    await IndexedDBService.set('meta', STUDY_AIDS_CACHE_KEY, { 'mendelu-app': 'af' } as any);
    fetchStudyAids.mockResolvedValue(null);
    await useAppStore.getState().loadStudyAids();
    expect(useAppStore.getState().studyAids).toEqual({});
  });
});

// A phone process can stay alive for days, so boot is not enough: the feed's
// refresh asks again, no more often than the gap, and a read that failed at boot
// is simply tried again.
describe('refreshing the audience in a long-lived session', () => {
  it('does not ask again inside the gap, and asks again after it', async () => {
    fetchStudyAids.mockResolvedValue({ 'mendelu-app': ['af'] });
    await useAppStore.getState().loadStudyAids();
    await useAppStore.getState().loadStudyAidsIfStale(60_000);
    expect(fetchStudyAids).toHaveBeenCalledTimes(1);

    // The admin switched the link off meanwhile: no rows are visible to anon.
    useAppStore.setState({ studyAidsFetchedAt: Date.now() - 61_000 } as any);
    fetchStudyAids.mockResolvedValue({});
    await useAppStore.getState().loadStudyAidsIfStale(60_000);
    expect(fetchStudyAids).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().studyAids).toEqual({});
  });

  it('retries a read that failed at boot, at the next refresh', async () => {
    fetchStudyAids.mockResolvedValueOnce(null);
    await useAppStore.getState().loadStudyAids();
    expect(useAppStore.getState().studyAidsFetchedAt).toBeNull();

    fetchStudyAids.mockResolvedValueOnce({ 'mendelu-app': ['af:B-ATE'] });
    await useAppStore.getState().loadStudyAidsIfStale(60_000);
    expect(fetchStudyAids).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().studyAids).toEqual({ 'mendelu-app': ['af:B-ATE'] });
  });

  it('keeps what it has when a refresh fails', async () => {
    fetchStudyAids.mockResolvedValueOnce({ 'mendelu-app': ['af:B-ATE'] });
    await useAppStore.getState().loadStudyAids();
    useAppStore.setState({ studyAidsFetchedAt: Date.now() - 61_000 } as any);
    fetchStudyAids.mockResolvedValueOnce(null);
    await useAppStore.getState().loadStudyAidsIfStale(60_000);
    expect(useAppStore.getState().studyAids).toEqual({ 'mendelu-app': ['af:B-ATE'] });
  });
});

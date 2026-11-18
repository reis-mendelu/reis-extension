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
  useAppStore.setState({ studyAids: {} } as any);
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

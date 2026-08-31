import { describe, it, expect, vi, beforeEach } from 'vitest';

const idbGet = vi.fn();
const idbSet = vi.fn();
const fetchUserBaseIds = vi.fn();
const fetchUserStudyDetails = vi.fn();
const fetchUserNetId = vi.fn();

vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: (...a: unknown[]) => idbGet(...a),
    set: (...a: unknown[]) => idbSet(...a),
  },
}));
vi.mock('../userParams/fetchers', () => ({
  fetchUserBaseIds: () => fetchUserBaseIds(),
  fetchUserStudyDetails: () => fetchUserStudyDetails(),
  fetchUserNetId: () => fetchUserNetId(),
}));

const { getUserParams, clearUserParamsCache } = await import('../userParams');

const COMPLETE = {
  studium: '149707',
  obdobi: '812',
  studentId: '120344',
  fullName: 'Jan Novák',
  isErasmus: false,
};

describe('getUserParams', () => {
  beforeEach(() => {
    clearUserParamsCache();
    idbGet.mockReset();
    idbSet.mockReset();
    fetchUserBaseIds.mockReset();
    fetchUserStudyDetails.mockReset().mockResolvedValue({});
    fetchUserNetId.mockReset().mockResolvedValue({ username: 'xnovak' });
  });

  it('serves a complete stored record without touching the network', async () => {
    idbGet.mockResolvedValue(COMPLETE);
    const params = await getUserParams();
    expect(params?.studentId).toBe('120344');
    expect(fetchUserBaseIds).not.toHaveBeenCalled();
  });

  /**
   * The one that matters. A record written while IS was answering in English
   * has `studium`/`obdobi` and nothing else — and the old guard accepted it as
   * complete, so the empty `studentId` outlived the parser bug that produced
   * it. Every install that ever stored one would stay photo-less no matter
   * what the fetchers learned to parse.
   */
  it('refetches when the stored record has no identity on it', async () => {
    idbGet.mockResolvedValue({ studium: '149707', obdobi: '812', studentId: '', fullName: '' });
    fetchUserBaseIds.mockResolvedValue(COMPLETE);
    const params = await getUserParams();
    expect(fetchUserBaseIds).toHaveBeenCalled();
    expect(params?.studentId).toBe('120344');
    expect(params?.fullName).toBe('Jan Novák');
  });

  // A refetch that comes back empty must not wipe what is already stored:
  // stale identity beats none, and the next launch tries again.
  it('keeps the stored record when the refetch yields nothing', async () => {
    idbGet.mockResolvedValue({ studium: '149707', obdobi: '812', studentId: '', fullName: '' });
    fetchUserBaseIds.mockResolvedValue(null);
    const params = await getUserParams();
    expect(params?.studium).toBe('149707');
  });
});

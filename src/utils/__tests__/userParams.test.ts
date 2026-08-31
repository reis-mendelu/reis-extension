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

  /**
   * And the same when it THROWS, which is the common case offline — a rejection
   * used to fall through to the outer catch and return null, so adding the
   * refetch would have cost every offline launch the `studium` that the
   * schedule, study plan, teaching weeks and grade history all read. Before the
   * refetch existed this path never touched the network at all, so this is a
   * regression the refetch introduced rather than a pre-existing gap.
   */
  it('keeps the stored record when the refetch throws', async () => {
    idbGet.mockResolvedValue({ studium: '149707', obdobi: '812', studentId: '', fullName: '' });
    fetchUserBaseIds.mockRejectedValue(new Error('offline'));
    const params = await getUserParams();
    expect(params?.studium).toBe('149707');
    expect(params?.obdobi).toBe('812');
  });

  // The later stages reject into the same catch, and the guarantee has to hold
  // for the whole chain rather than just its first link.
  it('keeps the stored record when a later refresh stage throws', async () => {
    idbGet.mockResolvedValue({ studium: '149707', obdobi: '812', studentId: '', fullName: '' });
    fetchUserBaseIds.mockResolvedValue(COMPLETE);
    fetchUserStudyDetails.mockRejectedValue(new Error('offline'));
    expect((await getUserParams())?.studium).toBe('149707');

    clearUserParamsCache();
    fetchUserStudyDetails.mockResolvedValue({});
    fetchUserNetId.mockRejectedValue(new Error('offline'));
    expect((await getUserParams())?.studium).toBe('149707');
  });

  // Nothing stored and nothing fetchable is still null, not a half-object.
  it('returns null when there is neither a stored record nor a fetch', async () => {
    idbGet.mockResolvedValue(undefined);
    fetchUserBaseIds.mockRejectedValue(new Error('offline'));
    expect(await getUserParams()).toBeNull();
  });
});

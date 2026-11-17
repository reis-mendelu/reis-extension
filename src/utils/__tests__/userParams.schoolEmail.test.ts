import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A VŠE build serving a record an older build stored. The prototype built the
 * address as `<username>@mendelu.cz` and a complete record is served as it
 * stands, never rebuilt, so the address has to be derived again on the way out
 * or the profile keeps showing a VŠE student a MENDELU address.
 */
vi.mock('../school', async () => {
  const real = await vi.importActual<typeof import('../school')>('../school');
  const { SCHOOL_PROFILES } = await import('../schoolProfiles');
  return { ...real, currentSchool: real.schoolFor(SCHOOL_PROFILES.vse) };
});

const idbGet = vi.fn();
const fetchUserBaseIds = vi.fn();

vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: (...a: unknown[]) => idbGet(...a),
    set: vi.fn(async () => {}),
    clearAll: vi.fn(async () => {}),
  },
}));
vi.mock('../userParams/fetchers', () => ({
  fetchUserBaseIds: () => fetchUserBaseIds(),
  fetchUserStudyDetails: vi.fn(async () => ({})),
  fetchUserNetId: vi.fn(async () => ({ username: 'xnovj01' })),
}));

const { getUserParams, clearUserParamsCache } = await import('../userParams');

const STORED = {
  studium: '149707',
  obdobi: '812',
  studentId: '120344',
  fullName: 'Jana Nováková',
  isErasmus: false,
  username: 'xnovj01',
  email: 'xnovj01@mendelu.cz',
};

describe('getUserParams at VŠE, over a record an older build stored', () => {
  beforeEach(() => {
    clearUserParamsCache();
    idbGet.mockReset().mockResolvedValue({ ...STORED });
    fetchUserBaseIds.mockReset();
  });

  it('serves no @mendelu.cz address for the same student, nor from the session cache', async () => {
    fetchUserBaseIds.mockResolvedValue({ studium: STORED.studium, studentId: STORED.studentId });

    const first = await getUserParams();
    expect(first).toMatchObject({ studentId: '120344', email: '' });
    // The second call is answered from the session cache.
    const second = await getUserParams();
    expect(second?.email).toBe('');
    expect(fetchUserBaseIds).toHaveBeenCalledTimes(1);
  });

  it('serves none offline either, when IS cannot be read', async () => {
    fetchUserBaseIds.mockResolvedValue(null);

    expect(await getUserParams()).toMatchObject({ studentId: '120344', email: '' });
  });
});

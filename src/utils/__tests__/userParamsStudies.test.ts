import { describe, it, expect, vi, beforeEach } from 'vitest';

const idbGet = vi.fn();
const idbSet = vi.fn();
const idbClearAll = vi.fn();
const fetchUserBaseIds = vi.fn();
const fetchUserStudyDetails = vi.fn();
const fetchUserNetId = vi.fn();
const getPreferredStudium = vi.fn();
const clearStudyData = vi.fn();

vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: (...a: unknown[]) => idbGet(...a),
    set: (...a: unknown[]) => idbSet(...a),
    clearAll: () => idbClearAll(),
  },
}));
vi.mock('../userParams/fetchers', () => ({
  fetchUserBaseIds: (...a: unknown[]) => fetchUserBaseIds(...a),
  fetchUserStudyDetails: (...a: unknown[]) => fetchUserStudyDetails(...a),
  fetchUserNetId: () => fetchUserNetId(),
}));
vi.mock('../userParams/studyPreference', () => ({
  getPreferredStudium: (...a: unknown[]) => getPreferredStudium(...a),
}));
vi.mock('../userParams/clearStudyData', () => ({
  clearStudyData: () => clearStudyData(),
}));

const { getUserParams, clearUserParamsCache } = await import('../userParams');
const { onIdentityChange } = await import('../userParams/identityEvents');

const A = { studium: '900001', label: 'PEF B-EKO komb [sem 1, roč 1]' };
const B = { studium: '900002', label: 'PEF B-OI prez [sem 3, roč 2]' };
const ID = { studentId: '900100', fullName: 'Jana Nováková', isErasmus: false, html: '' };

/** `studium.pl` as IS serves it: the default (A) unless a study is asked for. */
const pageOf = (studium: string, studyStatus: string | null = 'řádně zapsán') => ({
  ...ID,
  studium,
  obdobi: '829',
  studies: [A, B],
  studyStatus,
});

describe('getUserParams with two studies', () => {
  beforeEach(() => {
    clearUserParamsCache();
    for (const f of [idbGet, idbSet, idbClearAll, clearStudyData, getPreferredStudium])
      f.mockReset();
    getPreferredStudium.mockResolvedValue(null);
    fetchUserBaseIds
      .mockReset()
      .mockImplementation((s?: string) => Promise.resolve(pageOf(s ?? A.studium)));
    fetchUserStudyDetails.mockReset().mockResolvedValue({ studyProgram: 'B-OI' });
    fetchUserNetId.mockReset().mockResolvedValue({ username: 'xnovak' });
  });

  it('follows the study the student picked, and tells moje_studium which one', async () => {
    idbGet.mockResolvedValue({ ...pageOf(A.studium), studies: [A, B] });
    getPreferredStudium.mockResolvedValue(B.studium);

    const p = await getUserParams();
    expect(p?.studium).toBe(B.studium);
    expect(p?.studies).toEqual([A, B]);
    expect(fetchUserStudyDetails).toHaveBeenCalledWith(B.studium);
    expect(idbSet).toHaveBeenCalledWith(
      'meta',
      'reis_user_params',
      expect.objectContaining({ studium: B.studium })
    );
  });

  // Moving study is not a new student: only that study's cache goes, notes and
  // settings stay, and the society login is not touched.
  it('drops only the old study’s data, before storing the new record, and asks for a restart', async () => {
    idbGet.mockResolvedValue({ ...pageOf(A.studium), studies: [A, B] });
    getPreferredStudium.mockResolvedValue(B.studium);
    const order: string[] = [];
    clearStudyData.mockImplementation(() => void order.push('clear'));
    idbSet.mockImplementation(() => void order.push('set'));
    const changes: unknown[] = [];
    const off = onIdentityChange((params, change) =>
      changes.push({ studium: params?.studium, ...change })
    );

    await getUserParams();
    off();
    expect(idbClearAll).not.toHaveBeenCalled();
    expect(order).toEqual(['clear', 'set']);
    expect(changes).toEqual([{ studium: B.studium, wiped: true, studyOnly: true }]);
  });

  // The 7 Oct report: reIS was on her interrupted study.
  it('moves a record written before studies were known onto the enrolled study', async () => {
    idbGet.mockResolvedValue({ ...pageOf(A.studium), studies: undefined });
    fetchUserBaseIds.mockImplementation((s?: string) =>
      Promise.resolve(pageOf(s ?? A.studium, s === A.studium ? 'přerušeno' : 'řádně zapsán'))
    );

    const p = await getUserParams();
    expect(p?.studium).toBe(B.studium);
    expect(clearStudyData).toHaveBeenCalledTimes(1);
  });

  it('serves a decided record as it stands, asking IS nothing more', async () => {
    idbGet.mockResolvedValue({ ...pageOf(B.studium), studies: [A, B] });

    const p = await getUserParams();
    expect(p?.studium).toBe(B.studium);
    expect(fetchUserBaseIds).toHaveBeenCalledTimes(1);
    expect(idbSet).not.toHaveBeenCalled();
    expect(clearStudyData).not.toHaveBeenCalled();
  });

  it('never moves the student when a status page cannot be read', async () => {
    idbGet.mockResolvedValue({ ...pageOf(A.studium), studies: undefined });
    fetchUserBaseIds.mockImplementation((s?: string) =>
      Promise.resolve(s === B.studium ? null : pageOf(s ?? A.studium))
    );

    const p = await getUserParams();
    expect(p?.studium).toBe(A.studium);
    expect(clearStudyData).not.toHaveBeenCalled();
    expect(idbSet).not.toHaveBeenCalled();
  });

  it('records the decision on a first install without moving anything', async () => {
    idbGet.mockResolvedValue(undefined);

    const p = await getUserParams();
    expect(p?.studium).toBe(A.studium);
    expect(p?.studies).toEqual([A, B]);
    expect(clearStudyData).not.toHaveBeenCalled();
  });
});

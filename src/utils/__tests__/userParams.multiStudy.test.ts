import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseStudyLabel, type StudyOption } from '../userParams/studies';

const idbGet = vi.fn();
const idbSet = vi.fn();
const idbClearAll = vi.fn();
const fetchUserBaseIds = vi.fn();
const fetchUserStudyDetails = vi.fn();
const fetchUserNetId = vi.fn();
const resolveStudies = vi.fn();

vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: (...a: unknown[]) => idbGet(...a),
    set: (...a: unknown[]) => idbSet(...a),
    clearAll: () => idbClearAll(),
  },
}));
vi.mock('../userParams/fetchers', () => ({
  fetchUserBaseIds: () => fetchUserBaseIds(),
  fetchUserStudyDetails: () => fetchUserStudyDetails(),
  fetchUserNetId: () => fetchUserNetId(),
}));
vi.mock('../userParams/resolveStudies', () => ({
  resolveStudies: (...a: unknown[]) => resolveStudies(...a),
}));

const { getUserParams, clearUserParamsCache, selectStudy, adoptStoredStudy } =
  await import('../userParams');
const { onIdentityChange } = await import('../userParams/identityEvents');

const AII: StudyOption = {
  studium: '900011',
  obdobi: '829',
  label: 'PEF B-AII prez [sem 1, roč 1]',
  isErasmus: false,
};
const EM: StudyOption = {
  studium: '900012',
  obdobi: '829',
  label: 'PEF B-EM komb [sem 1, roč 1]',
  isErasmus: false,
};
const OPTIONS = [AII, EM].map(({ studium, label }) => ({ studium, label }));

const IDENTITY = { studentId: '100001', fullName: 'Jana Nováková' };

/** What IS's own default page parses to: whichever study IS opened. */
const base = (studium: string, obdobi = '829') => ({
  studium,
  obdobi,
  ...IDENTITY,
  isErasmus: false,
  html: '',
  options: OPTIONS,
});

const stored = (s: StudyOption, studies?: StudyOption[]) => ({
  studium: s.studium,
  obdobi: s.obdobi,
  ...IDENTITY,
  facultyId: '',
  username: 'xnovak',
  email: 'xnovak@mendelu.cz',
  ...parseStudyLabel(s.label),
  isErasmus: false,
  ...(studies ? { studies } : {}),
});

describe('getUserParams with more than one study', () => {
  const announced = vi.fn();
  let off: () => void;

  beforeEach(() => {
    clearUserParamsCache();
    off?.();
    off = onIdentityChange(announced);
    announced.mockReset();
    for (const m of [idbGet, idbSet, idbClearAll, fetchUserBaseIds, resolveStudies]) m.mockReset();
    // moje_studium.pl with two studies: the header's first <b> is the period
    // filter, not the study — the misread this change exists to stop using.
    fetchUserStudyDetails.mockReset().mockResolvedValue({
      facultyId: '',
      studyCode: 'všechna období',
      periodLabel: 'ZS 2026/2027',
    });
    fetchUserNetId.mockReset().mockResolvedValue({ username: 'xnovak' });
  });

  it('never resolves studies for a single-study student', async () => {
    idbGet.mockResolvedValue(stored(AII));
    fetchUserBaseIds.mockResolvedValue({ ...base('900011'), options: [] });
    await getUserParams();
    expect(resolveStudies).not.toHaveBeenCalled();
    expect(idbSet).not.toHaveBeenCalled();
  });

  /**
   * The interrupted-study report, on an install that already exists: the
   * stored record carries the WRONG study, and the next start corrects it
   * without the student doing anything — and without the "different student"
   * wipe, because it is the same student.
   */
  it('re-resolves a cached study that is no longer active, on the next start', async () => {
    const INTERRUPTED: StudyOption = { ...EM, studium: '900003', obdobi: '815' };
    idbGet.mockResolvedValue(stored(INTERRUPTED));
    fetchUserBaseIds.mockResolvedValue(base('900003', '815'));
    resolveStudies.mockResolvedValue({ active: [AII], chosen: AII });

    const params = await getUserParams();

    expect(resolveStudies).toHaveBeenCalledWith(OPTIONS, '900003');
    expect(params).toMatchObject({
      studium: '900011',
      obdobi: '829',
      studyCode: 'PEF B-AII prez [sem 1, roč 1]',
      facultyLabel: 'PEF',
      studyProgram: 'B-AII',
      studyForm: 'prez',
      studentId: '100001',
      studies: [AII],
    });
    expect(idbSet).toHaveBeenCalledWith('meta', expect.anything(), params);
    expect(idbClearAll).not.toHaveBeenCalled();
    expect(announced).not.toHaveBeenCalled();
  });

  it('serves the stored record when it already names the chosen study', async () => {
    idbGet.mockResolvedValue(stored(EM, [AII, EM]));
    fetchUserBaseIds.mockResolvedValue(base('900011'));
    resolveStudies.mockResolvedValue({ active: [AII, EM], chosen: EM });
    const params = await getUserParams();
    expect(params?.studium).toBe('900012');
    expect(idbSet).not.toHaveBeenCalled();
  });

  /**
   * A first install has nothing to fall back on. Before studies were read it
   * got IS's default study; a failed study page must not leave it with none
   * (and every call site asking IS again).
   */
  it("uses IS's default study on a first install when the study pages fail", async () => {
    idbGet.mockResolvedValue(undefined);
    fetchUserBaseIds.mockResolvedValue(base('900011'));
    resolveStudies.mockRejectedValue(new Error('offline'));
    const params = await getUserParams();
    expect(params).toMatchObject({ studium: '900011', studentId: '100001' });
    expect(params?.studies).toBeUndefined();
    await getUserParams();
    expect(fetchUserBaseIds).toHaveBeenCalledTimes(1);
  });

  it('drops the study list once IS shows only one study', async () => {
    idbGet.mockResolvedValue(stored(EM, [AII, EM]));
    fetchUserBaseIds.mockResolvedValue({ ...base('900011'), options: [] });
    const params = await getUserParams();
    expect(resolveStudies).not.toHaveBeenCalled();
    expect(params?.studium).toBe('900011');
    expect(params?.studies).toBeUndefined();
    expect(idbClearAll).not.toHaveBeenCalled();
  });

  // A boot in one IS tab must not write back the study the student has just
  // switched away from in another, because its study pages were slow.
  it('keeps a switch another context made while the study pages loaded', async () => {
    const INTERRUPTED: StudyOption = { ...EM, studium: '900003', obdobi: '815' };
    idbGet.mockResolvedValueOnce(stored(INTERRUPTED));
    idbGet.mockResolvedValue(stored(EM, [AII, EM]));
    fetchUserBaseIds.mockResolvedValue(base('900003', '815'));
    resolveStudies.mockResolvedValue({ active: [AII, EM], chosen: AII });
    const params = await getUserParams();
    expect(params?.studium).toBe('900012');
    expect(idbSet).not.toHaveBeenCalled();
  });

  it('keeps a usable record when the study pages cannot be read', async () => {
    idbGet.mockResolvedValue(stored(EM, [AII, EM]));
    fetchUserBaseIds.mockResolvedValue(base('900011'));
    resolveStudies.mockRejectedValue(new Error('offline'));
    const params = await getUserParams();
    expect(params?.studium).toBe('900012');
    expect(idbClearAll).not.toHaveBeenCalled();
  });
});

describe('selectStudy', () => {
  const announced = vi.fn();
  onIdentityChange(announced);

  beforeEach(async () => {
    clearUserParamsCache();
    announced.mockReset();
    for (const m of [idbGet, idbSet, idbClearAll, fetchUserBaseIds, resolveStudies]) m.mockReset();
    idbGet.mockResolvedValue(stored(AII, [AII, EM]));
    fetchUserBaseIds.mockResolvedValue(base('900011'));
    resolveStudies.mockResolvedValue({ active: [AII, EM], chosen: AII });
    await getUserParams();
    idbSet.mockReset();
  });

  it("switches to the other study's ids and fields, and nothing else", async () => {
    const { params: next, changed } = await selectStudy('900012');
    expect(changed).toBe(true);
    expect(next).toMatchObject({
      studium: '900012',
      obdobi: '829',
      studyCode: 'PEF B-EM komb [sem 1, roč 1]',
      studyProgram: 'B-EM',
      studyForm: 'komb',
      studentId: '100001',
      fullName: 'Jana Nováková',
      studies: [AII, EM],
    });
    expect(idbSet).toHaveBeenCalledWith('meta', expect.anything(), next);
    // Served from now on, without asking IS again.
    expect((await getUserParams())?.studium).toBe('900012');
    expect(fetchUserBaseIds).toHaveBeenCalledTimes(1);
  });

  // The switch is the same student. The wipe is for a different one.
  it('never wipes and never announces an identity change', async () => {
    await selectStudy('900012');
    expect(idbClearAll).not.toHaveBeenCalled();
    expect(announced).not.toHaveBeenCalled();
  });

  it('applies a forward switch and its rollback in the order they were sent', async () => {
    const forward = selectStudy('900012');
    const back = selectStudy('900011');
    await expect(forward).resolves.toMatchObject({ changed: true });
    await expect(back).resolves.toMatchObject({ changed: true });
    expect((await getUserParams())?.studium).toBe('900011');
  });

  // Another IS tab switched; this tab's crawl must follow, not keep the old one.
  it("adopts a switch made in another tab's context", async () => {
    idbGet.mockResolvedValue({ ...stored(EM, [AII, EM]) });
    await adoptStoredStudy();
    expect((await getUserParams())?.studium).toBe('900012');
  });

  it('adopts nothing that is not one of the studies, or another student', async () => {
    idbGet.mockResolvedValue({ ...stored(EM, [AII]) });
    await adoptStoredStudy();
    idbGet.mockResolvedValue({ ...stored(EM, [AII, EM]), studentId: '999999' });
    await adoptStoredStudy();
    expect((await getUserParams())?.studium).toBe('900011');
  });

  // The content script's study pages failed when its record was built, so it
  // has no list, while the app's did and offered the switch.
  it('asks IS again before refusing a study its own list does not have', async () => {
    clearUserParamsCache();
    idbGet.mockResolvedValue(stored(AII));
    fetchUserBaseIds.mockResolvedValue(base('900011'));
    resolveStudies.mockRejectedValueOnce(new Error('offline'));
    expect((await getUserParams())?.studies).toBeUndefined();

    resolveStudies.mockResolvedValue({ active: [AII, EM], chosen: AII });
    await expect(selectStudy('900012')).resolves.toMatchObject({ changed: true });
    expect(idbClearAll).not.toHaveBeenCalled();
  });

  // The id arrives over postMessage from the other context.
  it('refuses a study that is not one of the active ones', async () => {
    await expect(selectStudy('900003')).rejects.toThrow();
    expect(idbSet).not.toHaveBeenCalled();
    expect((await getUserParams())?.studium).toBe('900011');
  });
});

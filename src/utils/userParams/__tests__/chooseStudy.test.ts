import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchUserBaseIds = vi.fn();
vi.mock('../fetchers', () => ({
  fetchUserBaseIds: (...args: unknown[]) => fetchUserBaseIds(...args),
}));

const { chooseStudy, needsStudyResolution } = await import('../chooseStudy');

const A = { studium: '900001', label: 'PEF B-EKO komb [sem 1, roč 1]' };
const B = { studium: '900002', label: 'PEF B-OI prez [sem 3, roč 2]' };

/** What `fetchUserBaseIds` returns for one study's own page. */
const page = (studium: string, studyStatus: string | null, obdobi = '829') => ({
  studium,
  obdobi,
  studentId: '900100',
  fullName: 'Jana Nováková',
  isErasmus: false,
  html: '',
  studies: [A, B],
  studyStatus,
});

const base = page(A.studium, 'řádně zapsán');

describe('needsStudyResolution', () => {
  const stored = { studium: A.studium, studies: [A, B] };

  // The invariant for everyone else: one study, nothing to decide.
  it('never asks for a student with one study', () => {
    expect(needsStudyResolution({ studium: '1' }, [], null)).toBe(false);
    expect(needsStudyResolution({ studium: '1' }, [{ studium: '1', label: 'x' }], null)).toBe(
      false
    );
  });

  // The 7 Oct report: a record written before reIS knew about studies, on the
  // wrong one. Without this it is served as complete forever.
  it('asks once for a record written before studies were known', () => {
    expect(needsStudyResolution({ studium: A.studium }, [A, B], null)).toBe(true);
  });

  it('does not ask again once the decision is stored', () => {
    expect(needsStudyResolution(stored, [A, B], null)).toBe(false);
    expect(needsStudyResolution(stored, [A, B], A.studium)).toBe(false);
  });

  it('asks when the student picked the other study', () => {
    expect(needsStudyResolution(stored, [A, B], B.studium)).toBe(true);
  });

  it('ignores a preference IS no longer offers', () => {
    expect(needsStudyResolution(stored, [A, B], '999')).toBe(false);
  });

  it('asks when the studies on offer changed', () => {
    expect(needsStudyResolution(stored, [A, { studium: '777', label: 'x' }], null)).toBe(true);
  });

  it('asks when a second study ended and only one is left', () => {
    expect(needsStudyResolution({ studium: B.studium, studies: [A, B] }, [A], null)).toBe(true);
  });
});

describe('chooseStudy', () => {
  beforeEach(() => fetchUserBaseIds.mockReset());

  it('keeps the page as it is for one study, asking IS nothing more', async () => {
    const single = { ...base, studies: [] };
    expect(await chooseStudy(single, undefined, null)).toEqual({ base: single, studies: [] });
    expect(fetchUserBaseIds).not.toHaveBeenCalled();
  });

  it("follows the student's own choice, with that study's obdobi", async () => {
    fetchUserBaseIds.mockResolvedValue(page(B.studium, 'řádně zapsán', '830'));
    const out = await chooseStudy(base, { studium: A.studium, studies: [A, B] }, B.studium);
    expect(fetchUserBaseIds).toHaveBeenCalledWith(B.studium);
    expect(out?.base).toMatchObject({ studium: B.studium, obdobi: '830' });
    expect(out?.studies).toEqual([A, B]);
  });

  it("does not fetch again when the choice is IS's default", async () => {
    const out = await chooseStudy(base, undefined, A.studium);
    expect(fetchUserBaseIds).not.toHaveBeenCalled();
    expect(out?.base.studium).toBe(A.studium);
  });

  // Unverified wording for an interrupted study — see isEnrolledStatus.
  it('picks the first study the student is enrolled in', async () => {
    fetchUserBaseIds.mockImplementation((s: string) =>
      Promise.resolve(
        s === A.studium ? page(A.studium, 'přerušeno') : page(B.studium, 'řádně zapsán')
      )
    );
    const out = await chooseStudy(base, { studium: A.studium }, null);
    expect(out?.base.studium).toBe(B.studium);
    expect(out?.studies).toEqual([A, B]);
  });

  it("keeps IS's default when both studies are enrolled", async () => {
    fetchUserBaseIds.mockImplementation((s: string) => Promise.resolve(page(s, 'řádně zapsán')));
    const out = await chooseStudy(base, undefined, null);
    expect(out?.base.studium).toBe(A.studium);
  });

  // A failed fetch and a real answer must never be confused: a flaky boot
  // that moved the student to another study would wipe their cache.
  it('keeps the stored study and decides nothing when a status page fails', async () => {
    fetchUserBaseIds.mockImplementation((s: string) =>
      Promise.resolve(s === A.studium ? null : page(B.studium, 'řádně zapsán'))
    );
    expect(await chooseStudy(base, { studium: B.studium }, null)).toBeNull();
  });

  it('falls back to the default without storing a decision when nothing is stored', async () => {
    fetchUserBaseIds.mockResolvedValue(null);
    const out = await chooseStudy(base, undefined, null);
    expect(out).toEqual({ base, studies: undefined });
  });

  it('keeps the stored study when the chosen study cannot be read', async () => {
    fetchUserBaseIds.mockResolvedValue(null);
    expect(await chooseStudy(base, { studium: A.studium, studies: [A, B] }, B.studium)).toBeNull();
  });

  it('returns to the only study left when the other one ended', async () => {
    const single = { ...base, studies: [A] };
    const out = await chooseStudy(single, { studium: B.studium, studies: [A, B] }, B.studium);
    expect(out).toEqual({ base: single, studies: [A] });
  });
});

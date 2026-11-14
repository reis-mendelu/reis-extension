import { describe, expect, it, vi } from 'vitest';

// A VŠE build: what a student there actually gets. Mocked before the imports
// below, because some gates are read once at module load.
vi.mock('../../utils/school', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/school')>();
  const { SCHOOL_PROFILES } = await import('../../utils/schoolProfiles');
  return { ...real, currentSchool: real.schoolFor(SCHOOL_PROFILES.vse) };
});

const { mainItems } = await import('../../components/Menu/MainItems');
const { tabForThisSchool } =
  await import('../../components/SubjectFileDrawer/useSubjectFileDrawerState');
const { reportToastOptions } = await import('../../components/Feedback/reportPrefill');
const { pagesData } = await import('../../data/pages/index');

const t = (k: string) => k;

describe("VŠE's profile, switched on", () => {
  it('has no map, practice tests or study documents in the menu', () => {
    const items = mainItems('1', '2', t);
    const ids = items.flatMap((i) => [i.id, ...(i.children ?? []).map((c) => c.id)]);
    expect(ids).not.toEqual(expect.arrayContaining(['map']));
    expect(ids).not.toContain('testy');
    expect(ids).not.toContain('dokumenty');
    expect(ids).toEqual(expect.arrayContaining(['dashboard', 'exams', 'subjects', 'oldIs']));
  });

  it('opens the syllabus where a caller asks for success rates', () => {
    expect(tabForThisSchool('stats')).toBe('syllabus');
    expect(tabForThisSchool('files')).toBe('files');
    expect(tabForThisSchool(undefined)).toBeUndefined();
  });

  it('offers no report action on a failure toast', () => {
    expect(reportToastOptions(t, 'examActionFailed').action).toBeUndefined();
  });

  it("lists Starý IS without MENDELU's own pages or menu numbering", () => {
    const hrefs = pagesData.flatMap((c) => c.children.map((p) => p.href));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.some((h) => h.includes('/auth/uskm/'))).toBe(false);
    expect(hrefs.some((h) => /[?;]_m=/.test(h))).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';

// The other-school build switched ON: what a student there actually gets.
vi.mock('../../utils/otherSchool', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/otherSchool')>()),
  IS_OTHER_SCHOOL: true,
}));

const { mainItems } = await import('../../components/Menu/MainItems');
const { tabForThisSchool } =
  await import('../../components/SubjectFileDrawer/useSubjectFileDrawerState');
const { reportToastOptions } = await import('../../components/Feedback/reportPrefill');

const t = (k: string) => k;

describe('other-school build, switched on', () => {
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
});

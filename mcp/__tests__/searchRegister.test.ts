// The search tool as a server registers it: what a file read saved is found after a restart,
// with no IS login, and the tool is announced as read-only.
import { it, describe, expect, vi } from 'vitest';

vi.mock('../../src/utils/userParams', () => ({
  getUserParams: vi.fn().mockResolvedValue({
    studium: 'S',
    obdobi: 'O',
    studyForm: 'P',
    studyProgram: 'PI',
    studyCode: 'PEF PI P [sem 3, roč 2]',
    facultyLabel: 'PEF',
    studySemester: 3,
    studyYear: 2,
    periodLabel: 'ZS 2026/2027',
    username: 'xtest',
    fullName: 'Test Student',
    studentId: '12345',
    email: 'xtest@mendelu.cz',
  }),
}));
vi.mock('../../src/injector/dataFetchers', () => ({ fetchFullSemesterSchedule: vi.fn() }));
vi.mock('../../src/api/exams', () => ({ fetchDualLanguageExams: vi.fn() }));
vi.mock('../../src/api/subjects', () => ({ fetchDualLanguageSubjects: vi.fn() }));
vi.mock('../../src/api/studyPlan', () => ({ fetchDualLanguageStudyPlan: vi.fn() }));
vi.mock('../../src/api/syllabus', async (orig) => ({
  ...(await orig<typeof import('../../src/api/syllabus')>()),
  fetchSyllabus: vi.fn(),
}));
vi.mock('../../src/api/successRate', () => ({ fetchSubjectSuccessRates: vi.fn() }));
vi.mock('../../src/api/gradeHistory', () => ({ fetchGradeHistory: vi.fn() }));
vi.mock('../../src/api/odevzdavarny', () => ({ fetchOdevzdavarny: vi.fn() }));
vi.mock('../../src/api/zaznamnik', () => ({ fetchSubjectZaznamnik: vi.fn() }));
vi.mock('../../src/api/documents/service', () => ({ fetchFolderListing: vi.fn() }));

import { is, tempDir, boot, ask, textOf } from './mapKit';
import { NO_LOGIN_MESSAGE } from '../session';

describe('mendelu_search registered', () => {
  it('finds a file read in an earlier process, asks IS for nothing, and needs no login', async () => {
    const { dir } = await tempDir();
    await ask(boot(dir));
    const before = { ...is, downloads: [...is.downloads] };

    // a restart, and this time there is no login at all
    const second = boot(dir, { unavailable: NO_LOGIN_MESSAGE });
    const r = await second.call('mendelu_search', { query: 'zapoctovy test' });
    expect(r.isError).toBeUndefined();
    expect(textOf(r)).toContain('**Zápočtový** **test**: 12. 1. 2027');
    expect(textOf(r)).toContain('EBC-PS');
    expect(textOf(r)).toContain('harmonogram.txt');
    expect(is.subjects).toBe(before.subjects);
    expect(is.listings).toBe(before.listings);
    expect(is.downloads).toEqual(before.downloads);
  });

  it('answers a search before anything is stored, and is announced read-only', async () => {
    const { dir } = await tempDir();
    const s = boot(dir);
    expect(textOf(await s.call('mendelu_search', { query: 'zapocet' }))).toMatch(
      /Nothing is stored yet/
    );
    expect(s.metas.get('mendelu_search')!.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
    expect(String(s.metas.get('mendelu_search')!.description)).toMatch(
      /BEFORE telling the student/
    );
  });

  it('is empty after forget everything', async () => {
    const { dir } = await tempDir();
    const s = boot(dir);
    await ask(s);
    expect(textOf(await s.call('mendelu_search', { query: 'test' }))).toContain('harmonogram.txt');
    await s.call('mendelu_forget_everything');
    expect(textOf(await s.call('mendelu_search', { query: 'test' }))).toMatch(/Nothing is stored/);
  });
});

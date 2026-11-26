// S2 of docs/superpowers/specs/2026-11-25-reis-for-claude-map-design.md: forget everything: it removes all, and nothing a request began before it can come back.
// A "restart" is a second store and a second server on the same folder.
import { it, describe, expect, vi } from 'vitest';
import { rm } from 'node:fs/promises';

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

import { DL, is, tempDir, boot, ask, textOf, files } from './mapKit';
import { NO_LOGIN_MESSAGE } from '../session';

describe('forget everything', () => {
  it('is registered even without an IS login, and marked destructive', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir, { unavailable: NO_LOGIN_MESSAGE });
    expect(s.metas.get('mendelu_forget_everything')).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    });
    const r = await s.call('mendelu_forget_everything');
    expect(r.isError).toBeUndefined();
    await rm(root, { recursive: true, force: true });
  });

  it('removes everything, says what it removed, and the next run starts from nothing', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await ask(s);
    const r = await s.call('mendelu_forget_everything', { response_format: 'json' });
    const report = JSON.parse(textOf(r));
    expect(report).toMatchObject({ forgotten: true, filesRemoved: 6 }); // subjects, listing, profile, one text, one original and its record
    expect(report.folder).toBe(dir);
    expect(await files(dir)).toEqual([]);

    await ask(s); // same process: its memory was forgotten too, so IS is asked again
    expect(is.downloads).toHaveLength(2);
    await rm(root, { recursive: true, force: true });
  });

  it('a download still running when it is called does not reappear', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await s.call('mendelu_subjects');
    await s.call('mendelu_subject_files', { code: 'EBC-PS' });
    let release!: () => void;
    is.hold = new Promise<void>((r) => (release = r));
    const reading = s.call('mendelu_read_file', { url: DL });
    await vi.waitFor(() => expect(is.downloads).toHaveLength(1));
    await s.call('mendelu_forget_everything');
    release();
    await reading;
    // Let any write the read queued finish, then look at the folder.
    await s.store.list();
    expect(await files(dir)).toEqual([]);
    await rm(root, { recursive: true, force: true });
  });
});

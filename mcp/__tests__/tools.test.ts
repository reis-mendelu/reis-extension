import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/utils/userParams', () => ({
  getUserParams: vi.fn().mockResolvedValue({ studium: 'S', obdobi: 'O' }),
}));
vi.mock('../../src/injector/dataFetchers', () => ({ fetchFullSemesterSchedule: vi.fn() }));
vi.mock('../../src/api/exams', () => ({ fetchDualLanguageExams: vi.fn() }));
vi.mock('../../src/api/subjects', () => ({ fetchDualLanguageSubjects: vi.fn() }));
vi.mock('../../src/api/studyPlan', () => ({ fetchDualLanguageStudyPlan: vi.fn() }));
vi.mock('../../src/api/syllabus', () => ({
  fetchSyllabus: vi.fn(),
  SYLLABUS_FETCH_FAILED: 'Error: Failed to fetch syllabus',
}));
vi.mock('../../src/api/successRate', () => ({ fetchSubjectSuccessRates: vi.fn() }));
vi.mock('../../src/api/gradeHistory', () => ({ fetchGradeHistory: vi.fn() }));
vi.mock('../../src/api/odevzdavarny', () => ({ fetchOdevzdavarny: vi.fn() }));
vi.mock('../files', () => ({ listFolderFiles: vi.fn(), readDokServerFile: vi.fn() }));

import { TOOLS } from '../tools';
import { getUserParams } from '../../src/utils/userParams';
import { fetchOdevzdavarny } from '../../src/api/odevzdavarny';
import { fetchGradeHistory } from '../../src/api/gradeHistory';
import { fetchDualLanguageSubjects } from '../../src/api/subjects';
import { fetchDualLanguageStudyPlan } from '../../src/api/studyPlan';
import { listFolderFiles } from '../files';
import { fetchFullSemesterSchedule } from '../../src/injector/dataFetchers';
import { fetchSyllabus } from '../../src/api/syllabus';

const ctx = { fetch: vi.fn() as unknown as typeof fetch };
const tool = (name: string) => {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`no tool ${name}`);
  return t;
};

describe('TOOLS', () => {
  it('has exactly the ten v1 tools and no generic page fetch', () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      'mendelu_assignments',
      'mendelu_exams',
      'mendelu_grades',
      'mendelu_read_file',
      'mendelu_schedule',
      'mendelu_study_plan',
      'mendelu_subject_files',
      'mendelu_subjects',
      'mendelu_success_rates',
      'mendelu_syllabus',
    ]);
  });

  it('fills the student study context so the model never passes it', async () => {
    vi.mocked(fetchGradeHistory).mockResolvedValue({ grades: [] } as never);
    await tool('mendelu_grades').run({}, ctx);
    expect(fetchGradeHistory).toHaveBeenCalledWith('S', 'O');
  });

  it('fails clearly when IS names no active study', async () => {
    vi.mocked(getUserParams).mockResolvedValueOnce(null);
    await expect(tool('mendelu_grades').run({}, ctx)).rejects.toThrow(/active study/);
  });

  it('strips upload links from assignments', async () => {
    vi.mocked(fetchOdevzdavarny).mockResolvedValue({
      assignments: [
        {
          courseId: '1',
          courseNameCs: 'A',
          courseNameEn: 'A',
          name: 'HW1',
          type: 't',
          deadline: 'd',
          odevzdavarnaId: '9',
          fileCount: 0,
          uploadUrl: 'https://is.mendelu.cz/x',
        },
      ],
      lastFetched: 0,
      periods: [],
    });
    const out = (await tool('mendelu_assignments').run({}, ctx)) as {
      assignments: Record<string, unknown>[];
    };
    expect(out.assignments[0]).toMatchObject({ name: 'HW1', deadline: 'd' });
    expect(out.assignments[0]).not.toHaveProperty('uploadUrl');
    expect(out.assignments[0]).not.toHaveProperty('odevzdavarnaId');
  });

  it('resolves a subject code to its folder before listing files', async () => {
    vi.mocked(fetchDualLanguageSubjects).mockResolvedValue({
      subjects: {
        data: { 'EBC-PS': { folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=5' } },
      },
    } as never);
    vi.mocked(listFolderFiles).mockResolvedValue([]);
    await tool('mendelu_subject_files').run({ code: 'EBC-PS' }, ctx);
    expect(listFolderFiles).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=5'
    );
    await expect(tool('mendelu_subject_files').run({ code: 'NOPE' }, ctx)).rejects.toThrow(
      /not enrolled/
    );
  });

  it('hides internal fields from the subject list', async () => {
    vi.mocked(fetchDualLanguageSubjects).mockResolvedValue({
      subjects: {
        data: { X: { subjectCode: 'X', folderUrl: 'u', autoHref: null, fetchedAt: 't' } },
      },
    } as never);
    expect(await tool('mendelu_subjects').run({}, ctx)).toEqual([{ subjectCode: 'X' }]);
  });

  it('returns one language of dual-language data', async () => {
    vi.mocked(fetchDualLanguageStudyPlan).mockResolvedValue({ cz: 'plán', en: 'plan' } as never);
    expect(await tool('mendelu_study_plan').run({ lang: 'en' }, ctx)).toBe('plan');
    expect(await tool('mendelu_study_plan').run({}, ctx)).toBe('plán');
  });

  it('reports a failed IS fetch instead of an empty answer', async () => {
    vi.mocked(fetchDualLanguageSubjects).mockResolvedValue(null);
    await expect(tool('mendelu_subjects').run({}, ctx)).rejects.toThrow(
      /did not return your subjects/
    );
    vi.mocked(fetchGradeHistory).mockResolvedValue(null);
    await expect(tool('mendelu_grades').run({}, ctx)).rejects.toThrow(/did not return your grades/);
    vi.mocked(fetchSyllabus).mockResolvedValue({
      requirementsText: 'Error: Failed to fetch syllabus',
      requirementsTable: [],
    } as never);
    await expect(tool('mendelu_syllabus').run({ predmet: '1' }, ctx)).rejects.toThrow(
      /did not return this syllabus/
    );
    vi.mocked(fetchFullSemesterSchedule).mockResolvedValue(null as never);
    await expect(tool('mendelu_schedule').run({}, ctx)).rejects.toThrow(
      /did not return your timetable/
    );
  });

  it('returns an empty timetable window as an empty list', async () => {
    vi.mocked(fetchFullSemesterSchedule).mockResolvedValue([] as never);
    expect(
      await tool('mendelu_schedule').run({ from: '2026-10-10', to: '2026-10-11' }, ctx)
    ).toEqual([]);
  });

  it('describes every tool as read-only', () => {
    for (const t of TOOLS) expect(t.description, t.name).toMatch(/Read-only/);
  });
});

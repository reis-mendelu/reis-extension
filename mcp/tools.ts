import { z } from 'zod';
import { getUserParams } from '../src/utils/userParams';
import { fetchFullSemesterSchedule } from '../src/injector/dataFetchers';
import { fetchDualLanguageExams } from '../src/api/exams';
import { fetchDualLanguageSubjects } from '../src/api/subjects';
import { fetchDualLanguageStudyPlan } from '../src/api/studyPlan';
import { fetchSyllabus, SYLLABUS_FETCH_FAILED } from '../src/api/syllabus';
import { fetchSubjectSuccessRates } from '../src/api/successRate';
import { fetchGradeHistory } from '../src/api/gradeHistory';
import { fetchOdevzdavarny } from '../src/api/odevzdavarny';
import { listFolderFiles, readDokServerFile } from './files';
import { scheduleRows, defaultRange, compactStudyPlan } from './shape';

export type ToolCtx = { fetch: typeof fetch };
export type ToolDef = {
  name: string;
  title: string;
  description: string;
  input: z.ZodRawShape;
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<unknown>;
};

const lang = z
  .enum(['cz', 'en'])
  .default('cz')
  .describe('Language of names and texts: "cz" (default) or "en".');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');

async function study(): Promise<{ studium: string; obdobi: string }> {
  const p = await getUserParams();
  if (!p?.studium || !p.obdobi)
    throw new Error('Could not find an active study on this IS account.');
  return { studium: p.studium, obdobi: p.obdobi };
}

/** reIS fetchers return { cz, en } for dual-language data; give the model one. */
function pickLang(value: unknown, l: unknown): unknown {
  if (value && typeof value === 'object' && 'cz' in value && 'en' in value) {
    return (value as Record<string, unknown>)[l === 'en' ? 'en' : 'cz'];
  }
  return value;
}

function omit(row: object, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
}

type SubjectsLite = { subjects?: { data?: Record<string, Record<string, unknown>> } } | null;

async function subjectsData(): Promise<Record<string, Record<string, unknown>>> {
  const { studium, obdobi } = await study();
  const res = (await fetchDualLanguageSubjects(studium, obdobi)) as SubjectsLite;
  // null is a failed fetch, not an empty enrolment: never report it as one.
  if (!res?.subjects?.data) throw new Error('IS Mendelu did not return your subjects. Try again.');
  return res.subjects.data;
}

export const TOOLS: ToolDef[] = [
  {
    name: 'mendelu_schedule',
    title: 'My timetable',
    description:
      'Your timetable from IS Mendelu for a date range (default: today and the next 14 days): lectures, seminars and consultations with date, time, subject, room and teachers. Pass from/to to look further ahead or back within this semester. Read-only.',
    input: {
      from: isoDate.optional().describe('First day, YYYY-MM-DD. Default: today.'),
      to: isoDate.optional().describe('Last day, YYYY-MM-DD. Default: 14 days from today.'),
    },
    run: async (a) => {
      const range = defaultRange();
      const from = typeof a.from === 'string' ? a.from : range.from;
      const to = typeof a.to === 'string' ? a.to : range.to;
      const lessons = await fetchFullSemesterSchedule();
      // null means IS failed, which must not read as "no classes".
      if (!Array.isArray(lessons))
        throw new Error('IS Mendelu did not return your timetable. Try again.');
      return scheduleRows(lessons, from, to);
    },
  },
  {
    name: 'mendelu_exams',
    title: 'My exams',
    description:
      'Your exam and credit (zkouška/zápočet) terms from IS Mendelu: the ones you are registered for and the ones still open, with date, room and capacity. Read-only: it never registers you.',
    // No lang option: the exam records already carry both names merged.
    input: {},
    run: () => fetchDualLanguageExams(),
  },
  {
    name: 'mendelu_subjects',
    title: 'My subjects',
    description:
      'The subjects you are enrolled in this semester: code, Czech and English name, IS subject id (use it for mendelu_syllabus), and whether it has ongoing assessment. Read-only.',
    input: {},
    run: async () =>
      Object.values(await subjectsData()).map((s) =>
        omit(s, ['folderUrl', 'autoHref', 'fetchedAt'])
      ),
  },
  {
    name: 'mendelu_study_plan',
    title: 'My study plan',
    description:
      'Your study plan: required subject groups per semester, credits earned and required, and which subjects you have completed. Read-only.',
    input: { lang },
    run: async (a) =>
      compactStudyPlan(pickLang(await fetchDualLanguageStudyPlan((await study()).studium), a.lang)),
  },
  {
    name: 'mendelu_syllabus',
    title: 'Subject syllabus',
    description:
      'The syllabus of one subject: requirements to pass, objectives, content and course info. Takes the numeric IS subject id (subjectId from mendelu_subjects), not the code. Read-only.',
    input: {
      predmet: z.string().regex(/^\d+$/).describe('Numeric IS subject id, e.g. "164074".'),
      lang,
    },
    run: async (a) => {
      const syllabus = await fetchSyllabus(String(a.predmet), a.lang === 'en' ? 'en' : 'cz');
      // The fetcher degrades to a placeholder for the app; here a failure is an error.
      if (syllabus.requirementsText === SYLLABUS_FETCH_FAILED) {
        throw new Error(
          'IS Mendelu did not return this syllabus. Check the subject id or try again.'
        );
      }
      return syllabus;
    },
  },
  {
    name: 'mendelu_subject_files',
    title: 'Subject files',
    description:
      "Lists the files in one enrolled subject's IS document folder (slides, materials): name, author, date and a downloadUrl to pass to mendelu_read_file. Read-only.",
    input: { code: z.string().min(2).describe('Subject code, e.g. "EBC-PS".') },
    run: async (a) => {
      const folderUrl = (await subjectsData())[String(a.code)]?.folderUrl;
      if (typeof folderUrl !== 'string') {
        throw new Error(`${String(a.code)} is not enrolled this semester, or has no file folder.`);
      }
      return listFolderFiles(folderUrl);
    },
  },
  {
    name: 'mendelu_read_file',
    title: 'Read a subject file',
    description:
      'Downloads one file from the IS document server and returns its text (PDF, DOCX, PPTX, XLSX, ODT, plain text). Only accepts a downloadUrl from mendelu_subject_files. Read-only.',
    input: { url: z.string().url().describe('A downloadUrl from mendelu_subject_files.') },
    run: (a, ctx) => readDokServerFile(String(a.url), ctx.fetch),
  },
  {
    name: 'mendelu_success_rates',
    title: 'Subject pass rates',
    description:
      'Historical pass and fail counts per semester for subject codes, from reIS public statistics (not your personal data). Read-only.',
    input: {
      codes: z.array(z.string().min(2)).min(1).max(50).describe('Subject codes, e.g. ["EBC-PS"].'),
    },
    run: (a) => fetchSubjectSuccessRates(a.codes as string[]),
  },
  {
    name: 'mendelu_grades',
    title: 'My grades',
    description:
      'Your grades and credits across all semesters so far (Průchod studiem): subject, grade, credits, attempt and date. Read-only.',
    input: {},
    run: async () => {
      const { studium, obdobi } = await study();
      const grades = await fetchGradeHistory(studium, obdobi);
      if (!grades) throw new Error('IS Mendelu did not return your grades. Try again.');
      return grades;
    },
  },
  {
    name: 'mendelu_assignments',
    title: 'My assignment deadlines',
    description:
      'Your submission boxes (Odevzdávárny): subject, assignment, deadline, whether it is still open, files handed in and points. Read-only: it never submits anything.',
    input: {},
    run: async () => {
      const { studium, obdobi } = await study();
      const res = await fetchOdevzdavarny(studium, obdobi);
      if (!res) return null;
      return {
        ...res,
        assignments: res.assignments.map((r) => omit(r, ['uploadUrl', 'odevzdavarnaId'])),
      };
    },
  },
];
